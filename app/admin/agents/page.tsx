'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Agent { id: string; is_approved: boolean; vehicle_type: string; wallet_balance: number; total_deliveries: number; created_at: string; profiles: { full_name: string; phone: string; email: string } }

export default function AdminAgents() {
  const supabase = createClient()
  const [agents, setAgents] = useState<Agent[]>([])
  const [tab, setTab] = useState<'pending' | 'active' | 'all'>('pending')

  useEffect(() => { load() }, [tab])

  async function load() {
    let q = supabase.from('delivery_agents').select('*, profiles(full_name, phone, email)').order('created_at', { ascending: false })
    if (tab === 'pending') q = q.eq('is_approved', false)
    else if (tab === 'active') q = q.eq('is_approved', true)
    const { data } = await q
    setAgents(data || [])
  }

  async function approve(agent: Agent) {
    await supabase.from('delivery_agents').update({ is_approved: true, is_active: true }).eq('id', agent.id)
    await supabase.from('notifications').insert({ user_id: agent.id, title: '🎉 Application Approved!', body: 'You can now start accepting deliveries!', type: 'agent_approved' })
    setAgents(prev => prev.filter(a => a.id !== agent.id))
  }

  async function reject(agentId: string) {
    const reason = prompt('Rejection reason?')
    await supabase.from('delivery_agents').update({ is_approved: false, rejection_reason: reason }).eq('id', agentId)
    setAgents(prev => prev.filter(a => a.id !== agentId))
  }

  return (
    <div className="fade-in">
      <h2 style={{ marginBottom: 20 }}>🛵 Delivery Agents</h2>
      <div className="tabs" style={{ marginBottom: 20, maxWidth: 400 }}>
        {(['pending', 'active', 'all'] as const).map(t => <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>)}
      </div>
      <div className="table-container">
        <table className="data-table">
          <thead><tr><th>Name</th><th>Phone</th><th>Vehicle</th><th>Deliveries</th><th>Wallet</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {agents.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40 }}>No agents</td></tr>}
            {agents.map(agent => (
              <tr key={agent.id}>
                <td style={{ fontWeight: 600 }}>{agent.profiles?.full_name || 'N/A'}</td>
                <td>{agent.profiles?.phone}</td>
                <td>{agent.vehicle_type}</td>
                <td>{agent.total_deliveries}</td>
                <td>₹{agent.wallet_balance?.toFixed(0)}</td>
                <td><span className={`badge ${agent.is_approved ? 'badge-green' : 'badge-yellow'}`}>{agent.is_approved ? 'Active' : 'Pending'}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {!agent.is_approved && <><button className="btn btn-success btn-sm" onClick={() => approve(agent)}>✅ Approve</button><button className="btn btn-danger btn-sm" onClick={() => reject(agent.id)}>❌ Reject</button></>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
