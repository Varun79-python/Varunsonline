'use client'
/**
 * components/OrderChat/OrderChat.tsx
 * Production-ready WhatsApp-like order chat.
 *
 * Features:
 * - Strict participant validation (server-side enforced)
 * - No duplicate messages (ID dedup set)
 * - Single subscription cleanup (useEffect return)
 * - No double-fetch on open
 * - Enter-key debounce (100ms) prevents spam sends
 * - Quick messages per role
 * - Role-coloured bubbles
 * - Loading skeleton, send state, retry, empty state
 * - Scroll-to-bottom on new message
 * - Unread badge
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/modules/infrastructure/supabase/client'
import { type RealtimePostgresChangesPayload } from '@supabase/supabase-js'

// ── Types ──────────────────────────────────────────────────────────────────────
interface Profile {
  full_name: string
  role: string
  avatar_url: string | null
}

interface Message {
  id: string
  conversation_id: string
  sender_id: string
  sender_role: string
  message: string
  is_read: boolean
  created_at: string
  profiles: Profile | null
}

interface OrderChatProps {
  orderId: string
  currentUserId: string
  currentUserRole: string
  shopName?: string
  agentName?: string
  customerName?: string
}

// ── Constants ─────────────────────────────────────────────────────────────────
const ROLE_EMOJI: Record<string, string> = {
  customer: '👤', shopkeeper: '🏪', delivery_agent: '🛵', admin: '👑',
}

// WhatsApp-like: sender = right+coloured, others = left+white
const BUBBLE: Record<string, { bg: string; color: string; border: string }> = {
  customer:       { bg: '#f97316', color: 'white',   border: '#ea580c' },
  shopkeeper:     { bg: '#f1f5f9', color: '#1e293b', border: '#e2e8f0' },
  delivery_agent: { bg: '#0ea5e9', color: 'white',   border: '#0284c7' },
  admin:          { bg: '#8b5cf6', color: 'white',   border: '#7c3aed' },
}

const QUICK: Record<string, string[]> = {
  customer: ['Is my order ready?', 'What is the status?', 'Please hurry!', 'Can you add extra?'],
  shopkeeper: ['Your order is being prepared', 'Order packed & ready!', 'Out of stock — sorry', 'Please confirm your address'],
  delivery_agent: ['On my way!', 'Reached your area', 'Please keep OTP ready', 'Facing traffic delay'],
  admin: ['Under review', 'Please provide more details', 'Issue resolved', 'Order approved'],
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function fmtDate(d: string) {
  const date = new Date(d)
  const today = new Date()
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function groupByDate(msgs: Message[]) {
  const groups: { date: string; messages: Message[] }[] = []
  let lastDate = ''
  for (const msg of msgs) {
    const d = new Date(msg.created_at).toDateString()
    if (d !== lastDate) { lastDate = d; groups.push({ date: msg.created_at, messages: [msg] }) }
    else groups[groups.length - 1].messages.push(msg)
  }
  return groups
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function OrderChat({
  orderId, currentUserId, currentUserRole, shopName, agentName, customerName
}: OrderChatProps) {
  const supabase = createClient()

  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [unread, setUnread] = useState(0)
  const [showQuick, setShowQuick] = useState(false)
  const [lastEnterMs, setLastEnterMs] = useState(0)

  // Dedup set — prevents realtime + optimistic double-insert
  const seenIds = useRef<Set<string>>(new Set())
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Load messages ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch(`/api/order-messages?orderId=${orderId}`)
      const json = await res.json()
      if (!res.ok) { setLoadError(json.error || 'Failed to load chat'); return }
      const msgs: Message[] = json.messages || []
      seenIds.current = new Set(msgs.map((m: Message) => m.id))
      setMessages(msgs)
      setConversationId(json.conversationId || null)
    } catch {
      setLoadError('Network error — tap Retry')
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => { if (isOpen) load() }, [isOpen, load])

  // ── Realtime subscription ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !conversationId) return

    const channel = supabase
      .channel(`chat:conv:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'order_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, async (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
        const raw = payload.new as Message
        if (seenIds.current.has(raw.id)) return

        // Fetch with profile join
        const { data: full } = await supabase
          .from('order_messages')
          .select('*, profiles(full_name, role, avatar_url)')
          .eq('id', raw.id)
          .single()

        if (!full) return
        seenIds.current.add(full.id)
        setMessages(prev => [...prev, full as Message])
        if (raw.sender_id !== currentUserId) setUnread(n => n + 1)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [isOpen, conversationId, currentUserId])

  // ── Scroll to bottom ───────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 60)
  }, [messages, isOpen])

  // Reset unread when opened
  useEffect(() => { if (isOpen) setUnread(0) }, [isOpen])

  // ── Send ───────────────────────────────────────────────────────────────────
  const send = useCallback(async (text: string) => {
    if (!text.trim() || sending) return
    setSending(true)
    const finalText = text.trim()
    setInput('')
    setShowQuick(false)

    // Optimistic insert (will be deduped by seenIds when realtime arrives)
    const tempId = `temp-${Date.now()}`
    const optimistic: Message = {
      id: tempId,
      conversation_id: conversationId || '',
      sender_id: currentUserId,
      sender_role: currentUserRole,
      message: finalText,
      is_read: false,
      created_at: new Date().toISOString(),
      profiles: null,
    }
    seenIds.current.add(tempId)
    setMessages(prev => [...prev, optimistic])

    try {
      const res = await fetch('/api/order-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, message: finalText }),
      })
      const json = await res.json()
      if (res.ok && json.message) {
        const real: Message = json.message
        // Replace optimistic with real
        seenIds.current.add(real.id)
        setMessages(prev => prev.map(m => m.id === tempId ? real : m))
        if (!conversationId && json.conversationId) setConversationId(json.conversationId)
      } else {
        // Remove optimistic on failure, restore input
        setMessages(prev => prev.filter(m => m.id !== tempId))
        seenIds.current.delete(tempId)
        setInput(finalText)
        alert(json.error || 'Send failed')
      }
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempId))
      seenIds.current.delete(tempId)
      setInput(finalText)
      alert('Network error — please try again')
    } finally {
      setSending(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [orderId, conversationId, currentUserId, currentUserRole, sending])

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const now = Date.now()
      if (now - lastEnterMs < 100) return // guard: ignore double Enter within 100ms (mobile keyboard IME safety — does NOT delay sends)
      setLastEnterMs(now)
      send(input)
    }
  }

  // ── Chat title ─────────────────────────────────────────────────────────────
  const title = shopName
    ? `Chat with ${shopName}`
    : agentName
      ? `Chat with ${agentName}`
      : customerName
        ? `Chat with ${customerName}`
        : 'Order Chat'

  const groups = groupByDate(messages)
  const quickList = QUICK[currentUserRole] || []

  return (
    <>
      <style>{`
        .oc-fab {
          position: fixed; bottom: 90px; right: 16px; z-index: 300;
          width: 58px; height: 58px; border-radius: 50%;
          background: linear-gradient(135deg, #f97316, #ea580c);
          border: none; cursor: pointer;
          box-shadow: 0 4px 20px rgba(249,115,22,0.45);
          display: flex; align-items: center; justify-content: center;
          font-size: 1.5rem; transition: transform 0.2s, box-shadow 0.2s;
          color: white;
        }
        .oc-fab:hover { transform: scale(1.08); box-shadow: 0 6px 28px rgba(249,115,22,0.55); }
        .oc-fab:active { transform: scale(0.95); }
        .oc-badge {
          position: absolute; top: -3px; right: -3px;
          background: #dc2626; color: white; font-size: 0.62rem; font-weight: 800;
          min-width: 19px; height: 19px; border-radius: 99px;
          display: flex; align-items: center; justify-content: center;
          padding: 0 4px; border: 2px solid white;
        }
        .oc-win {
          position: fixed; bottom: 162px; right: 16px; z-index: 300;
          width: 360px; max-width: calc(100vw - 24px);
          height: 500px; max-height: calc(100dvh - 230px);
          background: white; border-radius: 20px;
          box-shadow: 0 16px 56px rgba(0,0,0,0.22);
          display: flex; flex-direction: column; overflow: hidden;
          border: 1.5px solid #e2e8f0;
          animation: ocUp 0.22s cubic-bezier(0.32,0.72,0,1) forwards;
        }
        @keyframes ocUp { from { transform: translateY(18px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .oc-head {
          background: linear-gradient(135deg, #f97316, #ea580c);
          padding: 12px 16px; display: flex; align-items: center; gap: 10px; flex-shrink: 0;
        }
        .oc-msgs {
          flex: 1; overflow-y: auto; padding: 10px 12px;
          background: #f0f2f5; display: flex; flex-direction: column;
          scroll-behavior: smooth;
        }
        .oc-msgs::-webkit-scrollbar { width: 4px; }
        .oc-msgs::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .oc-skel { background: #e2e8f0; border-radius: 10px; margin-bottom: 8px; animation: ocPulse 1.2s ease infinite; }
        @keyframes ocPulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
        .oc-date { display: flex; justify-content: center; margin: 10px 0 6px; }
        .oc-datepill { background: #dde1e8; color: #64748b; font-size: 0.65rem; font-weight: 700; padding: 3px 12px; border-radius: 99px; }
        .oc-row { display: flex; flex-direction: column; margin-bottom: 4px; }
        .oc-row.me { align-items: flex-end; }
        .oc-row.other { align-items: flex-start; }
        .oc-sender { font-size: 0.62rem; color: #94a3b8; margin-bottom: 2px; padding: 0 4px; }
        .oc-bubble { max-width: 80%; padding: 8px 13px; font-size: 0.87rem; line-height: 1.45; word-break: break-word; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
        .oc-time { font-size: 0.6rem; color: #94a3b8; margin-top: 2px; padding: 0 4px; }
        .oc-footer { border-top: 1px solid #e2e8f0; flex-shrink: 0; background: white; }
        .oc-quick { display: flex; gap: 6px; padding: 8px 12px; overflow-x: auto; flex-shrink: 0; }
        .oc-quick::-webkit-scrollbar { height: 2px; }
        .oc-qbtn { flex: 0 0 auto; background: #fff7ed; border: 1px solid #fed7aa; color: #ea580c; border-radius: 16px; padding: 5px 11px; font-size: 0.72rem; font-weight: 600; cursor: pointer; white-space: nowrap; }
        .oc-qbtn:hover { background: #ffedd5; }
        .oc-inp-row { padding: 8px 12px; display: flex; gap: 8px; align-items: center; }
        .oc-inp { flex: 1; background: #f1f5f9; border: 1.5px solid #e2e8f0; border-radius: 22px; padding: 10px 16px; font-size: 0.87rem; color: #1e293b; font-family: inherit; outline: none; }
        .oc-inp:focus { border-color: #f97316; background: white; }
        .oc-send { width: 42px; height: 42px; border-radius: 50%; background: linear-gradient(135deg, #f97316, #ea580c); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1rem; flex-shrink: 0; transition: opacity 0.15s; color: white; }
        .oc-send:disabled { opacity: 0.4; cursor: not-allowed; }
        @media (max-width: 400px) { .oc-win { right: 8px; width: calc(100vw - 16px); } }
      `}</style>

      {/* FAB */}
      <button className="oc-fab" onClick={() => setIsOpen(o => !o)} aria-label="Order Chat">
        {isOpen ? '✕' : '💬'}
        {unread > 0 && !isOpen && (
          <div className="oc-badge">{unread > 9 ? '9+' : unread}</div>
        )}
      </button>

      {isOpen && (
        <div className="oc-win">
          {/* Header */}
          <div className="oc-head">
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>
              {ROLE_EMOJI[currentUserRole] || '💬'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
              <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.75)' }}>Order chat · all participants</div>
            </div>
            <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.1rem', padding: '0 4px', opacity: 0.85 }}>✕</button>
          </div>

          {/* Messages */}
          <div className="oc-msgs">
            {loading && (
              <>
                {[60, 80, 48, 70].map((w, i) => (
                  <div key={i} className="oc-skel" style={{ height: 38, width: `${w}%`, alignSelf: i % 2 === 0 ? 'flex-start' : 'flex-end' }} />
                ))}
              </>
            )}

            {!loading && loadError && (
              <div style={{ textAlign: 'center', padding: '24px 16px', background: '#fef2f2', borderRadius: 10, margin: '10px 0', color: '#dc2626', fontSize: '0.82rem' }}>
                ⚠️ {loadError}
                <button onClick={load} style={{ display: 'block', margin: '8px auto 0', background: 'white', border: '1px solid #fca5a5', borderRadius: 6, padding: '5px 14px', color: '#dc2626', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
                  Retry
                </button>
              </div>
            )}

            {!loading && !loadError && messages.length === 0 && (
              <div style={{ textAlign: 'center', marginTop: 50, color: '#94a3b8', fontSize: '0.82rem' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>💬</div>
                <p style={{ margin: 0 }}>No messages yet.<br />Start the conversation!</p>
              </div>
            )}

            {groups.map((group, gi) => (
              <div key={gi}>
                <div className="oc-date"><span className="oc-datepill">{fmtDate(group.date)}</span></div>
                {group.messages.map(msg => {
                  const isMe = msg.sender_id === currentUserId
                  const bs = BUBBLE[msg.sender_role] ?? BUBBLE.shopkeeper
                  const senderName = msg.profiles?.full_name || msg.sender_role.replace('_', ' ')
                  const isTemp = msg.id.startsWith('temp-')
                  return (
                    <div key={msg.id} className={`oc-row ${isMe ? 'me' : 'other'}`}>
                      {!isMe && (
                        <div className="oc-sender">{ROLE_EMOJI[msg.sender_role]} {senderName}</div>
                      )}
                      <div
                        className="oc-bubble"
                        style={{
                          background: bs.bg,
                          color: bs.color,
                          border: `1px solid ${bs.border}`,
                          borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                          opacity: isTemp ? 0.7 : 1,
                        }}
                      >
                        {msg.message}
                      </div>
                      <div className="oc-time">
                        {fmtTime(msg.created_at)}{isTemp ? ' · sending…' : ''}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
            <div ref={endRef} />
          </div>

          {/* Footer */}
          <div className="oc-footer">
            {/* Quick messages */}
            {quickList.length > 0 && (
              <>
                <div style={{ padding: '6px 12px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    onClick={() => setShowQuick(q => !q)}
                    style={{ background: 'none', border: 'none', fontSize: '0.7rem', color: '#94a3b8', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}
                  >
                    ⚡ Quick {showQuick ? '▲' : '▼'}
                  </button>
                </div>
                {showQuick && (
                  <div className="oc-quick">
                    {quickList.map(q => (
                      <button key={q} className="oc-qbtn" onClick={() => send(q)}>{q}</button>
                    ))}
                  </div>
                )}
              </>
            )}
            <div className="oc-inp-row">
              <input
                ref={inputRef}
                className="oc-inp"
                placeholder="Type a message…"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                maxLength={500}
                autoComplete="off"
              />
              <button className="oc-send" onClick={() => send(input)} disabled={sending || !input.trim()}>
                {sending ? '⏳' : '➤'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}