import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    // Verify authentication via Bearer token
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const body = await request.json()
    const { userId, aadharUrl, licenseUrl, panUrl, vehicleRcUrl, livePhotoUrl } = body

    // Verify the authenticated user matches the userId being updated
    if (user.id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    }

    // At minimum, Aadhaar is required
    if (!aadharUrl) {
      return NextResponse.json({ error: 'Aadhaar card is required' }, { status: 400 })
    }

    // SECURITY: Validate all URLs are from our own Supabase Storage
    function validateUrl(url: string | null): boolean {
      if (!url) return true // null/undefined is allowed for optional fields
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
      const storagePrefix = supabaseUrl.replace('https://', 'https://') + '/storage/v1/object/'
      return url.startsWith(storagePrefix) || url.includes('/storage/v1/object/')
    }

    const allUrls = [aadharUrl, licenseUrl, panUrl, vehicleRcUrl, livePhotoUrl]
    for (const url of allUrls) {
      if (url && !validateUrl(url)) {
        return NextResponse.json({ error: 'Invalid document URL detected' }, { status: 400 })
      }
      if (url && url.length > 1024) {
        return NextResponse.json({ error: 'URL too long' }, { status: 400 })
      }
    }

    // Use service role to bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Build update object — only set fields that were provided
    const updateData: Record<string, string | null> = {}
    if (aadharUrl !== undefined) updateData.aadhar_url = aadharUrl
    if (licenseUrl !== undefined) updateData.license_url = licenseUrl
    if (panUrl !== undefined) updateData.pan_url = panUrl
    if (vehicleRcUrl !== undefined) updateData.vehicle_rc_url = vehicleRcUrl
    if (livePhotoUrl !== undefined) updateData.live_photo_url = livePhotoUrl

    const { error } = await supabaseAdmin
      .from('delivery_agents')
      .update(updateData)
      .eq('id', userId)

    if (error) {
      console.error('Update error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error('Server error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
