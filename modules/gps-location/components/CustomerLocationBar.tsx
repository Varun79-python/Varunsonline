'use client'
/**
 * components/shared/CustomerLocationBar.tsx
 * Swiggy/Zomato-style saved delivery address selector.
 * Shows selected saved address — NO GPS tracking.
 * Clicking opens a bottom-sheet/modal to switch addresses.
 */
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/modules/infrastructure/supabase/client'

interface SavedAddress {
  id: string
  label: string
  house_name: string
  street_name: string
  landmark: string | null
  city: string | null
  state: string | null
  pincode: string | null
  latitude: number | null
  longitude: number | null
  is_default: boolean
}

const LABEL_ICONS: Record<string, string> = {
  Home: '🏠',
  Work: '💼',
  Other: '📍',
}

const LABEL_COLORS: Record<string, { bg: string; text: string }> = {
  Home: { bg: '#fff7ed', text: '#ea580c' },
  Work: { bg: '#eff6ff', text: '#2563eb' },
  Other: { bg: '#f0fdf4', text: '#16a34a' },
}

export default function CustomerLocationBar() {
  const supabase = createClient()
  const [addresses, setAddresses] = useState<SavedAddress[]>([])
  const [selected, setSelected] = useState<SavedAddress | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadAddresses = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await supabase
      .from('addresses')
      .select('*')
      .eq('customer_id', user.id)
      .order('is_default', { ascending: false })
    if (data) {
      const typed = data as unknown as SavedAddress[]
      setAddresses(typed)
      // Find default or use first
      const def = typed.find(a => a.is_default) || typed[0] || null
      setSelected(def)
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadAddresses() }, [loadAddresses])

  async function selectAddress(addr: SavedAddress) {
    // Update default in DB
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      // Clear old default
      if (addr.id) {
        await supabase.from('addresses').update({ is_default: false }).eq('customer_id', user.id).neq('id', addr.id)
        await supabase.from('addresses').update({ is_default: true }).eq('id', addr.id)
      }
    }
    setSelected(addr)
    setShowPicker(false)
  }

  function truncate(str: string, max: number) {
    if (!str) return ''
    return str.length > max ? str.slice(0, max) + '…' : str
  }

  const labelIcon = selected ? (LABEL_ICONS[selected.label] || '📍') : '📍'
  const labelColor = selected ? (LABEL_COLORS[selected.label] || LABEL_COLORS.Other) : LABEL_COLORS.Other
  const shortAddr = selected
    ? [selected.house_name, selected.street_name, selected.city].filter(Boolean).join(', ')
    : ''

  if (loading) {
    return (
      <div className="cloc-bar">
        <div className="cloc-skeleton">
          <div className="skeleton" style={{ width: 60, height: 22, borderRadius: 6 }} />
          <div className="skeleton" style={{ width: 200, height: 14, borderRadius: 6, marginTop: 6 }} />
        </div>
      </div>
    )
  }

  if (!selected && addresses.length === 0) {
    return null // No addresses saved — don't show bar
  }

  return (
    <>
      {/* ── DESKTOP VERSION ── */}
      <div className="cloc-bar cloc-desktop">
        <div className="cloc-inner">
          <div className="cloc-left">
            <span
              className="cloc-badge"
              style={{ background: labelColor.bg, color: labelColor.text }}
            >
              {labelIcon} {selected?.label || 'Home'}
            </span>
            <div className="cloc-addr-wrap">
              <div className="cloc-title">
                {selected?.house_name || 'Delivery Address'}
              </div>
              <div className="cloc-addr">
                {truncate(shortAddr, 60)}
              </div>
            </div>
          </div>
          <button
            className="cloc-change-btn"
            onClick={() => setShowPicker(true)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            Change Address
          </button>
        </div>
      </div>

      {/* ── MOBILE VERSION ── */}
      <div
        className="cloc-bar cloc-mobile"
        onClick={() => setShowPicker(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setShowPicker(true)}
      >
        <div className="cloc-mobile-inner">
          <span className="cloc-mobile-icon">{labelIcon}</span>
          <div className="cloc-mobile-text">
            <span className="cloc-mobile-label">
              {selected?.label || 'Home'}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 2 }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </span>
            <span className="cloc-mobile-addr">
              {truncate(shortAddr, 35)}
            </span>
          </div>
        </div>
      </div>

      {/* ── ADDRESS PICKER MODAL / BOTTOM SHEET ── */}
      {showPicker && (
        <div className="cloc-overlay" onClick={() => setShowPicker(false)}>
          <div
            className="cloc-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cloc-sheet-header">
              <h3 className="cloc-sheet-title">Select Delivery Address</h3>
              <button
                className="cloc-sheet-close"
                onClick={() => setShowPicker(false)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="cloc-sheet-list">
              {addresses.map((addr) => {
                const isActive = selected?.id === addr.id
                const ac = LABEL_COLORS[addr.label] || LABEL_COLORS.Other
                const fullAddr = [addr.house_name, addr.street_name, addr.landmark, addr.city, addr.pincode].filter(Boolean).join(', ')
                return (
                  <button
                    key={addr.id}
                    className={`cloc-addr-item ${isActive ? 'cloc-addr-active' : ''}`}
                    onClick={() => selectAddress(addr)}
                    style={isActive ? { borderColor: ac.text, background: ac.bg } : {}}
                  >
                    <div className="cloc-addr-item-left">
                      <span className="cloc-addr-label" style={{ background: ac.bg, color: ac.text }}>
                        {LABEL_ICONS[addr.label] || '📍'} {addr.label}
                      </span>
                      <span className="cloc-addr-item-title">{addr.house_name}</span>
                      <span className="cloc-addr-item-detail">{truncate(fullAddr, 80)}</span>
                    </div>
                    {isActive && (
                      <span className="cloc-addr-check">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={ac.text} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            <div className="cloc-sheet-footer">
              <a href="/customer/profile" className="cloc-add-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add New Address
              </a>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .cloc-bar {
          width: 100%;
          background: white;
          border-bottom: 1px solid #f1f5f9;
        }
        .cloc-desktop {
          display: block;
          padding: 10px 24px;
          position: sticky;
          top: 60px;
          z-index: 40;
          box-shadow: 0 1px 4px rgba(0,0,0,0.04);
        }
        .cloc-mobile {
          display: none;
        }
        .cloc-skeleton {
          padding: 12px 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .cloc-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          max-width: 1280px;
          margin: 0 auto;
        }
        .cloc-left {
          display: flex;
          align-items: center;
          gap: 14px;
          min-width: 0;
          flex: 1;
        }
        .cloc-badge {
          flex-shrink: 0;
          padding: 5px 12px;
          border-radius: 8px;
          font-size: 0.78rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 4px;
          white-space: nowrap;
        }
        .cloc-addr-wrap {
          min-width: 0;
          flex: 1;
        }
        .cloc-title {
          font-size: 0.9rem;
          font-weight: 700;
          color: #0f172a;
          line-height: 1.3;
        }
        .cloc-addr {
          font-size: 0.78rem;
          color: #64748b;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-top: 1px;
        }
        .cloc-change-btn {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          gap: 6px;
          background: #fff7ed;
          border: 1px solid #fed7aa;
          color: #ea580c;
          padding: 8px 14px;
          border-radius: 8px;
          font-size: 0.78rem;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s;
          font-family: inherit;
        }
        .cloc-change-btn:hover {
          background: #ffedd5;
          border-color: #fdba74;
        }
        .cloc-change-btn:active {
          transform: scale(0.97);
        }

        /* ── MOBILE STYLES ── */
        .cloc-mobile-inner {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 16px;
          padding-top: calc(10px + env(safe-area-inset-top, 0px));
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
        }
        .cloc-mobile-icon {
          font-size: 1.2rem;
          flex-shrink: 0;
        }
        .cloc-mobile-text {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }
        .cloc-mobile-label {
          font-size: 0.82rem;
          font-weight: 700;
          color: #0f172a;
          display: flex;
          align-items: center;
          gap: 2px;
        }
        .cloc-mobile-addr {
          font-size: 0.72rem;
          color: #64748b;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-top: 1px;
        }

        /* ── MODAL / BOTTOM SHEET ── */
        .cloc-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.45);
          backdrop-filter: blur(2px);
          z-index: 300;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          animation: clocFadeIn 0.2s ease;
        }
        .cloc-sheet {
          background: white;
          border-radius: 20px 20px 0 0;
          width: 100%;
          max-width: 500px;
          max-height: 85vh;
          display: flex;
          flex-direction: column;
          animation: clocSlideUp 0.3s cubic-bezier(0.32, 0.72, 0, 1) forwards;
          position: relative;
          padding-top: 28px;
          background-image: linear-gradient(to right, #cbd5e1 0%, #cbd5e1 100%);
          background-size: 40px 4px;
          background-repeat: no-repeat;
          background-position: top 10px center;
          padding-bottom: env(safe-area-inset-bottom, 16px);
        }
        .cloc-sheet-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 20px 16px;
          border-bottom: 1px solid #f1f5f9;
          background: white;
          border-radius: 20px 20px 0 0;
        }
        .cloc-sheet-title {
          font-size: 1.05rem;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
        }
        .cloc-sheet-close {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: #f1f5f9;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #64748b;
          font-family: inherit;
        }
        .cloc-sheet-close:active {
          background: #e2e8f0;
        }
        .cloc-sheet-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px 16px;
          background: white;
        }
        .cloc-addr-item {
          width: 100%;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 14px;
          margin-bottom: 8px;
          border-radius: 12px;
          border: 1.5px solid #e2e8f0;
          background: white;
          cursor: pointer;
          text-align: left;
          font-family: inherit;
          transition: all 0.15s;
        }
        .cloc-addr-item:active {
          transform: scale(0.98);
        }
        .cloc-addr-active {
          border-width: 2px;
        }
        .cloc-addr-item-left {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .cloc-addr-label {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 0.68rem;
          font-weight: 700;
          width: fit-content;
        }
        .cloc-addr-item-title {
          font-size: 0.88rem;
          font-weight: 700;
          color: #0f172a;
        }
        .cloc-addr-item-detail {
          font-size: 0.76rem;
          color: #64748b;
          line-height: 1.3;
        }
        .cloc-addr-check {
          flex-shrink: 0;
          margin-top: 4px;
        }
        .cloc-sheet-footer {
          padding: 12px 16px 8px;
          border-top: 1px solid #f1f5f9;
          background: white;
        }
        .cloc-add-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 12px;
          border-radius: 10px;
          background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
          color: white;
          font-size: 0.85rem;
          font-weight: 700;
          border: none;
          cursor: pointer;
          text-decoration: none;
          font-family: inherit;
        }
        .cloc-add-btn:active {
          opacity: 0.9;
        }

        @keyframes clocFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes clocSlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }

        @media (max-width: 768px) {
          .cloc-desktop {
            display: none !important;
          }
          .cloc-mobile {
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
