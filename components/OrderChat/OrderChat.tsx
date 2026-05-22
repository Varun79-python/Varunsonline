'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Message {
  id: string
  sender_id: string
  sender_role: string
  message: string
  is_read: boolean
  created_at: string
  profiles: { full_name: string; role: string; avatar_url: string | null } | null
}

interface OrderChatProps {
  orderId: string
  currentUserId: string
  currentUserRole: string
  shopName?: string
  agentName?: string
  customerName?: string
}

const ROLE_AVATAR: Record<string, string> = {
  customer: '👤',
  shopkeeper: '🏪',
  delivery_agent: '🛵',
  admin: '👑',
}

const ROLE_COLOR: Record<string, { bg: string; color: string; border: string }> = {
  customer:       { bg: '#f97316', color: 'white',   border: '#ea580c' },
  shopkeeper:     { bg: '#ffffff', color: '#1e293b', border: '#e2e8f0' },
  delivery_agent: { bg: '#0ea5e9', color: 'white',   border: '#0284c7' },
  admin:          { bg: '#8b5cf6', color: 'white',   border: '#7c3aed' },
}

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}
function formatDate(d: string) {
  const date = new Date(d)
  const today = new Date()
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function groupByDate(msgs: Message[]) {
  const groups: { date: string; messages: Message[] }[] = []
  let lastDate = ''
  for (const msg of msgs) {
    const d = new Date(msg.created_at).toDateString()
    if (d !== lastDate) {
      lastDate = d
      groups.push({ date: msg.created_at, messages: [msg] })
    } else {
      groups[groups.length - 1].messages.push(msg)
    }
  }
  return groups
}

export default function OrderChat({
  orderId, currentUserId, currentUserRole, shopName, agentName, customerName
}: OrderChatProps) {
  const supabase = createClient()
  const [messages, setMessages] = useState<Message[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load messages
  const loadMessages = useCallback(async () => {
    setLoadError(null)
    try {
      const res = await fetch(`/api/order-messages?orderId=${orderId}`)
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setLoadError(json.error || 'Failed to load messages')
        return
      }
      const data = await res.json()
      setMessages(data.messages || [])
      setConversationId(data.conversationId || null)
    } catch {
      setLoadError('Network error — check your connection')
    }
  }, [orderId])

  // Load on open
  useEffect(() => {
    if (isOpen) loadMessages()
  }, [isOpen, loadMessages])

  // Realtime subscription — runs when we have a conversationId
  useEffect(() => {
    if (!isOpen || !conversationId) return

    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'order_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const newMsg = payload.new as Message
        // Fetch the full message with profile join
        supabase
          .from('order_messages')
          .select('*, profiles(full_name, role, avatar_url)')
          .eq('id', newMsg.id)
          .single()
          .then(({ data: fullMsg }) => {
            if (fullMsg) {
              setMessages(prev => {
                // Prevent duplicates
                if (prev.some(m => m.id === fullMsg.id)) return prev
                return [...prev, fullMsg as Message]
              })
              if (newMsg.sender_id !== currentUserId) {
                setUnreadCount(n => n + 1)
              }
            }
          })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [isOpen, conversationId, currentUserId])

  // Scroll to bottom when messages update
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }, [messages, isOpen])

  // Reset unread when opened
  useEffect(() => {
    if (isOpen) setUnreadCount(0)
  }, [isOpen])

  async function sendMessage() {
    if (!input.trim() || sending) return
    setSending(true)
    const text = input.trim()
    setInput('')
    try {
      const res = await fetch('/api/order-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, message: text }),
      })
      const data = await res.json()
      if (res.ok && data.message) {
        setMessages(prev => {
          if (prev.some(m => m.id === data.message.id)) return prev
          return [...prev, data.message]
        })
        if (data.conversationId && !conversationId) {
          setConversationId(data.conversationId)
        }
      } else {
        alert(data.error || 'Failed to send message')
        setInput(text) // restore
      }
    } catch {
      alert('Network error')
      setInput(text)
    } finally {
      setSending(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const title = shopName ? `Chat with ${shopName}` : agentName ? `Chat with ${agentName}` : customerName ? `Chat with ${customerName}` : 'Order Chat'
  const groups = groupByDate(messages)

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
        }
        .oc-fab:hover { transform: scale(1.08); box-shadow: 0 6px 28px rgba(249,115,22,0.55); }
        .oc-fab:active { transform: scale(0.94); }
        .oc-badge {
          position: absolute; top: -3px; right: -3px;
          background: #dc2626; color: white; font-size: 0.62rem; font-weight: 800;
          min-width: 19px; height: 19px; border-radius: 99px;
          display: flex; align-items: center; justify-content: center;
          padding: 0 4px; border: 2px solid white;
        }
        .oc-window {
          position: fixed; bottom: 160px; right: 16px; z-index: 300;
          width: 360px; max-width: calc(100vw - 24px);
          height: 500px; max-height: calc(100dvh - 220px);
          background: white; border-radius: 20px;
          box-shadow: 0 16px 56px rgba(0,0,0,0.2);
          display: flex; flex-direction: column; overflow: hidden;
          border: 1.5px solid #e2e8f0;
          animation: ocSlideUp 0.25s cubic-bezier(0.32,0.72,0,1) forwards;
        }
        @keyframes ocSlideUp { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .oc-head {
          background: linear-gradient(135deg, #f97316, #ea580c);
          padding: 12px 16px; display: flex; align-items: center; gap: 10; flex-shrink: 0;
        }
        .oc-msgs {
          flex: 1; overflow-y: auto; padding: 10px 12px; background: #f0f2f5;
          display: flex; flex-direction: column; gap: 0;
          scroll-behavior: smooth;
        }
        .oc-msgs::-webkit-scrollbar { width: 4px; }
        .oc-msgs::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .oc-input-row {
          padding: 10px 12px; border-top: 1px solid #e2e8f0;
          display: flex; gap: 8px; align-items: center; flex-shrink: 0; background: white;
        }
        .oc-input {
          flex: 1; background: #f1f5f9; border: 1.5px solid #e2e8f0;
          border-radius: 22px; padding: 10px 16px; font-size: 0.87rem;
          color: #1e293b; font-family: inherit; outline: none;
        }
        .oc-input:focus { border-color: #f97316; background: white; }
        .oc-send {
          width: 42px; height: 42px; border-radius: 50%;
          background: linear-gradient(135deg, #f97316, #ea580c);
          border: none; cursor: pointer; display: flex;
          align-items: center; justify-content: center;
          font-size: 1.1rem; flex-shrink: 0; transition: opacity 0.15s;
        }
        .oc-send:disabled { opacity: 0.45; cursor: not-allowed; }
        .oc-date-row { display: flex; justify-content: center; margin: 10px 0 6px; }
        .oc-date-pill {
          background: #dde1e8; color: #64748b; font-size: 0.68rem;
          font-weight: 700; padding: 3px 12px; border-radius: 99px;
        }
        .oc-row { display: flex; flex-direction: column; margin-bottom: 5px; }
        .oc-row.me { align-items: flex-end; }
        .oc-row.other { align-items: flex-start; }
        .oc-sender { font-size: 0.63rem; color: #94a3b8; margin-bottom: 2px; padding: 0 4px; }
        .oc-bubble {
          max-width: 78%; padding: 9px 13px; border-radius: 16px;
          font-size: 0.87rem; line-height: 1.45; word-break: break-word;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        }
        .oc-time { font-size: 0.62rem; color: #94a3b8; margin-top: 3px; padding: 0 4px; }
        @media (max-width: 400px) {
          .oc-window { right: 8px; width: calc(100vw - 16px); }
        }
      `}</style>

      {/* FAB */}
      <button className="oc-fab" onClick={() => setIsOpen(o => !o)} aria-label="Order Chat">
        {isOpen ? '✕' : '💬'}
        {unreadCount > 0 && !isOpen && <div className="oc-badge">{unreadCount > 9 ? '9+' : unreadCount}</div>}
      </button>

      {isOpen && (
        <div className="oc-window">
          {/* Header */}
          <div className="oc-head">
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>
              {ROLE_AVATAR[currentUserRole] || '💬'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
              <div style={{ fontSize: '0.67rem', color: 'rgba(255,255,255,0.75)' }}>Order messages · all participants</div>
            </div>
            <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.2rem', padding: '0 4px', opacity: 0.85 }}>✕</button>
          </div>

          {/* Messages area */}
          <div className="oc-msgs">
            {loadError && (
              <div style={{ textAlign: 'center', padding: '20px 16px', background: '#fef2f2', borderRadius: 10, margin: '10px 0', color: '#dc2626', fontSize: '0.82rem' }}>
                ⚠️ {loadError}
                <button onClick={loadMessages} style={{ display: 'block', margin: '8px auto 0', background: 'white', border: '1px solid #fca5a5', borderRadius: 6, padding: '5px 14px', color: '#dc2626', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>Retry</button>
              </div>
            )}

            {!loadError && messages.length === 0 && (
              <div style={{ textAlign: 'center', marginTop: 60, color: '#94a3b8', fontSize: '0.83rem' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>💬</div>
                <p style={{ margin: 0 }}>No messages yet.<br />Start the conversation!</p>
              </div>
            )}

            {groups.map((group, gi) => (
              <div key={gi}>
                <div className="oc-date-row">
                  <span className="oc-date-pill">{formatDate(group.date)}</span>
                </div>
                {group.messages.map(msg => {
                  const isMe = msg.sender_id === currentUserId
                  const roleStyle = ROLE_COLOR[msg.sender_role] || ROLE_COLOR.shopkeeper
                  const senderName = msg.profiles?.full_name || msg.sender_role
                  return (
                    <div key={msg.id} className={`oc-row ${isMe ? 'me' : 'other'}`}>
                      {!isMe && (
                        <div className="oc-sender">
                          {ROLE_AVATAR[msg.sender_role] || '👤'} {senderName}
                        </div>
                      )}
                      <div
                        className="oc-bubble"
                        style={{
                          background: roleStyle.bg,
                          color: roleStyle.color,
                          border: `1px solid ${roleStyle.border}`,
                          borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        }}
                      >
                        {msg.message}
                      </div>
                      <div className="oc-time">{formatTime(msg.created_at)}</div>
                    </div>
                  )
                })}
              </div>
            ))}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div className="oc-input-row">
            <input
              ref={inputRef}
              className="oc-input"
              placeholder="Type a message…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              maxLength={500}
              autoComplete="off"
            />
            <button className="oc-send" onClick={sendMessage} disabled={sending || !input.trim()}>
              {sending ? '⏳' : '➤'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}