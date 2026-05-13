'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ShopkeeperDocumentsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadDocType, setUploadDocType] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  
  const [shopPhotoUrl, setShopPhotoUrl] = useState('')
  const [adhaarFrontUrl, setAdhaarFrontUrl] = useState('')
  const [adhaarBackUrl, setAdhaarBackUrl] = useState('')
  
  const [existingDocs, setExistingDocs] = useState<{type: string, url: string}[]>([])
  const [shopApproved, setShopApproved] = useState(false)
  
  const mountedRef = useRef(false)
  const MAX_FILE_SIZE = 5 * 1024 * 1024
  const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png']

  // Validate file before upload
  function validateFile(file: File): string | null {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Only JPG, JPEG, PNG files are allowed.'
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File too large. Maximum size is 5MB.'
    }
    return null
  }

  useEffect(() => { mountedRef.current = true }, [])

  useEffect(() => {
    async function checkAuth() {
      setLoading(true)
      try {
        // Get current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('Session error:', sessionError)
        }
        
        if (!session) {
          // Try to get user directly
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) {
            alert('Session expired. Please login again.')
            router.push('/login/shopkeeper')
            return
          }
          setUserId(user.id)
        } else {
          setUserId(session.user.id)
        }

        // Get stored ID as fallback
        const storedId = localStorage.getItem('shopkeeper_reg_user_id')
        if (!storedId && !userId) {
          alert('Please complete registration first')
          router.push('/login/shopkeeper/register')
          return
        }
        
        const currentUserId = session?.user?.id || storedId
        
        // Check shop status
        if (currentUserId) {
          const { data: shop } = await supabase
            .from('shops')
            .select('id, is_approved, shop_image_url')
            .eq('owner_id', currentUserId)
            .maybeSingle()
          
          if (shop) {
            if (shop.is_approved) {
              setShopApproved(true)
            }
            if (shop.shop_image_url) {
              setShopPhotoUrl(shop.shop_image_url)
            }
            
            // Check existing documents
            const { data: docs } = await supabase
              .from('shop_documents')
              .select('doc_type, file_url')
              .eq('shop_id', shop.id)
            
            if (docs && docs.length > 0) {
              setExistingDocs(docs.map(d => ({ type: d.doc_type, url: d.file_url })))
              // Pre-fill if exists
              const frontDoc = docs.find(d => d.doc_type === 'aadhar_front')
              const backDoc = docs.find(d => d.doc_type === 'aadhar_back')
              if (frontDoc) setAdhaarFrontUrl(frontDoc.file_url)
              if (backDoc) setAdhaarBackUrl(backDoc.file_url)
            }
          }
        }
      } catch (err) {
        console.error('Auth check error:', err)
      } finally {
        if (mountedRef.current) {
          setLoading(false)
        }
      }
    }
    checkAuth()
  }, [router, supabase, userId])

  async function uploadFile(file: File, docType: string): Promise<string | null> {
    // Validate file first
    const validationError = validateFile(file)
    if (validationError) {
      alert(validationError)
      return null
    }
    
    // Ensure we have a valid authenticated session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) {
      console.error('Session error:', sessionError)
    }
    
    let uploadUserId = session?.user?.id
    
    // If no session, try to refresh or get user
    if (!uploadUserId) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('Session expired. Please login again.')
        router.push('/login/shopkeeper')
        return null
      }
      uploadUserId = user.id
    }

    setUploading(true)
    setUploadDocType(docType)
    
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      
      // Use user ID as folder for secure upload
      const path = `${uploadUserId}/${docType}_${Date.now()}.${ext}`
      console.log('Uploading to path:', path)
      
      const { data, error: uploadError } = await supabase.storage.from('shop-images').upload(path, file, {
        upsert: true,
        contentType: file.type
      })
      
      if (uploadError) {
        console.error('Upload error:', uploadError)
        alert('Upload failed: ' + uploadError.message)
        setUploading(false)
        setUploadDocType('')
        return null 
      }
      
      const { data: { publicUrl } } = supabase.storage.from('shop-images').getPublicUrl(path)
      console.log('Upload success, URL:', publicUrl)
      
      setUploading(false)
      setUploadDocType('')
      return publicUrl
    } catch (err: any) { 
      console.error('Upload exception:', err)
      alert('Upload failed: ' + err.message)
      setUploading(false)
      setUploadDocType('')
      return null 
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>, setter: (url: string) => void, docType: string) {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Client-side validation
    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      setTimeout(() => setError(''), 5000)
      return
    }
    
    uploadFile(file, docType).then(url => { 
      if (url) setter(url) 
    })
  }

  function openCamera(setter: (url: string) => void, docType: string) {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/jpeg,image/jpg,image/png'
    input.capture = 'environment'
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0]
      if (!file) return
      
      // Client-side validation
      const validationError = validateFile(file)
      if (validationError) {
        setError(validationError)
        setTimeout(() => setError(''), 5000)
        return
      }
      
      uploadFile(file, docType).then(url => { 
        if (url) setter(url) 
      })
    }
    input.click()
  }

  async function submit() {
    if (!shopPhotoUrl) { setError('Please upload Shop Photo'); return }
    if (!adhaarFrontUrl) { setError('Please upload Aadhaar Card (Front)'); return }
    if (!adhaarBackUrl) { setError('Please upload Aadhaar Card (Back)'); return }

    setSaving(true)
    setError('')
    
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Session expired. Please login again.')
        setSaving(false)
        return
      }
      
      // Update shop with photo
      const { error: shopUpdateError } = await supabase.from('shops').update({
        shop_image_url: shopPhotoUrl
      }).eq('owner_id', user.id)

      if (shopUpdateError) { 
        console.error('Shop update error:', shopUpdateError)
        setError('Failed to save: ' + shopUpdateError.message)
        setSaving(false)
        return
      }

      // Get shop ID
      const { data: shopData, error: shopFetchError } = await supabase
        .from('shops')
        .select('id')
        .eq('owner_id', user.id)
        .single()
      
      if (shopFetchError || !shopData) {
        setError('Could not find your shop. Please try again.')
        setSaving(false)
        return
      }
      
      // Delete existing documents if any
      await supabase.from('shop_documents').delete().eq('shop_id', shopData.id)
      
      // Save new documents
      const { error: docsError } = await supabase.from('shop_documents').insert([
        { shop_id: shopData.id, doc_type: 'aadhar_front', file_url: adhaarFrontUrl, file_name: 'Aadhaar Front' },
        { shop_id: shopData.id, doc_type: 'aadhar_back', file_url: adhaarBackUrl, file_name: 'Aadhaar Back' }
      ])
      
      if (docsError) {
        console.error('Documents insert error:', docsError)
        setError('Failed to save documents: ' + docsError.message)
        setSaving(false)
        return
      }

      setDone(true)
    } catch (err: any) {
      console.error('Submit error:', err)
      setError('Error: ' + err.message)
    } finally {
      if (mountedRef.current) {
        setSaving(false)
      }
    }
  }

  // Show approval message if shop is already approved
  if (shopApproved) {
    return (
      <div style={{ minHeight: '100vh', padding: 24, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', background: 'white', borderRadius: 20, padding: 32, maxWidth: 400, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>✅</div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Shop Already Approved!</h2>
          <p style={{ color: '#64748b', marginBottom: 24, lineHeight: 1.6 }}>Your shop has been approved and is active.<br/>You can now start selling.</p>
          <button onClick={() => router.push('/login/shopkeeper')} style={{ background: '#f97316', color: 'white', border: 'none', padding: '12px 24px', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>Go to Login</button>
        </div>
      </div>
    )
  }

  if (done) return (
    <div style={{ minHeight: '100vh', padding: 24, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', background: 'white', borderRadius: 20, padding: 32, maxWidth: 400, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>🎉</div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Registration Complete!</h2>
        <p style={{ color: '#64748b', marginBottom: 24, lineHeight: 1.6 }}>Your documents have been uploaded.<br/><br/>Admin will review your application and approve it.<br/>You'll be notified once approved.</p>
        <button onClick={() => {
          localStorage.removeItem('shopkeeper_reg_user_id')
          router.push('/login/shopkeeper')
        }} style={{ background: '#f97316', color: 'white', border: 'none', padding: '12px 24px', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>Go to Login</button>
      </div>
    </div>
  )

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #e2e8f0', borderTopColor: '#f97316', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        <p style={{ color: '#64748b' }}>Loading...</p>
      </div>
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  )

  if (!userId) return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', padding: 20 }}>
        <p style={{ color: '#dc2626', marginBottom: 16 }}>Please complete registration first</p>
        <button onClick={() => router.push('/login/shopkeeper/register')} style={{ padding: '12px 24px', background: '#f97316', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>Start Registration</button>
      </div>
    </div>
  )

  if (done) return (
    <div style={{ minHeight: '100vh', padding: 24, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', background: 'white', borderRadius: 20, padding: 32, maxWidth: 400, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>🎉</div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>Registration Complete!</h2>
        <p style={{ color: '#64748b', marginBottom: 24, lineHeight: 1.6 }}>Your documents have been uploaded.<br/><br/>Admin will review your application and approve it.<br/>You'll be notified once approved.</p>
        <button onClick={() => {
          localStorage.removeItem('shopkeeper_reg_user_id')
          router.push('/login/shopkeeper')
        }} style={{ background: '#f97316', color: 'white', border: 'none', padding: '12px 24px', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>Go to Login</button>
      </div>
    </div>
  )

  if (!userId) return <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '0 16px 40px' }}>
      <div style={{ padding: '20px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.push('/login/shopkeeper/register')} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>←</button>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Upload Documents</h2>
      </div>

      <div style={{ maxWidth: 500, margin: '0 auto' }}>
        {/* Shop Photo */}
        <div style={{ background: 'white', borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Shop Photo *</h3>
          
          <label style={{ display: 'block', cursor: 'pointer' }}>
            <input type="file" accept="image/*" onChange={(e) => handleFileSelect(e, setShopPhotoUrl, 'shop_photo')} style={{ display: 'none' }} />
            <div style={{ border: '2px dashed #e2e8f0', borderRadius: 12, padding: 24, textAlign: 'center', background: shopPhotoUrl ? '#fff7ed' : '#f8fafc' }}>
              {uploading ? (
                <div style={{ color: '#f97316', fontWeight: 600 }}>Uploading...</div>
              ) : shopPhotoUrl ? (
                <div>
                  <img src={shopPhotoUrl} alt="Shop" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 10 }} />
                  <div style={{ color: '#16a34a', fontWeight: 600, fontSize: '0.9rem', marginTop: 8 }}>Tap to change</div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '2rem', marginBottom: 8 }}>📷</div>
                  <div style={{ color: '#374151', fontWeight: 600, fontSize: '0.9rem' }}>Upload Shop Photo</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>Take photo or choose from gallery</div>
                </div>
              )}
            </div>
          </label>
        </div>

        {/* Aadhaar Front */}
        <div style={{ background: 'white', borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Aadhaar Card (Front) *</h3>
          
          <label style={{ display: 'block', cursor: 'pointer' }}>
            <input type="file" accept="image/*" onChange={(e) => handleFileSelect(e, setAdhaarFrontUrl, 'aadhar_front')} style={{ display: 'none' }} />
            <div style={{ border: '2px dashed #e2e8f0', borderRadius: 12, padding: 24, textAlign: 'center', background: adhaarFrontUrl ? '#fff7ed' : '#f8fafc' }}>
              {uploading ? (
                <div style={{ color: '#f97316', fontWeight: 600 }}>Uploading...</div>
              ) : adhaarFrontUrl ? (
                <div>
                  <img src={adhaarFrontUrl} alt="Aadhaar" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 10 }} />
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
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Aadhaar Card (Back) *</h3>
          
          <label style={{ display: 'block', cursor: 'pointer' }}>
            <input type="file" accept="image/*" onChange={(e) => handleFileSelect(e, setAdhaarBackUrl, 'aadhar_back')} style={{ display: 'none' }} />
            <div style={{ border: '2px dashed #e2e8f0', borderRadius: 12, padding: 24, textAlign: 'center', background: adhaarBackUrl ? '#fff7ed' : '#f8fafc' }}>
              {uploading ? (
                <div style={{ color: '#f97316', fontWeight: 600 }}>Uploading...</div>
              ) : adhaarBackUrl ? (
                <div>
                  <img src={adhaarBackUrl} alt="Aadhaar" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 10 }} />
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
          {saving ? 'Saving...' : 'Submit Registration'}
        </button>
      </div>
    </div>
  )
}