/**
 * lib/uploadImage.ts
 *
 * Shared utility for uploading images to Supabase Storage.
 * Used by products page (product-images bucket) and profile page (shop-images bucket).
 *
 * Flow:
 *   User selects file from camera/gallery
 *   → upload to Supabase Storage bucket (folder = shop-id)
 *   → get public URL
 *   → save URL to database column
 *
 * Path convention:
 *   {bucket}/{shopId}/{docType}[_{itemLabel}]_{timestamp}.{ext}
 *
 * Examples:
 *   shop-images/{shopId}/shop_image_1717000000000.jpg
 *   product-images/{shopId}/product_Fresh_Bread_1717000000000.jpg
 *
 * Buckets are public-read (shop-images, product-images), so no signed URLs needed.
 */

import { createClient } from '@/modules/infrastructure/supabase/client'

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

/** Sanitize a string for safe use in file paths. */
function sanitize(label: string): string {
  return label
    .replace(/[^a-zA-Z0-9_-]/g, '_')   // replace unsafe chars with underscore
    .replace(/_+/g, '_')                // collapse consecutive underscores
    .replace(/^_|_$/g, '')              // trim leading/trailing underscores
    .substring(0, 60)                   // cap length
}

/**
 * Upload a file to Supabase Storage and return its public URL.
 *
 * @param file      - File from <input type="file"> or camera capture
 * @param bucket    - Storage bucket ('product-images' or 'shop-images')
 * @param docType   - Logical type used in path (e.g. 'product', 'shop_image')
 * @param folderId  - Folder (shop UUID) inside the bucket. Falls back to user.id if omitted.
 * @param itemLabel - Optional human-readable label (e.g. product name) included in filename.
 * @returns         - { success, publicUrl, path } or { success, error }
 */
export async function uploadImage(
  file: File,
  bucket: UploadBucket,
  docType: string,
  folderId?: string,
  itemLabel?: string
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

  // Build path: {folderId}/{docType}[_{itemLabel}]_{timestamp}.{ext}
  const folder = folderId || user.id
  const ext = file.name.split('.').pop() || 'jpg'
  const label = itemLabel ? `_${sanitize(itemLabel)}` : ''
  const path = `${folder}/${docType}${label}_${Date.now()}.${ext}`

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
