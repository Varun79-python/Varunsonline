'use client'
/**
 * components/shared/AgentLiveLocationBar.tsx
 * DELIVERY AGENT ONLY — Live GPS tracking with navigator.geolocation.watchPosition.
 * Shows real-time location, LIVE badge, accuracy, and last-updated time.
 * Stops tracking when agent goes offline, resumes when online.
 */
import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { reverseGeocode, type ReverseGeoResult } from '@/lib/gps'

interface AgentStatus {
  is_available: boolean
  last_lat: number | null
  last_lon: number | null
}

export default function AgentLiveLocationBar() {
  const supabase = createClient()
  const [agentId, setAgentId] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(false)
  const [loading, setLoading] = useState(true)

  // GPS tracking state
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [locality, setLocality] = useState('')
  const [city, setCity] = useState('')
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [permissionState, setPermissionState] = useState<'granted' | 'denied' | 'prompt' | 'unsupported'>('prompt')
  const [expanded, setExpanded] = useState(false)

  const watchIdRef = useRef<number | null>(null)
  const lastPushRef = useRef<{ lat: number; lon: number } | null>(null)
  const onlineRef = useRef(false)

  // Fetch agent status
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setAgentId(user.id)

      const { data: agent } = await supabase
        .from('delivery_agents')
        .select('is_available, last_lat, last_lon')
        .eq('id', user.id)
        .single()

      if (agent) {
        const avail = agent.is_available ?? false
        setIsOnline(avail)
        onlineRef.current = avail
        if (agent.last_lat && agent.last_lon) {
          setLatitude(agent.last_lat)
          setLongitude(agent.last_lon)
          reverseGeocodeAndSet(agent.last_lat, agent.last_lon)
        }
      }

      // Check permission state
      if (typeof navigator !== 'undefined' && navigator.permissions) {
        try {
          const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName })
          setPermissionState(status.state as 'granted' | 'denied' | 'prompt')
          status.addEventListener('change', () => {
            setPermissionState(status.state as 'granted' | 'denied' | 'prompt')
          })
        } catch { /* ignore */ }
      } else if (typeof navigator === 'undefined' || !navigator.geolocation) {
        setPermissionState('unsupported')
      }

      setLoading(false)
    }
    load()
  }, [supabase])

  const reverseGeocodeAndSet = useCallback(async (lat: number, lon: number) => {
    try {
      const geo: ReverseGeoResult = await reverseGeocode(lat, lon)
      if (geo.city) setCity(geo.city)
      if (geo.landmark || geo.formattedAddress) {
        // Show nearest landmark or area
        const area = geo.landmark || geo.formattedAddress?.split(',').slice(0, 2).join(',') || ''
        setLocality(area)
      }
    } catch {
      // silently fail — coordinates are still valid
    }
  }, [])

  // Push location to DB
  const pushToDB = useCallback(async (lat: number, lon: number, acc: number) => {
    if (!agentId) return
    const prev = lastPushRef.current
    const movedEnough = !prev || haversineMeters(prev.lat, prev.lon, lat, lon) > 30
    if (!movedEnough) return

    lastPushRef.current = { lat, lon }

    // Update delivery_agents table
    await supabase
      .from('delivery_agents')
      .update({ last_lat: lat, last_lon: lon, last_updated: new Date().toISOString() })
      .eq('id', agentId)

    // Insert into live tracking table
    await supabase
      .from('agent_live_locations')
      .insert({
        agent_id: agentId,
        latitude: lat,
        longitude: lon,
        accuracy: Math.round(acc),
        is_online: onlineRef.current,
      })
  }, [agentId, supabase])

  // Start/stop watchPosition based on online status
  useEffect(() => {
    if (!agentId) return

    function startWatching() {
      if (watchIdRef.current !== null) return
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        setPermissionState('unsupported')
        setGpsError('GPS is not supported on this device.')
        return
      }

      setGpsError(null)

      watchIdRef.current = navigator.geolocation.watchPosition(
        async (position) => {
          const { latitude: lat, longitude: lon, accuracy: acc } = position.coords
          setLatitude(lat)
          setLongitude(lon)
          setAccuracy(acc)
          setLastUpdated(new Date())
          setGpsError(null)

          // Reverse geocode (debounced, only when moved significantly)
          if (!lastPushRef.current || haversineMeters(lastPushRef.current.lat, lastPushRef.current.lon, lat, lon) > 100) {
            reverseGeocodeAndSet(lat, lon)
          }

          // Push to DB
          await pushToDB(lat, lon, acc)
        },
        (error) => {
          console.warn('[AgentGPS] watchPosition error:', error.code, error.message)
          if (error.code === 1) {
            setPermissionState('denied')
            setGpsError('Location access denied. Enable GPS in browser settings.')
          } else if (error.code === 2) {
            setGpsError('Location unavailable. Turn on device GPS.')
          } else if (error.code === 3) {
            setGpsError('GPS timed out.')
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      )
    }

    function stopWatching() {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }

    if (isOnline) {
      startWatching()
    } else {
      stopWatching()
    }

    return () => {
      stopWatching()
    }
  }, [agentId, isOnline, reverseGeocodeAndSet, pushToDB])

  // Update onlineRef when isOnline changes
  useEffect(() => {
    onlineRef.current = isOnline
  }, [isOnline])

  // Watch for is_available changes via realtime
  useEffect(() => {
    if (!agentId) return
    const channel = supabase.channel(`agent-status-${agentId}`)
    channel
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'delivery_agents',
        filter: `id=eq.${agentId}`,
      }, (payload: { new: AgentStatus }) => {
        const avail = payload.new?.is_available ?? false
        setIsOnline(avail)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [agentId, supabase])

  function formatTime(date: Date): string {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSec = Math.floor(diffMs / 1000)
    if (diffSec < 10) return 'Just now'
    if (diffSec < 60) return `${diffSec}s ago`
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `${diffMin}m ago`
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  }

  const liveLocation = latitude && longitude
    ? `${locality || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`}${city ? `, ${city}` : ''}`
    : 'Getting location...'

  const accuracyDisplay = accuracy !== null ? `${Math.round(accuracy)}m` : '—'

  if (loading) {
    return (
      <div className="aloc-bar">
        <div className="aloc-skeleton">
          <div className="skeleton" style={{ width: 160, height: 16, borderRadius: 6 }} />
          <div className="skeleton" style={{ width: 100, height: 12, borderRadius: 6, marginTop: 6 }} />
        </div>
      </div>
    )
  }

  if (permissionState === 'unsupported') return null

  return (
    <>
      {/* ── DESKTOP VERSION ── */}
      <div className={`aloc-bar aloc-desktop ${isOnline ? 'aloc-online' : 'aloc-offline'}`}>
        <div className="aloc-inner">
          <div className="aloc-left">
            <div className="aloc-icon-wrap">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isOnline ? '#22c55e' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <div className="aloc-text">
              <div className="aloc-title">
                {isOnline ? '📍 Current Location' : '📍 Location Tracking'}
              </div>
              <div className="aloc-location">{liveLocation}</div>
              <div className="aloc-meta">
                {isOnline && (
                  <span className="aloc-live-badge">
                    <span className="aloc-live-dot" />
                    LIVE
                  </span>
                )}
                {accuracy !== null && (
                  <span className="aloc-accuracy">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    ±{accuracyDisplay}
                  </span>
                )}
                {lastUpdated && (
                  <span className="aloc-updated">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    {formatTime(lastUpdated)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="aloc-right">
            <div className={`aloc-status-indicator ${isOnline ? 'aloc-status-online' : 'aloc-status-offline'}`}>
              <span className="aloc-status-dot" />
              <span>{isOnline ? 'Online' : 'Offline'}</span>
            </div>
            <button
              className="aloc-refresh-btn"
              onClick={() => {
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      setLatitude(pos.coords.latitude)
                      setLongitude(pos.coords.longitude)
                      setAccuracy(pos.coords.accuracy)
                      setLastUpdated(new Date())
                      reverseGeocodeAndSet(pos.coords.latitude, pos.coords.longitude)
                    },
                    () => {},
                    { enableHighAccuracy: true, timeout: 5000 }
                  )
                }
              }}
              title="Refresh location"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── MOBILE VERSION ── */}
      <div
        className={`aloc-bar aloc-mobile ${isOnline ? 'aloc-online' : 'aloc-offline'}`}
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setExpanded(!expanded)}
      >
        <div className="aloc-mobile-pill">
          <div className="aloc-mobile-dot">
            <svg width="18" height="18" viewBox="0 0 24 24" fill={isOnline ? '#22c55e' : '#94a3b8'} stroke="none">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" fill="white" />
            </svg>
          </div>
          <div className="aloc-mobile-text">
            <span className="aloc-mobile-location">{liveLocation}</span>
          </div>
          <div className="aloc-mobile-live">
            {isOnline && (
              <span className="aloc-live-badge aloc-live-badge-small">
                <span className="aloc-live-dot" />
                LIVE
              </span>
            )}
          </div>
          <svg
            className="aloc-mobile-chevron"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>

        {expanded && (
          <div className="aloc-mobile-expanded">
            <div className="aloc-exp-row">
              <span className="aloc-exp-label">Accuracy</span>
              <span className="aloc-exp-value">±{accuracyDisplay}</span>
            </div>
            <div className="aloc-exp-row">
              <span className="aloc-exp-label">Last Updated</span>
              <span className="aloc-exp-value">{lastUpdated ? formatTime(lastUpdated) : '—'}</span>
            </div>
            <div className="aloc-exp-row">
              <span className="aloc-exp-label">Status</span>
              <span className={`aloc-exp-value ${isOnline ? 'aloc-exp-online' : 'aloc-exp-offline'}`}>
                {isOnline ? '● Online' : '○ Offline'}
              </span>
            </div>
            <div className="aloc-exp-row">
              <span className="aloc-exp-label">Coordinates</span>
              <span className="aloc-exp-value aloc-exp-coords">
                {latitude && longitude
                  ? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
                  : '—'}
              </span>
            </div>
            {gpsError && (
              <div className="aloc-exp-error">
                ⚠️ {gpsError}
              </div>
            )}
            {latitude && longitude && (
              <a
                href={`https://maps.google.com/?q=${latitude},${longitude}`}
                target="_blank"
                rel="noreferrer"
                className="aloc-exp-map-link"
                onClick={(e) => e.stopPropagation()}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                  <line x1="8" y1="2" x2="8" y2="18" />
                  <line x1="16" y1="6" x2="16" y2="22" />
                </svg>
                Open in Google Maps
              </a>
            )}
            <button
              className="aloc-exp-refresh"
              onClick={(e) => {
                e.stopPropagation()
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      setLatitude(pos.coords.latitude)
                      setLongitude(pos.coords.longitude)
                      setAccuracy(pos.coords.accuracy)
                      setLastUpdated(new Date())
                      reverseGeocodeAndSet(pos.coords.latitude, pos.coords.longitude)
                    },
                    () => {},
                    { enableHighAccuracy: true, timeout: 5000 }
                  )
                }
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              Refresh GPS
            </button>
          </div>
        )}
      </div>

      <style>{`
        .aloc-bar {
          width: 100%;
          background: white;
          border-bottom: 1px solid #f1f5f9;
          transition: all 0.2s;
        }
        .aloc-desktop {
          display: block;
          padding: 8px 24px;
          position: sticky;
          top: 60px;
          z-index: 40;
          box-shadow: 0 1px 4px rgba(0,0,0,0.04);
          border-left: 3px solid transparent;
        }
        .aloc-online {
          border-left-color: #22c55e;
        }
        .aloc-offline {
          border-left-color: #94a3b8;
        }
        .aloc-mobile {
          display: none;
        }
        .aloc-skeleton {
          padding: 12px 0;
          display: flex;
          flex-direction: column;
        }
        .aloc-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          max-width: 1280px;
          margin: 0 auto;
        }
        .aloc-left {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          min-width: 0;
          flex: 1;
        }
        .aloc-icon-wrap {
          flex-shrink: 0;
          width: 36px;
          height: 36px;
          background: #f8fafc;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 2px;
          border: 1px solid #f1f5f9;
        }
        .aloc-text {
          min-width: 0;
          flex: 1;
        }
        .aloc-title {
          font-size: 0.85rem;
          font-weight: 700;
          color: #0f172a;
        }
        .aloc-location {
          font-size: 0.78rem;
          color: #64748b;
          margin-top: 1px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .aloc-meta {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 4px;
          flex-wrap: wrap;
        }
        .aloc-live-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          border-radius: 99px;
          background: #f0fdf4;
          color: #16a34a;
          font-size: 0.65rem;
          font-weight: 800;
          border: 1px solid #86efac;
          letter-spacing: 0.5px;
          animation: alocPulse 2s ease-in-out infinite;
        }
        .aloc-live-badge-small {
          padding: 1px 6px;
          font-size: 0.6rem;
        }
        .aloc-live-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #22c55e;
          animation: alocBlink 1s ease-in-out infinite;
        }
        .aloc-accuracy, .aloc-updated {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          font-size: 0.68rem;
          color: #94a3b8;
          font-weight: 500;
        }
        .aloc-right {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }
        .aloc-status-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border-radius: 99px;
          font-size: 0.72rem;
          font-weight: 700;
        }
        .aloc-status-online {
          background: #f0fdf4;
          color: #16a34a;
          border: 1px solid #bbf7d0;
        }
        .aloc-status-offline {
          background: #f1f5f9;
          color: #64748b;
          border: 1px solid #e2e8f0;
        }
        .aloc-status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
        }
        .aloc-status-online .aloc-status-dot {
          background: #22c55e;
        }
        .aloc-status-offline .aloc-status-dot {
          background: #94a3b8;
        }
        .aloc-refresh-btn {
          flex-shrink: 0;
          width: 34px;
          height: 34px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #64748b;
          transition: all 0.15s;
        }
        .aloc-refresh-btn:hover {
          background: #f1f5f9;
          color: #0f172a;
        }
        .aloc-refresh-btn:active {
          transform: scale(0.95);
        }

        /* ── MOBILE STYLES ── */
        .aloc-mobile-pill {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 16px;
          padding-top: calc(10px + env(safe-area-inset-top, 0px));
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
        }
        .aloc-mobile-dot {
          flex-shrink: 0;
          width: 32px;
          height: 32px;
          background: #f8fafc;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #f1f5f9;
        }
        .aloc-mobile-text {
          flex: 1;
          min-width: 0;
        }
        .aloc-mobile-location {
          font-size: 0.8rem;
          font-weight: 600;
          color: #0f172a;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          display: block;
        }
        .aloc-mobile-live {
          flex-shrink: 0;
        }
        .aloc-mobile-chevron {
          flex-shrink: 0;
        }
        .aloc-mobile-expanded {
          padding: 4px 16px 12px;
          border-top: 1px solid #f1f5f9;
          background: #fafafa;
        }
        .aloc-exp-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 0;
          font-size: 0.78rem;
        }
        .aloc-exp-label {
          color: #94a3b8;
          font-weight: 500;
        }
        .aloc-exp-value {
          color: #0f172a;
          font-weight: 600;
        }
        .aloc-exp-online {
          color: #16a34a;
        }
        .aloc-exp-offline {
          color: #94a3b8;
        }
        .aloc-exp-coords {
          font-family: monospace;
          font-size: 0.72rem;
        }
        .aloc-exp-error {
          margin-top: 6px;
          padding: 8px 10px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          font-size: 0.72rem;
          color: #dc2626;
          line-height: 1.4;
        }
        .aloc-exp-map-link, .aloc-exp-refresh {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          width: 100%;
          padding: 9px;
          margin-top: 8px;
          border-radius: 8px;
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
          font-family: inherit;
        }
        .aloc-exp-map-link {
          background: #eff6ff;
          color: #2563eb;
          border: 1px solid #bfdbfe;
        }
        .aloc-exp-refresh {
          background: #f1f5f9;
          color: #475569;
          border: 1px solid #e2e8f0;
        }
        .aloc-exp-refresh:active {
          background: #e2e8f0;
        }

        @keyframes alocBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes alocPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.2); }
          50% { box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.1); }
        }

        @media (max-width: 768px) {
          .aloc-desktop {
            display: none !important;
          }
          .aloc-mobile {
            display: block !important;
            position: sticky;
            top: 0;
            z-index: 40;
            background: white;
            border-bottom: 1px solid #f1f5f9;
            box-shadow: 0 1px 4px rgba(0,0,0,0.04);
          }
        }
      `}</style>
    </>
  )
}

/** Haversine distance in meters between two coordinates */
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
