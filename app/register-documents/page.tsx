'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function RegisterDocumentsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [userType, setUserType] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  // Shopkeeper fields
  const [shopName, setShopName] = useState('')
  const [shopPhotoUrl, setShopPhotoUrl] = useState('')
  const [adhaarFrontUrl, setAdhaarFrontUrl] = useState('')
  const [adhaarBackUrl, setAdhaarBackUrl] = useState('')

  // Agent fields
  const [aadharUrl, setAadharUrl] = useState('')
  const [licenseUrl, setLicenseUrl] = useState('')

  const MAX_FILE_SIZE = 5 * 1024 * 1024

  useEffect(() => {
    const storedUserType = localStorage.getItem('registration_user_type')
    const storedUserId = localStorage.getItem('registration_user_id')
    
    if (!storedUserType || !storedUserId) {
      alert('Please complete registration first')
      router.push('/register')
      return
    }
    
    setUserType(storedUserType)
    setUserId(storedUserId)
  }, [router])

  async function uploadFile(file: File, bucket: string, docType: string): Promise<string | null> {
    if (!userId) return null
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      
      // For shopkeepers, use shop ID as folder; for agents, use user ID
      let folderId = userId
      if (userType === 'shopkeeper') {
        const { data: shop } = await supabase.from('shops').select('id').eq('owner_id', userId).single()
        if (shop) folderId = shop.id
      }
      // For agents, the folder should be userId (agent ID) - policy checks auth.uid() = folder
      
      const path = `${folderId}/${docType}_${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file)
      
      if (uploadError) { 
        alert('Upload failed: ' + uploadError.message)
        setUploading(false)
        return null 
      }
      
      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path)
      setUploading(false)
      return publicUrl
    } catch (err: any) { 
      alert('Upload failed: ' + err.message)
      setUploading(false)
      return null 
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>, setter: (url: string) => void, docType: string, bucket: string) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_FILE_SIZE) { alert('File too large. Maximum size is 5MB'); return }
    uploadFile(file, bucket, docType).then(url => { if (url) setter(url) })
  }

  function openCamera(setter: (url: string) => void, docType: string, bucket: string) {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.capture = 'environment'
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0]
      if (!file) return
      if (file.size > MAX_FILE_SIZE) { alert('File too large. Maximum size is 5MB'); return }
      uploadFile(file, bucket, docType).then(url => { if (url) setter(url) })
    }
    input.click()
  }

  async function submitShopkeeper() {
    setError('')
    if (!shopPhotoUrl) { setError('Please upload Shop Photo'); return }
    if (!adhaarFrontUrl) { setError('Please upload Aadhaar Card (Front)'); return }
    if (!adhaarBackUrl) { setError('Please upload Aadhaar Card (Back)'); return }

    setSaving(true)

    // Update shop with photo
    const { error: shopUpdateError } = await supabase.from('shops').update({
      shop_image_url: shopPhotoUrl
    }).eq('owner_id', userId)

    if (shopUpdateError) { 
      setError('Failed to save: ' + shopUpdateError.message)
      setSaving(false)
      return
    }

    // Get shop ID
    const { data: shopData } = await supabase.from('shops').select('id').eq('owner_id', userId).single()
    
    if (shopData) {
      // Save documents
      await supabase.from('shop_documents').insert([
        { shop_id: shopData.id, doc_type: 'aadhar_front', file_url: adhaarFrontUrl, file_name: 'Aadhaar Front' },
        { shop_id: shopData.id, doc_type: 'aadhar_back', file_url: adhaarBackUrl, file_name: 'Aadhaar Back' }
      ])
    }

    setDone(true)
    setSaving(false)
  }

  async function submitAgent() {
    setError('')
    if (!aadharUrl) { setError('Please upload Aadhaar Card'); return }
    if (!licenseUrl) { setError('Please upload Driving License'); return }

    setSaving(true)

    // Update agent with documents
    const { error: updateError } = await supabase.from('delivery_agents').update({
      aadhar_url: aadharUrl,
      license_url: licenseUrl
    }).eq('id', userId)

    if (updateError) { 
      setError('Failed to save: ' + updateError.message)
      setSaving(false)
      return
    }

    setDone(true)
    setSaving(false)
  }

  if (done) return (
    <div style={{ minHeight: '100vh', padding: 24, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', background: 'white', borderRadius: 20, padding: 32, maxWidth: 400, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>🎉</div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
          Registration Complete!
        </h2>
        <p style={{ color: '#64748b', marginBottom: 24, lineHeight: 1.6 }}>
          Your documents have been uploaded successfully.<br/><br/>
          Admin will review your application and approve it.<br/>
          You&apos;ll be notified once approved.
        </p>
        <button 
          onClick={() => {
            localStorage.removeItem('registration_user_type')
            localStorage.removeItem('registration_user_id')
            router.push('/login')
          }} 
          style={{ 
            background: userType === 'shopkeeper' ? '#f97316' : '#22c55e', 
            color: 'white', 
            border: 'none', 
            padding: '12px 24px', 
            borderRadius: 10, 
            fontWeight: 700, 
            cursor: 'pointer' 
          }}
        >
          Go to Login
        </button>
      </div>
    </div>
  )

  if (!userType) return <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>

  const color = userType === 'shopkeeper' ? '#f97316' : '#22c55e'

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '0 16px 40px' }}>
      <div style={{ padding: '20px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.push('/register')} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>←</button>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
          Upload Documents - {userType === 'shopkeeper' ? 'Shopkeeper' : 'Delivery Agent'}
        </h2>
      </div>

      {/* 2 Steps Indicator */}
      <div style={{ maxWidth: 500, margin: '0 auto 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'white', padding: '12px 20px', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 24, height: 24, borderRadius: 12, background: '#22c55e', color: 'white', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>1</span>
            <span style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600 }}>Basic Details</span>
          </div>
          <div style={{ width: 30, height: 2, background: '#22c55e' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 24, height: 24, borderRadius: 12, background: '#22c55e', color: 'white', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>2</span>
            <span style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 600 }}>Documents</span>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: 8, fontSize: '0.8rem', color: '#64748b' }}>Step 2 of 2 - Upload Required Documents</div>
      </div>

      <div style={{ maxWidth: 500, margin: '0 auto' }}>
        {userType === 'shopkeeper' ? (
          <>
            {/* Shop Photo */}
            <div style={{ background: 'white', borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Shop Photo *</h3>
              
              <label style={{ display: 'block', cursor: 'pointer' }}>
                <input type="file" accept="image/*" onChange={(e) => handleFileSelect(e, setShopPhotoUrl, 'shop_photo', 'shop-images')} style={{ display: 'none' }} />
                <div style={{ border: '2px dashed #e2e8f0', borderRadius: 12, padding: 24, textAlign: 'center', background: shopPhotoUrl ? '#fff7ed' : '#f8fafc' }}>
                  {uploading ? (
                    <div style={{ color: color, fontWeight: 600 }}>Uploading...</div>
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
                <input type="file" accept="image/*" onChange={(e) => handleFileSelect(e, setAdhaarFrontUrl, 'aadhar_front', 'shop-documents')} style={{ display: 'none' }} />
                <div style={{ border: '2px dashed #e2e8f0', borderRadius: 12, padding: 24, textAlign: 'center', background: adhaarFrontUrl ? '#fff7ed' : '#f8fafc' }}>
                  {uploading ? (
                    <div style={{ color: color, fontWeight: 600 }}>Uploading...</div>
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
                <input type="file" accept="image/*" onChange={(e) => handleFileSelect(e, setAdhaarBackUrl, 'aadhar_back', 'shop-documents')} style={{ display: 'none' }} />
                <div style={{ border: '2px dashed #e2e8f0', borderRadius: 12, padding: 24, textAlign: 'center', background: adhaarBackUrl ? '#fff7ed' : '#f8fafc' }}>
                  {uploading ? (
                    <div style={{ color: color, fontWeight: 600 }}>Uploading...</div>
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
          </>
        ) : (
          <>
            {/* Aadhaar */}
            <div style={{ background: 'white', borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Aadhaar Card *</h3>
              
              <label style={{ display: 'block', cursor: 'pointer' }}>
                <input type="file" accept="image/*" onChange={(e) => handleFileSelect(e, setAadharUrl, 'aadhar', 'agent-documents')} style={{ display: 'none' }} />
                <div style={{ border: '2px dashed #e2e8f0', borderRadius: 12, padding: 24, textAlign: 'center', background: aadharUrl ? '#f0fdf4' : '#f8fafc' }}>
                  {uploading ? (
                    <div style={{ color: color, fontWeight: 600 }}>Uploading...</div>
                  ) : aadharUrl ? (
                    <div>
                      <img src={aadharUrl} alt="Aadhaar" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 10 }} />
                      <div style={{ color: '#16a34a', fontWeight: 600, fontSize: '0.9rem', marginTop: 8 }}>Tap to change</div>
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
            </div>

            {/* License */}
            <div style={{ background: 'white', borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Driving License *</h3>
              
              <label style={{ display: 'block', cursor: 'pointer' }}>
                <input type="file" accept="image/*" onChange={(e) => handleFileSelect(e, setLicenseUrl, 'license', 'agent-documents')} style={{ display: 'none' }} />
                <div style={{ border: '2px dashed #e2e8f0', borderRadius: 12, padding: 24, textAlign: 'center', background: licenseUrl ? '#f0fdf4' : '#f8fafc' }}>
                  {uploading ? (
                    <div style={{ color: color, fontWeight: 600 }}>Uploading...</div>
                  ) : licenseUrl ? (
                    <div>
                      <img src={licenseUrl} alt="License" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 10 }} />
                      <div style={{ color: '#16a34a', fontWeight: 600, fontSize: '0.9rem', marginTop: 8 }}>Tap to change</div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: '2rem', marginBottom: 8 }}>📷</div>
                      <div style={{ color: '#374151', fontWeight: 600, fontSize: '0.9rem' }}>Upload License Photo</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4 }}>Take photo or choose from gallery</div>
                    </div>
                  )}
                </div>
              </label>
            </div>
          </>
        )}

        {error && (
          <div style={{ padding: 14, background: '#fef2f2', borderRadius: 12, color: '#dc2626', fontSize: '0.9rem', fontWeight: 600, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <button 
          onClick={userType === 'shopkeeper' ? submitShopkeeper : submitAgent} 
          disabled={saving || uploading} 
          style={{ 
            width: '100%', 
            padding: '16px', 
            background: saving ? '#94a3b8' : color, 
            color: 'white', 
            border: 'none', 
            borderRadius: 14, 
            fontSize: '1rem', 
            fontWeight: 700, 
            cursor: saving ? 'not-allowed' : 'pointer',
            boxShadow: saving ? 'none' : `0 4px 16px ${color}50`
          }}
        >
          {saving ? 'Saving...' : 'Submit Registration'}
        </button>
      </div>
    </div>
  )
}