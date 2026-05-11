import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const admin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST — approve | reject | deactivate a delivery agent
export async function POST(req: NextRequest) {
  try {
    const { agentId, action, reason } = await req.json()
    if (!agentId || !action) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const supabase = admin()

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
