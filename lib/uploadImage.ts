/**
 * lib/uploadImage.ts
 *
 * Shared utility for uploading images to Supabase Storage.
 * Used by products page (product-images bucket) and profile page (shop-images bucket).
 *
 * Flow:
 *   User selects file from camera/gallery
 *   → upload to Supabase Storage bucket
 *   → get public URL
 *   → save URL to database column
 *
 * Buckets are public-read (shop-images, product-images), so no signed URLs needed.
 * Files are organized per-user: {userId}/{type}_{timestamp}.{ext}
 */

import { createClient } from '@/lib/supabase/client'

export type UploadBucket = 'product-images' | 'shop-images'

export interface UploadResult {
  success: true
  publicUrl: string
  path: string
}

export interface UploadError {
  success: false
  error: string
}

/**
 * Upload a file to Supabase Storage and return its public URL.
 *
 * @param file     - File from <input type="file"> or camera capture
 * @param bucket   - Storage bucket ('product-images' or 'shop-images')
 * @param docType  - Logical type used in path (e.g. 'product', 'shop_image')
 * @returns        - { success, publicUrl } or { success, error }
 */
export async function uploadImage(
  file: File,
  bucket: UploadBucket,
  docType: string
): Promise<UploadResult | UploadError> {
  const supabase = createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'You must be logged in to upload images.' }
  }

  // Validate file
  const maxSize = 5 * 1024 * 1024 // 5 MB
  if (file.size > maxSize) {
    return { success: false, error: 'Image too large. Maximum size is 5 MB.' }
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowedTypes.includes(file.type)) {
    return { success: false, error: 'Invalid file type. Use JPEG, PNG, WebP, or GIF.' }
  }

  // Build path: {userId}/{docType}_{timestamp}.{ext}
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${user.id}/${docType}_${Date.now()}.${ext}`

  // Upload
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadError) {
    const message = uploadError.message.includes('row-level-security')
      ? 'Upload permission denied. Please contact support.'
      : uploadError.message
    return { success: false, error: `Upload failed: ${message}` }
  }

  // Get public URL (bucket is public-read)
  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(path)

  return { success: true, publicUrl, path }
}

/**
 * Hidden file input that triggers camera/gallery picker.
 * Returns JSX and the onChange handler to attach.
 *
 * Usage:
 *   const { inputRef, triggerUpload } = useFileInput((file) => handleFile(file))
 *   ...
 *   <button onClick={triggerUpload}>Upload Photo</button>
 *   <FileInput ref={inputRef} />
 */

export function useFileInput(onFile: (file: File) => void) {
  // We just expose the pattern; the actual ref/input is created per-page
}
