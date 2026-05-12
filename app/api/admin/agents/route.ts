import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const ADMIN_EMAIL = 'venkatavarun79@gmail.com'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function verifyAdmin(request: NextRequest): Promise<{ error?: string; userId?: string }> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'No authorization header' }
  }
  
  const token = authHeader.substring(7)
  const supabase = getAdminClient()
  
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) {
    return { error: 'Invalid token' }
  }
  
  // Check if admin
  const metaRole = user.user_metadata?.role
  if (metaRole === 'admin' || user.email === ADMIN_EMAIL) {
    return { userId: user.id }
  }
  
  // Check profiles table
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return { error: 'Not authorized' }
  }
  
  return { userId: user.id }
}

// POST — approve | reject | deactivate a delivery agent
export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAdmin(req)
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    const { agentId, action, reason } = await req.json()
    if (!agentId || !action) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const supabase = getAdminClient()

    if (action === 'approve') {
      const { error } = await supabase
        .from('delivery_agents')
        .update({ is_approved: true, is_active: true, rejection_reason: null })
        .eq('id', agentId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      // Send notification
      await supabase.from('notifications').insert({
        user_id: agentId,
        title: '🎉 Application Approved!',
        body: "You can now start accepting deliveries on Varun's Online!",
        type: 'agent_approved'
      }).maybeSingle()

      return NextResponse.json({ success: true })
    }

    if (action === 'reject') {
      if (!reason?.trim()) return NextResponse.json({ error: 'Rejection reason required' }, { status: 400 })
      const { error } = await supabase
        .from('delivery_agents')
        .update({ is_approved: false, is_active: false, rejection_reason: reason.trim() })
        .eq('id', agentId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      await supabase.from('notifications').insert({
        user_id: agentId,
        title: '❌ Application Rejected',
        body: `Your delivery agent application was rejected. Reason: ${reason.trim()}`,
        type: 'agent_rejected'
      }).maybeSingle()

      return NextResponse.json({ success: true })
    }

    if (action === 'deactivate') {
      const { error } = await supabase
        .from('delivery_agents')
        .update({ is_approved: false, is_active: false, rejection_reason: reason || 'Deactivated by admin' })
        .eq('id', agentId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    console.error('Admin agent action error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
