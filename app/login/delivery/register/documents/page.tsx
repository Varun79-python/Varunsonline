'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function DeliveryDocumentsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  const [aadharUrl, setAadharUrl] = useState('')
  const [error, setError] = useState('')

  const MAX_FILE_SIZE = 5 * 1024 * 1024

  const checkAuth = useCallback(async () => {
    if (!supabase) {
      setLoadError('Supabase not configured. Please try again later.')
      setLoading(false)
      return
    }

    setLoading(true)
    setLoadError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/login/delivery')
        return
      }

      const { data: agent, error: agentErr } = await supabase
        .from('delivery_agents')
        .select('id, aadhar_url')
        .eq('id', user.id)
        .maybeSingle()

      if (agentErr) {
        console.error('Agent query error:', agentErr)
        setLoadError('Failed to load profile. Please try again.')
        setLoading(false)
        return
      }

      if (!agent) {
        router.replace('/login/delivery/register')
        return
      }

      if (agent.aadhar_url) {
        router.replace('/login/status')
        return
      }

      setUserId(user.id)
      setLoading(false)
    } catch (err: unknown) {
      console.error('Check auth error:', err)
      setLoadError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }, [router, supabase])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    if (done) {
      const timer = setTimeout(() => {
        router.replace('/login/status')
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [done, router])

  async function uploadFile(file: File, docType: string): Promise<string | null> {
    if (!userId) return null
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${userId}/${docType}_${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('agent-documents').upload(path, file)
      if (uploadError) {
        const msg = uploadError.message.includes('row-level security') 
          ? 'Storage permissions denied. Please run the latest Supabase RLS migrations in the SQL editor.'
          : uploadError.message
        alert('Upload failed: ' + msg)
        setUploading(false)
        return null
      }
      const { data: { publicUrl } } = supabase.storage.from('agent-documents').getPublicUrl(path)
      setUploading(false)
      return publicUrl
    } catch (err: unknown) {
      const msg = err instanceof Error && err.message.includes('row-level security')
        ? 'Storage permissions denied. Please run the latest Supabase RLS migrations in the SQL editor.'
        : err instanceof Error ? err.message : 'Upload failed'
      alert('Upload failed: ' + msg)
      setUploading(false)
      return null
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_FILE_SIZE) { alert('File too large. Maximum size is 5MB'); return }
    uploadFile(file, 'aadhar').then(url => { if (url) setAadharUrl(url) })
  }

  async function submit() {
    if (!aadharUrl) { setError('Please upload Aadhaar Card'); return }
    if (!userId) { setError('Session expired. Please login again.'); return }

    setSaving(true)
    setError('')

    // Use API to bypass RLS
    const res = await fetch('/api/delivery/update-documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, aadharUrl })
    })

    const data = await res.json()
    if (!res.ok) {
      setError('Failed to save: ' + (data.error || 'Unknown error'))
      setSaving(false)
      return
    }

    setDone(true)
    setSaving(false)
  }

  // Loading state
  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: '3rem', marginBottom: 16 }}>📋</div>
      <div style={{ width: 40, height: 40, border: '3px solid #e2e8f0', borderTopColor: '#22c55e', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: 16 }} />
      <p style={{ color: '#64748b' }}>Loading your profile...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  // Error state with retry
  if (loadError) return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ textAlign: 'center', background: 'white', padding: 40, borderRadius: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.1)', maxWidth: 400 }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>⚠️</div>
        <h2 style={{ marginBottom: 12, fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>Something went wrong</h2>
        <p style={{ color: '#64748b', marginBottom: 24 }}>{loadError}</p>
        <button
          onClick={() => checkAuth()}
          style={{ padding: '12px 24px', background: '#22c55e', color: 'white', border: 'none', borderRadius: 12, fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer', marginBottom: 12, width: '100%' }}
        >
          🔄 Try Again
        </button>
        <button
          onClick={() => router.replace('/login/delivery')}
          style={{ padding: '12px 24px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 12, fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer', width: '100%' }}
        >
          ← Back to Login
        </button>
      </div>
    </div>
  )

  // Done state
  if (done) return (
    <div style={{ minHeight: '100vh', padding: 24, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', background: 'white', borderRadius: 20, padding: 32, maxWidth: 400, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>🎉</div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Documents Submitted!</h2>
        <p style={{ color: '#64748b', marginBottom: 24, lineHeight: 1.6 }}>Your documents have been uploaded.<br/><br/>Redirecting to check status...</p>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '0 16px 40px' }}>
      <div style={{ padding: '20px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.replace('/login/delivery')} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>←</button>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Upload Documents</h2>
      </div>

      <div style={{ maxWidth: 500, margin: '0 auto' }}>
        <div style={{ background: 'white', borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Aadhaar Card * <span style={{ fontSize: '0.75rem', color: '#64748b' }}>(Max 5MB)</span></h3>

          <label style={{ display: 'block', cursor: 'pointer' }}>
            <input type="file" accept="image/*" onChange={handleFileSelect} style={{ display: 'none' }} />
            <div style={{ border: '2px dashed #e2e8f0', borderRadius: 12, padding: 24, textAlign: 'center', background: aadharUrl ? '#f0fdf4' : '#f8fafc' }}>
              {uploading ? (
                <div>
                  <div style={{ fontSize: '2rem', marginBottom: 8 }}>⏳</div>
                  <div style={{ color: '#22c55e', fontWeight: 600 }}>Uploading...</div>
                </div>
              ) : aadharUrl ? (
                <div>
                  <div style={{ fontSize: '2rem', marginBottom: 8 }}>✅</div>
                  <div style={{ color: '#16a34a', fontWeight: 600, fontSize: '0.9rem' }}>Aadhaar Uploaded</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>Tap to change</div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '2rem', marginBottom: 8 }}>📷</div>
                  <div style={{ color: '#374151', fontWeight: 600, fontSize: '0.9rem' }}>Upload Aadhaar Photo</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>Take photo or choose from gallery</div>
                </div>
              )}
            </div>
          </label>

          {aadharUrl && (
            <div style={{ marginTop: 12 }}>
              <img src={aadharUrl} alt="Aadhaar" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 10 }} />
            </div>
          )}
        </div>

        {error && (
          <div style={{ padding: 14, background: '#fef2f2', borderRadius: 12, color: '#dc2626', fontSize: '0.9rem', fontWeight: 600, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <button
          onClick={submit}
          disabled={saving || uploading}
          style={{ width: '100%', padding: '16px', background: saving ? '#94a3b8' : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', color: 'white', border: 'none', borderRadius: 14, fontSize: '1rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', boxShadow: saving ? 'none' : '0 4px 16px rgba(34,197,94,0.3)' }}
        >
          {saving ? 'Saving...' : 'Submit Documents'}
        </button>
      </div>
    </div>
  )
}