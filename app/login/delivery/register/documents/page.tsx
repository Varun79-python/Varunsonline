'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function DeliveryDocumentsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  
  const [aadharUrl, setAadharUrl] = useState('')
  const [existingAadhar, setExistingAadhar] = useState('')
  const [error, setError] = useState('')

  const MAX_FILE_SIZE = 5 * 1024 * 1024

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('Please login first')
        router.push('/login/delivery')
        return
      }
      
      // Check if agent exists
      const { data: agent } = await supabase.from('delivery_agents').select('aadhar_url').eq('id', user.id).single()
      if (agent?.aadhar_url) {
        // Already has documents - redirect to status
        router.push('/login/status')
        return
      }
      
      setUserId(user.id)
      setExistingAadhar(agent?.aadhar_url || '')
      setLoading(false)
    }
    checkAuth()
  }, [router, supabase])

  async function uploadFile(file: File, docType: string): Promise<string | null> {
    if (!userId) return null
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${userId}/${docType}_${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('agent-documents').upload(path, file)
      if (uploadError) { 
        alert('Upload failed: ' + uploadError.message)
        setUploading(false)
        return null 
      }
      const { data: { publicUrl } } = supabase.storage.from('agent-documents').getPublicUrl(path)
      setUploading(false)
      return publicUrl
    } catch (err: any) { 
      alert('Upload failed: ' + err.message)
      setUploading(false)
      return null 
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>, setter: (url: string) => void, docType: string) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_FILE_SIZE) { alert('File too large. Maximum size is 5MB'); return }
    uploadFile(file, docType).then(url => { if (url) setter(url) })
  }

  function openCamera(setter: (url: string) => void, docType: string) {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.capture = 'environment'
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0]
      if (!file) return
      if (file.size > MAX_FILE_SIZE) { alert('File too large. Maximum size is 5MB'); return }
      uploadFile(file, docType).then(url => { if (url) setter(url) })
    }
    input.click()
  }

  async function submit() {
    if (!aadharUrl && !existingAadhar) { setError('Please upload Aadhaar Card'); return }

    setSaving(true)
    const { error: updateError } = await supabase.from('delivery_agents').update({
      aadhar_url: aadharUrl || existingAadhar
    }).eq('id', userId)

    if (updateError) { 
      setError('Failed to save: ' + updateError.message)
      setSaving(false)
      return
    }

    setDone(true)
    setSaving(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 40, height: 40, border: '3px solid #e2e8f0', borderTopColor: '#22c55e', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  useEffect(() => {
    if (done) {
      const timer = setTimeout(() => {
        router.push('/login/status')
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [done, router])

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
        <button onClick={() => router.push('/login/delivery')} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>←</button>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Upload Documents</h2>
      </div>

      <div style={{ maxWidth: 500, margin: '0 auto' }}>
        <div style={{ background: 'white', borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Aadhaar Card * <span style={{ fontSize: '0.75rem', color: '#64748b' }}>(Max 5MB)</span></h3>
          
          <label style={{ display: 'block', cursor: 'pointer' }}>
            <input type="file" accept="image/*" onChange={(e) => handleFileSelect(e, setAadharUrl, 'aadhar')} style={{ display: 'none' }} />
            <div style={{ border: '2px dashed #e2e8f0', borderRadius: 12, padding: 24, textAlign: 'center', background: aadharUrl ? '#f0fdf4' : '#f8fafc' }}>
              {uploading ? (
                <div style={{ color: '#22c55e', fontWeight: 600 }}>Uploading...</div>
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