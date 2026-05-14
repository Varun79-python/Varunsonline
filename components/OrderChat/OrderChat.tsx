'use client'
import { useEffect, useRef, useState } from 'react'
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
  admin: '👑'
}

const ROLE_BUBBLE: Record<string, { bg: string; color: string; align: 'right' | 'left'; radius: string }> = {
  customer: { bg: '#f97316', color: 'white', align: 'right', radius: '18px 18px 4px 18px' },
  shopkeeper: { bg: '#ffffff', color: '#1e293b', align: 'left', radius: '18px 18px 18px 4px' },
  delivery_agent: { bg: '#0ea5e9', color: 'white', align: 'right', radius: '18px 18px 4px 18px' },
  admin: { bg: '#f1f5f9', color: '#1e293b', align: 'left', radius: '18px 18px 18px 4px' }
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function OrderChat({ orderId, currentUserId, currentUserRole, shopName, agentName, customerName }: OrderChatProps) {
  const supabase = createClient()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const myRole = currentUserRole as keyof typeof ROLE_BUBBLE

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/order-messages?orderId=${orderId}`)
      const data = await res.json()
      if (data.messages) {
        setMessages(data.messages)
      }
    }
    if (isOpen) load()
  }, [orderId, isOpen])

  useEffect(() => {
    if (!isOpen) return
    const channel = supabase
      .channel(`order-chat-${orderId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'order_messages',
        filter: `conversation_id=eq.${orderId}`
      }, async (payload) => {
        const newMsg = payload.new as Message
        const { data: fullMsg } = await supabase
          .from('order_messages')
          .select('*, profiles(full_name, role, avatar_url)')
          .eq('id', newMsg.id)
          .single()
        if (fullMsg) {
          setMessages(prev => [...prev, fullMsg])
          if (newMsg.sender_id !== currentUserId) {
            setUnreadCount(prev => prev + 1)
          }
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [orderId, isOpen, currentUserId, supabase])

  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen])

  async function sendMessage() {
    if (!input.trim() || sending) return
    setSending(true)
    try {
      const res = await fetch('/api/order-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, message: input })
      })
      const data = await res.json()
      if (data.message) {
        setMessages(prev => [...prev, data.message])
        setInput('')
        inputRef.current?.focus()
      }
    } catch (err) {
      console.error('Send error:', err)
    } finally {
      setSending(false)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function groupMessages(msgs: Message[]) {
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

  const groups = groupMessages(messages)
  const myBubble = ROLE_BUBBLE[myRole] || ROLE_BUBBLE.customer

  return (
    <>
      <style>{`
        .oc-toggle {
          position: fixed; bottom: 90px; right: 16px; z-index: 200;
          width: 56px; height: 56px; border-radius: 50%;
          background: linear-gradient(135deg, #f97316, #ea580c);
          border: none; cursor: pointer; box-shadow: 0 4px 20px rgba(249,115,22,0.4);
          display: flex; align-items: center; justify-content: center;
          font-size: 1.6rem; transition: transform 0.2s;
        }
        .oc-toggle:hover { transform: scale(1.08); }
        .oc-toggle:active { transform: scale(0.95); }
        .oc-badge {
          position: absolute; top: -2px; right: -2px;
          background: #dc2626; color: white; font-size: 0.65rem; font-weight: 800;
          min-width: 18px; height: 18px; border-radius: 99px;
          display: flex; align-items: center; justify-content: center;
          padding: 0 4px; border: 2px solid white;
        }
        .oc-window {
          position: fixed; bottom: 90px; right: 16px; z-index: 200;
          width: 360px; max-width: calc(100vw - 32px);
          height: 520px; max-height: calc(100vh - 200px);
          background: white; border-radius: 20px;
          box-shadow: 0 12px 48px rgba(0,0,0,0.18);
          display: flex; flex-direction: column; overflow: hidden;
          border: 1.5px solid #e2e8f0;
          animation: slideUp 0.3s cubic-bezier(0.32, 0.72, 0, 1) forwards;
        }
        .oc-header {
          background: linear-gradient(135deg, #f97316, #ea580c);
          padding: 14px 16px; display: flex; align-items: center; gap: 10px;
          flex-shrink: 0;
        }
        .oc-messages { flex: 1; overflow-y: auto; padding: 12px 16px; background: #f0f2f5; }
        .oc-date-divider {
          text-align: center; margin: 12px 0 8px;
          font-size: 0.72rem; font-weight: 600; color: #94a3b8;
          background: #dde2e8; display: inline-block; padding: 3px 12px;
          border-radius: 99px; width: auto;
        }
        .oc-date-row { display: flex; justify-content: center; margin: 10px 0 6px; }
        .oc-bubble-wrap { display: flex; flex-direction: column; margin-bottom: 6px; }
        .oc-bubble-wrap.me { align-items: flex-end; }
        .oc-bubble-wrap.other { align-items: flex-start; }
        .oc-bubble {
          max-width: 75%; padding: 8px 12px;
          font-size: 0.88rem; line-height: 1.4; word-break: break-word;
          box-shadow: 0 1px 2px rgba(0,0,0,0.08);
        }
        .oc-bubble-meta { font-size: 0.65rem; color: #94a3b8; margin-top: 2px; display: flex; align-items: center; gap: 4px; }
        .oc-input-area { padding: 10px 12px; border-top: 1px solid #e2e8f0; display: flex; gap: 8px; flex-shrink: 0; background: white; }
        .oc-input {
          flex: 1; background: #f1f5f9; border: 1.5px solid #e2e8f0;
          border-radius: 99px; padding: 10px 16px; font-size: 0.88rem;
          color: #1e293b; font-family: inherit; resize: none; min-height: 44px;
          max-height: 100px; overflow-y: auto;
        }
        .oc-input:focus { outline: none; border-color: #f97316; background: white; }
        .oc-send {
          width: 44px; height: 44px; border-radius: 50%; background: #f97316;
          border: none; cursor: pointer; display: flex; align-items: center;
          justify-content: center; font-size: 1.2rem; flex-shrink: 0;
          transition: background 0.15s;
        }
        .oc-send:disabled { background: #94a3b8; cursor: not-allowed; }
        .oc-send:not(:disabled):active { background: #ea580c; }
        .oc-participants { display: flex; align-items: center; gap: 6px; flex: 1; }
        .oc-participant { background: rgba(255,255,255,0.2); border-radius: 99px; padding: 2px 10px; font-size: 0.72rem; color: white; font-weight: 600; }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @media only screen and (max-width: 390px) {
          .oc-window { right: 8px; width: calc(100vw - 16px); }
        }
      `}</style>

      <button className="oc-toggle" onClick={() => setIsOpen(!isOpen)}>
        💬
        {unreadCount > 0 && !isOpen && (
          <div className="oc-badge">{unreadCount > 9 ? '9+' : unreadCount}</div>
        )}
      </button>

      {isOpen && (
        <div className="oc-window">
          <div className="oc-header">
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'white' }}>Order Chat</div>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.8)' }}>with {shopName || agentName || customerName || 'participants'}</div>
            </div>
            <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.2rem', padding: 4 }}>✕</button>
          </div>

          <div className="oc-messages">
            {groups.length === 0 && (
              <div style={{ textAlign: 'center', marginTop: 60, color: '#94a3b8', fontSize: '0.85rem' }}>
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>💬</div>
                <p>No messages yet. Start the conversation!</p>
              </div>
            )}
            {groups.map((group, gi) => (
              <div key={gi}>
                <div className="oc-date-row">
                  <div className="oc-date-divider">{formatDate(group.date)}</div>
                </div>
                {group.messages.map((msg) => {
                  const isMe = msg.sender_id === currentUserId
                  const bubble = isMe
                    ? (myRole === 'customer' ? ROLE_BUBBLE.customer : myRole === 'delivery_agent' ? ROLE_BUBBLE.delivery_agent : ROLE_BUBBLE.admin)
                    : (msg.sender_role === 'customer' ? ROLE_BUBBLE.shopkeeper : ROLE_BUBBLE[msg.sender_role as keyof typeof ROLE_BUBBLE] || ROLE_BUBBLE.shopkeeper)
                  const bg = isMe
                    ? (myRole === 'customer' ? ROLE_BUBBLE.customer.bg : myRole === 'delivery_agent' ? ROLE_BUBBLE.delivery_agent.bg : '#f97316')
                    : (msg.sender_role === 'customer' ? ROLE_BUBBLE.customer.bg : ROLE_BUBBLE[msg.sender_role as keyof typeof ROLE_BUBBLE]?.bg || 'white')
                  const color = isMe
                    ? (myRole === 'customer' ? ROLE_BUBBLE.customer.color : myRole === 'delivery_agent' ? ROLE_BUBBLE.delivery_agent.color : 'white')
                    : (msg.sender_role === 'customer' ? ROLE_BUBBLE.customer.color : ROLE_BUBBLE[msg.sender_role as keyof typeof ROLE_BUBBLE]?.color || '#1e293b')

                  return (
                    <div key={msg.id} className={`oc-bubble-wrap ${isMe ? 'me' : 'other'}`}>
                      {!isMe && (
                        <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginBottom: 2, marginLeft: 4 }}>
                          {ROLE_AVATAR[msg.sender_role] || '👤'} {msg.profiles?.full_name || msg.sender_role}
                        </div>
                      )}
                      <div style={{ background: bg, color, borderRadius: bubble.radius, padding: '8px 12px', maxWidth: '75%', boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }}>
                        {msg.message}
                      </div>
                      <div className="oc-bubble-meta">
                        <span>{formatTime(msg.created_at)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="oc-input-area">
            <input
              ref={inputRef}
              className="oc-input"
              placeholder="Type a message..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
            />
            <button
              className="oc-send"
              onClick={sendMessage}
              disabled={sending || !input.trim()}
            >
              {sending ? '⏳' : '➤'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}