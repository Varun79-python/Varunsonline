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

  // Shopkeeper fields
  const [shopName, setShopName] = useState('')
  const [shopPhotoUrl, setShopPhotoUrl] = useState('')
  const [adhaarFrontUrl, setAdhaarFrontUrl] = useState('')
  const [adhaarBackUrl, setAdhaarBackUrl] = useState('')

  // Agent fields
  const [aadharUrl, setAadharUrl] = useState('')
  const [licenseUrl, setLicenseUrl] = useState('')
  const [vehicleType, setVehicleType] = useState('')
  const [vehicleNumber, setVehicleNumber] = useState('')

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
    setUploading(true)
    try {
      if (!userId) { setUploading(false); return null }
      
      const ext = file.name.split('.').pop()
      const fileName = `${userId}/${docType}_${Date.now()}.${ext}`
      const { data, error } = await supabase.storage.from(bucket).upload(fileName, file)
      
      if (error) { 
        alert('Upload failed: ' + error.message); 
        setUploading(false); 
        return null 
      }
      
      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(fileName)
      setUploading(false)
      return publicUrl
    } catch (err: any) { 
      alert('Upload failed: ' + err.message); 
      setUploading(false); 
      return null 
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>, setter: (url: string) => void) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_FILE_SIZE) { alert('File too large. Maximum size is 5MB'); return }
    
    const bucket = userType === 'shopkeeper' ? 'shop-images' : 'agent-documents'
    const docType = setter.name // This won't work, let me fix
    
    uploadFile(file, bucket, 'doc').then(url => { 
      if (url) setter(url) 
    })
  }

  function openCamera(field: string) {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.capture = 'environment'
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0]
      if (!file) return
      if (file.size > MAX_FILE_SIZE) { alert('File too large. Maximum size is 5MB'); return }
      
      const bucket = userType === 'shopkeeper' ? 'shop-images' : 'agent-documents'
      
      uploadFile(file, bucket, field).then(url => {
        if (url) {
          switch(field) {
            case 'shop_photo': setShopPhotoUrl(url); break
            case 'adhaar_front': setAdhaarFrontUrl(url); break
            case 'adhaar_back': setAdhaarBackUrl(url); break
            case 'aadhar': setAadharUrl(url); break
            case 'license': setLicenseUrl(url); break
          }
        }
      })
    }
    input.click()
  }

  async function submitShopkeeper() {
    if (!shopName.trim()) { alert('Please enter Shop Name'); return }
    if (!shopPhotoUrl) { alert('Please upload Shop Photo'); return }
    if (!adhaarFrontUrl) { alert('Please upload Aadhaar Card (Front)'); return }
    if (!adhaarBackUrl) { alert('Please upload Aadhaar Card (Back)'); return }

    setSaving(true)

    // Create shop record
    const { data: shopData, error: shopError } = await supabase.from('shops').insert({
      owner_id: userId,
      name: shopName.trim(),
      shop_image_url: shopPhotoUrl,
      is_approved: false,
      is_active: false,
    }).select().single()

    if (shopError) { alert(shopError.message); setSaving(false); return }

    // Save documents
    await supabase.from('shop_documents').insert([
      { shop_id: shopData.id, doc_type: 'aadhar_front', file_url: adhaarFrontUrl, file_name: 'Aadhaar Front' },
      { shop_id: shopData.id, doc_type: 'aadhar_back', file_url: adhaarBackUrl, file_name: 'Aadhaar Back' }
    ])

    setDone(true)
    setSaving(false)
  }

  async function submitAgent() {
    if (!aadharUrl) { alert('Please upload Aadhaar Card'); return }
    if (!licenseUrl) { alert('Please upload Driving License'); return }
    if (!vehicleType) { alert('Please select Vehicle Type'); return }
    if (!vehicleNumber.trim()) { alert('Please enter Vehicle Number'); return }

    setSaving(true)

    // Create delivery agent record
    const { error: agentError } = await supabase.from('delivery_agents').insert({
      id: userId,
      aadhar_url: aadharUrl,
      license_url: licenseUrl,
      vehicle_type: vehicleType,
      vehicle_number: vehicleNumber.trim(),
      is_approved: false,
      is_active: false,
    })

    if (agentError) { alert(agentError.message); setSaving(false); return }

    setDone(true)
    setSaving(false)
  }

  if (done) return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ textAlign: 'center', background: 'white', padding: 40, borderRadius: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
        <div style={{ fontSize: '4rem', marginBottom: 16 }}>✅</div>
        <h2 style={{ marginBottom: 12, fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>Registration Submitted!</h2>
        <p style={{ color: '#64748b', marginBottom: 24, lineHeight: 1.6 }}>
          Your {userType === 'shopkeeper' ? 'shop' : 'delivery agent'} account is pending admin approval.<br />You can check your approval status after logging in.
        </p>
        <button onClick={() => {
          localStorage.removeItem('registration_user_type')
          localStorage.removeItem('registration_user_id')
          router.push('/login')
        }} style={{ padding: '12px 32px', background: '#f97316', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
          Go to Login
        </button>
      </div>
    </div>
  )

  if (!userType) return <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '24px 16px' }}>
      <div style={{ maxWidth: 500, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>📄</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>Upload Documents</h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>{userType === 'shopkeeper' ? 'Shop Details & Verification' : 'Agent Verification'}</p>
        </div>

        {/* Progress */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32, gap: 8 }}>
          <div style={{ width: 40, height: 6, borderRadius: 3, background: '#f97316' }} />
          <div style={{ width: 40, height: 6, borderRadius: 3, background: '#f97316' }} />
        </div>

        <div style={{ background: 'white', borderRadius: 16, padding: 24, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
          {userType === 'shopkeeper' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Shop Name *</label>
                <input 
                  value={shopName} 
                  onChange={e => setShopName(e.target.value)} 
                  placeholder="e.g. Ravi General Store" 
                  style={{ width: '100%', padding: '14px 16px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box' }} 
                />
              </div>

              {/* Shop Photo */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Shop Photo * <span style={{ color: '#64748b', fontWeight: 400 }}>(Max 5MB)</span></label>
                {shopPhotoUrl ? (
                  <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', marginBottom: 8 }}>
                    <img src={shopPhotoUrl} alt="Shop" style={{ width: '100%', height: 200, objectFit: 'cover' }} />
                    <button onClick={() => setShopPhotoUrl('')} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: 20, width: 28, height: 28, cursor: 'pointer' }}>✕</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <label style={{ flex: 1, padding: 20, border: '2px dashed #e2e8f0', borderRadius: 12, textAlign: 'center', cursor: 'pointer', background: '#f8fafc' }}>
                      <input type="file" accept="image/*" onChange={(e) => handleFileSelect(e, setShopPhotoUrl)} style={{ display: 'none' }} />
                      <div style={{ fontSize: '2rem', marginBottom: 4 }}>📁</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Upload</div>
                    </label>
                    <button onClick={() => openCamera('shop_photo')} style={{ flex: 1, padding: 20, border: '2px dashed #e2e8f0', borderRadius: 12, textAlign: 'center', cursor: 'pointer', background: '#f8fafc' }}>
                      <div style={{ fontSize: '2rem', marginBottom: 4 }}>📷</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Camera</div>
                    </button>
                  </div>
                )}
              </div>

              {/* Aadhaar Front */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Aadhaar Card (Front) *</label>
                {adhaarFrontUrl ? (
                  <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', marginBottom: 8 }}>
                    <img src={adhaarFrontUrl} alt="Aadhaar" style={{ width: '100%', height: 150, objectFit: 'cover' }} />
                    <button onClick={() => setAdhaarFrontUrl('')} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: 20, width: 28, height: 28, cursor: 'pointer' }}>✕</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <label style={{ flex: 1, padding: 16, border: '2px dashed #e2e8f0', borderRadius: 12, textAlign: 'center', cursor: 'pointer', background: '#f8fafc' }}>
                      <input type="file" accept="image/*" onChange={(e) => handleFileSelect(e, setAdhaarFrontUrl)} style={{ display: 'none' }} />
                      <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>📁</div>
                    </label>
                    <button onClick={() => openCamera('adhaar_front')} style={{ flex: 1, padding: 16, border: '2px dashed #e2e8f0', borderRadius: 12, textAlign: 'center', cursor: 'pointer', background: '#f8fafc' }}>
                      <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>📷</div>
                    </button>
                  </div>
                )}
              </div>

              {/* Aadhaar Back */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Aadhaar Card (Back) *</label>
                {adhaarBackUrl ? (
                  <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', marginBottom: 8 }}>
                    <img src={adhaarBackUrl} alt="Aadhaar" style={{ width: '100%', height: 150, objectFit: 'cover' }} />
                    <button onClick={() => setAdhaarBackUrl('')} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: 20, width: 28, height: 28, cursor: 'pointer' }}>✕</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <label style={{ flex: 1, padding: 16, border: '2px dashed #e2e8f0', borderRadius: 12, textAlign: 'center', cursor: 'pointer', background: '#f8fafc' }}>
                      <input type="file" accept="image/*" onChange={(e) => handleFileSelect(e, setAdhaarBackUrl)} style={{ display: 'none' }} />
                      <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>📁</div>
                    </label>
                    <button onClick={() => openCamera('adhaar_back')} style={{ flex: 1, padding: 16, border: '2px dashed #e2e8f0', borderRadius: 12, textAlign: 'center', cursor: 'pointer', background: '#f8fafc' }}>
                      <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>📷</div>
                    </button>
                  </div>
                )}
              </div>

              <button onClick={submitShopkeeper} disabled={saving || uploading} style={{ padding: 16, background: saving ? '#94a3b8' : '#f97316', color: 'white', border: 'none', borderRadius: 12, fontSize: '1rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Submitting...' : '📝 Submit for Approval'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Aadhaar */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Aadhaar Card *</label>
                {aadharUrl ? (
                  <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', marginBottom: 8 }}>
                    <img src={aadharUrl} alt="Aadhaar" style={{ width: '100%', height: 150, objectFit: 'cover' }} />
                    <button onClick={() => setAadharUrl('')} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: 20, width: 28, height: 28, cursor: 'pointer' }}>✕</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <label style={{ flex: 1, padding: 16, border: '2px dashed #e2e8f0', borderRadius: 12, textAlign: 'center', cursor: 'pointer', background: '#f8fafc' }}>
                      <input type="file" accept="image/*" onChange={(e) => handleFileSelect(e, setAadharUrl)} style={{ display: 'none' }} />
                      <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>📁</div>
                    </label>
                    <button onClick={() => openCamera('aadhar')} style={{ flex: 1, padding: 16, border: '2px dashed #e2e8f0', borderRadius: 12, textAlign: 'center', cursor: 'pointer', background: '#f8fafc' }}>
                      <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>📷</div>
                    </button>
                  </div>
                )}
              </div>

              {/* License */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Driving License *</label>
                {licenseUrl ? (
                  <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', marginBottom: 8 }}>
                    <img src={licenseUrl} alt="License" style={{ width: '100%', height: 150, objectFit: 'cover' }} />
                    <button onClick={() => setLicenseUrl('')} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: 20, width: 28, height: 28, cursor: 'pointer' }}>✕</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <label style={{ flex: 1, padding: 16, border: '2px dashed #e2e8f0', borderRadius: 12, textAlign: 'center', cursor: 'pointer', background: '#f8fafc' }}>
                      <input type="file" accept="image/*" onChange={(e) => handleFileSelect(e, setLicenseUrl)} style={{ display: 'none' }} />
                      <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>📁</div>
                    </label>
                    <button onClick={() => openCamera('license')} style={{ flex: 1, padding: 16, border: '2px dashed #e2e8f0', borderRadius: 12, textAlign: 'center', cursor: 'pointer', background: '#f8fafc' }}>
                      <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>📷</div>
                    </button>
                  </div>
                )}
              </div>

              {/* Vehicle Type */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Vehicle Type *</label>
                <select 
                  value={vehicleType} 
                  onChange={e => setVehicleType(e.target.value)}
                  style={{ width: '100%', padding: '14px 16px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', background: 'white', boxSizing: 'border-box' }}
                >
                  <option value="">Select Vehicle Type</option>
                  <option value="bike">Bike</option>
                  <option value="scooter">Scooter</option>
                  <option value="car">Car</option>
                  <option value="auto">Auto</option>
                </select>
              </div>

              {/* Vehicle Number */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Vehicle Number *</label>
                <input 
                  value={vehicleNumber} 
                  onChange={e => setVehicleNumber(e.target.value)} 
                  placeholder="e.g. TN 01 AB 1234" 
                  style={{ width: '100%', padding: '14px 16px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.95rem', boxSizing: 'border-box' }} 
                />
              </div>

              <button onClick={submitAgent} disabled={saving || uploading} style={{ padding: 16, background: saving ? '#94a3b8' : '#f97316', color: 'white', border: 'none', borderRadius: 12, fontSize: '1rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Submitting...' : '📝 Submit for Approval'}
              </button>
            </div>
          )}

          {uploading && <div style={{ textAlign: 'center', padding: 10, color: '#f97316' }}>⏳ Uploading...</div>}
        </div>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button onClick={() => router.push('/register')} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.9rem', cursor: 'pointer' }}>← Back to Basic Info</button>
        </div>
      </div>
    </div>
  )
}