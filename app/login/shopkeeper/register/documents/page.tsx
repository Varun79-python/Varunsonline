'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ShopkeeperDocumentsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  
  const [shopPhotoUrl, setShopPhotoUrl] = useState('')
  const [adhaarFrontUrl, setAdhaarFrontUrl] = useState('')
  const [adhaarBackUrl, setAdhaarBackUrl] = useState('')
  const [existingShopPhoto, setExistingShopPhoto] = useState('')
  const [error, setError] = useState('')

  const MAX_FILE_SIZE = 5 * 1024 * 1024

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('Please login first')
        router.push('/login/shopkeeper')
        return
      }
      
      const { data: shop } = await supabase
        .from('shops')
        .select('id, is_approved, shop_image_url')
        .eq('owner_id', user.id)
        .single()
      
      if (!shop) {
        alert('Please complete registration first')
        router.push('/shopkeeper/register')
        return
      }
      
      if (shop.is_approved) {
        router.push('/shopkeeper')
        return
      }
      
      setUserId(user.id)
      setExistingShopPhoto(shop.shop_image_url || '')
      
      // Check existing documents
      const { data: docs } = await supabase
        .from('shop_documents')
        .select('doc_type, file_url')
        .eq('shop_id', shop.id)
      
      if (docs) {
        const frontDoc = docs.find((d: { doc_type: string }) => d.doc_type === 'aadhar_front')
        const backDoc = docs.find((d: { doc_type: string }) => d.doc_type === 'aadhar_back')
        if (frontDoc) setAdhaarFrontUrl(frontDoc.file_url)
        if (backDoc) setAdhaarBackUrl(backDoc.file_url)
      }
      
      setLoading(false)
    }
    checkAuth()
  }, [router, supabase])

  async function uploadFile(file: File, docType: string): Promise<string | null> {
    if (!userId) return null
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const bucket = docType === 'shop_photo' ? 'shop-images' : 'shop-documents'
      const path = `${userId}/${docType}_${Date.now()}.${ext}`
      
      const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file)
      if (uploadError) { 
        console.error('Upload error:', uploadError)
        alert('Upload failed: ' + uploadError.message)
        setUploading(false)
        return null 
      }
      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path)
      setUploading(false)
      return publicUrl
    } catch (err: any) { 
      console.error('Upload exception:', err)
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
    if (!adhaarFrontUrl) { setError('Please upload Aadhaar Card (Front)'); return }
    if (!adhaarBackUrl) { setError('Please upload Aadhaar Card (Back)'); return }

    setSaving(true)
    setError('')
    
    try {
      // Get shop ID
      const { data: shop } = await supabase.from('shops').select('id').eq('owner_id', userId).single()
      if (!shop) { setError('Shop not found'); setSaving(false); return }

      // Upload shop photo if not exists
      let finalShopPhotoUrl = existingShopPhoto
      if (!finalShopPhotoUrl && shopPhotoUrl) {
        finalShopPhotoUrl = shopPhotoUrl
        await supabase.from('shops').update({ shop_image_url: shopPhotoUrl }).eq('owner_id', userId)
      }

      // Delete old documents and insert new
      await supabase.from('shop_documents').delete().eq('shop_id', shop.id)
      
      const { error: docsError } = await supabase.from('shop_documents').insert([
        { shop_id: shop.id, doc_type: 'aadhar_front', file_url: adhaarFrontUrl, file_name: 'Aadhaar Front' },
        { shop_id: shop.id, doc_type: 'aadhar_back', file_url: adhaarBackUrl, file_name: 'Aadhaar Back' }
      ])

      if (docsError) {
        console.error('Documents error:', docsError)
        setError('Failed to save documents: ' + docsError.message)
        setSaving(false)
        return
      }

      setDone(true)
    } catch (err: any) {
      console.error('Submit error:', err)
      setError('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 40, height: 40, border: '3px solid #e2e8f0', borderTopColor: '#f97316', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  if (done) return (
    <div style={{ minHeight: '100vh', padding: 24, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', background: 'white', borderRadius: 20, padding: 32, maxWidth: 400, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>🎉</div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Documents Submitted!</h2>
        <p style={{ color: '#64748b', marginBottom: 24, lineHeight: 1.6 }}>Your documents have been uploaded.<br/><br/>Admin will review your application and approve it.</p>
        <button onClick={() => router.push('/login/status')} style={{ background: '#f97316', color: 'white', border: 'none', padding: '12px 24px', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>Check Status</button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '0 16px 40px' }}>
      <div style={{ padding: '20px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.push('/login/shopkeeper')} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>←</button>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Step 2: Upload Documents</h2>
      </div>

      <div style={{ maxWidth: 500, margin: '0 auto' }}>
        {/* Aadhaar Front */}
        <div style={{ background: 'white', borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Aadhaar Card (Front) * <span style={{ fontSize: '0.75rem', color: '#64748b' }}>(Max 5MB)</span></h3>
          
          <label style={{ display: 'block', cursor: 'pointer' }}>
            <input type="file" accept="image/*" onChange={(e) => handleFileSelect(e, setAdhaarFrontUrl, 'aadhar_front')} style={{ display: 'none' }} />
            <div style={{ border: '2px dashed #e2e8f0', borderRadius: 12, padding: 24, textAlign: 'center', background: adhaarFrontUrl ? '#fff7ed' : '#f8fafc' }}>
              {uploading ? (
                <div style={{ color: '#f97316', fontWeight: 600 }}>Uploading...</div>
              ) : adhaarFrontUrl ? (
                <div>
                  <img src={adhaarFrontUrl} alt="Aadhaar Front" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 10 }} />
                  <div style={{ color: '#16a34a', fontWeight: 600, fontSize: '0.9rem', marginTop: 8 }}>Tap to change</div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '2rem', marginBottom: 8 }}>📷</div>
                  <div style={{ color: '#374151', fontWeight: 600, fontSize: '0.9rem' }}>Upload Aadhaar Front</div>
                </div>
              )}
            </div>
          </label>
        </div>

        {/* Aadhaar Back */}
        <div style={{ background: 'white', borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Aadhaar Card (Back) * <span style={{ fontSize: '0.75rem', color: '#64748b' }}>(Max 5MB)</span></h3>
          
          <label style={{ display: 'block', cursor: 'pointer' }}>
            <input type="file" accept="image/*" onChange={(e) => handleFileSelect(e, setAdhaarBackUrl, 'aadhar_back')} style={{ display: 'none' }} />
            <div style={{ border: '2px dashed #e2e8f0', borderRadius: 12, padding: 24, textAlign: 'center', background: adhaarBackUrl ? '#fff7ed' : '#f8fafc' }}>
              {uploading ? (
                <div style={{ color: '#f97316', fontWeight: 600 }}>Uploading...</div>
              ) : adhaarBackUrl ? (
                <div>
                  <img src={adhaarBackUrl} alt="Aadhaar Back" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 10 }} />
                  <div style={{ color: '#16a34a', fontWeight: 600, fontSize: '0.9rem', marginTop: 8 }}>Tap to change</div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '2rem', marginBottom: 8 }}>📷</div>
                  <div style={{ color: '#374151', fontWeight: 600, fontSize: '0.9rem' }}>Upload Aadhaar Back</div>
                </div>
              )}
            </div>
          </label>
        </div>

        {error && (
          <div style={{ padding: 14, background: '#fef2f2', borderRadius: 12, color: '#dc2626', fontSize: '0.9rem', fontWeight: 600, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <button 
          onClick={submit} 
          disabled={saving || uploading} 
          style={{ width: '100%', padding: '16px', background: saving ? '#94a3b8' : '#f97316', color: 'white', border: 'none', borderRadius: 14, fontSize: '1rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', boxShadow: saving ? 'none' : '0 4px 16px rgba(249,115,22,0.3)' }}
        >
          {saving ? 'Saving...' : 'Submit Documents'}
        </button>
      </div>
    </div>
  )
}