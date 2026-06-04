import React, { useState, useRef, useEffect, useCallback } from 'react'

const WS_URL = 'ws://127.0.0.1:8000/ws'
const CURSOR_COLORS = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444']

const DEMO_USERS = [
  { id: 'u1', name: 'You', color: '#3b82f6', avatar: '😎', online: true, role: 'owner', position: 'Timeline' },
  { id: 'u2', name: 'Lucas', color: '#ec4899', avatar: '🎸', online: true, role: 'collaborator', position: 'Mixer' },
  { id: 'u3', name: 'Ana', color: '#10b981', avatar: '🎤', online: true, role: 'collaborator', position: 'Piano Roll' },
  { id: 'u4', name: 'Pedro', color: '#f59e0b', avatar: '🥁', online: false, role: 'viewer', position: null },
]

const DEMO_CHAT = [
  { id: 'm1', user: 'Lucas', color: '#ec4899', text: 'The chorus needs more reverb on the snare', time: '14:23' },
  { id: 'm2', user: 'Ana', color: '#10b981', text: 'Agreed! Also the vocal harmonies could sit better', time: '14:24' },
  { id: 'm3', user: 'You', color: '#3b82f6', text: 'Working on it now in the mixer', time: '14:25' },
  { id: 'm4', user: 'Lucas', color: '#ec4899', text: 'The bass line at bar 24 is 🔥', time: '14:26' },
  { id: 'm5', user: 'Ana', color: '#10b981', text: 'Can someone check the timing on the bridge?', time: '14:28' },
]

const DEMO_HISTORY = [
  { id: 'h1', user: 'Lucas', action: 'Added reverb to "Lead Drum" channel', time: '14:22', icon: '🎛️', color: '#ec4899' },
  { id: 'h2', user: 'Ana', action: 'Recorded vocal take "Verse 2"', time: '14:18', icon: '🎤', color: '#10b981' },
  { id: 'h3', user: 'You', action: 'Updated BPM to 128', time: '14:15', icon: '⏱️', color: '#3b82f6' },
  { id: 'h4', user: 'Lucas', action: 'Added clip "Bridge Guitar" to track 3', time: '14:10', icon: '📎', color: '#ec4899' },
  { id: 'h5', user: 'Ana', action: 'Joined the session', time: '14:08', icon: '👋', color: '#10b981' },
  { id: 'h6', user: 'Lucas', action: 'Joined the session', time: '14:07', icon: '👋', color: '#ec4899' },
  { id: 'h7', user: 'You', action: 'Created project "Summer Vibes"', time: '14:05', icon: '🎵', color: '#3b82f6' },
]

export default function Collaboration() {
  const [users, setUsers] = useState(DEMO_USERS)
  const [messages, setMessages] = useState(DEMO_CHAT)
  const [history, setHistory] = useState(DEMO_HISTORY)
  const [newMessage, setNewMessage] = useState('')
  const [tab, setTab] = useState('room')
  const [wsStatus, setWsStatus] = useState('offline')
  const [roomCode, setRoomCode] = useState('BEAT-7842')
  const [inviteLink, setInviteLink] = useState('musiccreator.app/join/BEAT-7842')
  const [showInvite, setShowInvite] = useState(false)
  const [recording, setRecording] = useState(false)
  const [micOn, setMicOn] = useState(false)
  const [comments, setComments] = useState([
    { id: 'c1', user: 'Ana', color: '#10b981', text: 'This transition needs work', bar: 16, track: 'Lead Vocal', time: '14:20' },
    { id: 'c2', user: 'Lucas', color: '#ec4899', text: 'Great riff!', bar: 24, track: 'Guitar', time: '14:22' },
  ])
  const chatEndRef = useRef(null)
  const wsRef = useRef(null)

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const tryConnect = () => {
    try {
      const ws = new WebSocket(`${WS_URL}/collab_${Date.now()}`)
      ws.onopen = () => setWsStatus('online')
      ws.onclose = () => setWsStatus('offline')
      ws.onerror = () => setWsStatus('offline')
      wsRef.current = ws
    } catch { setWsStatus('offline') }
  }

  const sendMessage = () => {
    if (!newMessage.trim()) return
    const msg = { id: `m_${Date.now()}`, user: 'You', color: '#3b82f6', text: newMessage, time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }
    setMessages(prev => [...prev, msg])
    setHistory(prev => [{ id: `h_${Date.now()}`, user: 'You', action: `Sent message: "${newMessage.slice(0, 30)}..."`, time: msg.time, icon: '💬', color: '#3b82f6' }, ...prev.slice(0, 19)])
    setNewMessage('')
    if (wsRef.current?.readyState === 1) wsRef.current.send(JSON.stringify({ type: 'chat', text: newMessage }))
  }

  const copyInvite = () => { navigator.clipboard?.writeText(inviteLink); setShowInvite(false) }

  const generateRoom = () => {
    const code = `${['BEAT','VIBE','TUNE','BASS','DROP'][Math.floor(Math.random()*5)]}-${Math.floor(1000+Math.random()*9000)}`
    setRoomCode(code); setInviteLink(`musiccreator.app/join/${code}`)
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#111', borderBottom: '1px solid #1f1f1f', flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#888' }}>COLLABORATION</span>
        <div style={{ width: 1, height: 20, background: '#333' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: wsStatus === 'online' ? '#22c55e' : '#ef4444', boxShadow: wsStatus === 'online' ? '0 0 6px #22c55e' : 'none' }} />
          <span style={{ fontSize: 11, color: wsStatus === 'online' ? '#22c55e' : '#ef4444' }}>{wsStatus === 'online' ? 'Connected' : 'Offline'}</span>
        </div>
        <button onClick={wsStatus === 'online' ? () => { wsRef.current?.close(); setWsStatus('offline') } : tryConnect}
          style={{ padding: '3px 10px', background: 'transparent', border: `1px solid ${wsStatus === 'online' ? '#ef444455' : '#22c55e55'}`, borderRadius: 5, color: wsStatus === 'online' ? '#ef4444' : '#22c55e', cursor: 'pointer', fontSize: 11 }}>
          {wsStatus === 'online' ? 'Disconnect' : 'Connect'}
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#555' }}>Room:</span>
          <span style={{ fontSize: 12, fontWeight: 800, fontFamily: 'monospace', color: '#3b82f6', letterSpacing: 1 }}>{roomCode}</span>
          <button onClick={() => setShowInvite(v => !v)}
            style={{ padding: '3px 10px', background: '#1e3a5f', border: '1px solid #3b82f644', borderRadius: 5, color: '#3b82f6', cursor: 'pointer', fontSize: 11 }}>
            Invite
          </button>
          <button onClick={generateRoom}
            style={{ padding: '3px 10px', background: 'transparent', border: '1px solid #333', borderRadius: 5, color: '#666', cursor: 'pointer', fontSize: 11 }}>
            New Room
          </button>
        </div>
      </div>

      {showInvite && (
        <div style={{ padding: '10px 16px', background: '#0f1a2e', borderBottom: '1px solid #1f3a5f', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#555' }}>Invite link:</span>
          <span style={{ flex: 1, fontFamily: 'monospace', fontSize: 12, color: '#3b82f6', background: '#0d0d0d', padding: '4px 8px', borderRadius: 4, border: '1px solid #1f3a5f' }}>{inviteLink}</span>
          <button onClick={copyInvite} style={{ padding: '4px 12px', background: '#1e3a5f', border: '1px solid #3b82f644', borderRadius: 6, color: '#3b82f6', cursor: 'pointer', fontSize: 12 }}>Copy</button>
          <button onClick={() => setShowInvite(false)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: Users + Voice */}
        <div style={{ width: 200, flexShrink: 0, background: '#0e0e0e', borderRight: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 12px', fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid #1a1a1a' }}>
            Collaborators ({users.filter(u => u.online).length} online)
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {users.map(user => (
              <div key={user.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid #141414', opacity: user.online ? 1 : 0.4 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${user.color}33`, border: `2px solid ${user.online ? user.color : '#333'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                  {user.avatar}
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: user.id === 'u1' ? '#ddd' : '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.name} {user.id === 'u1' && <span style={{ fontSize: 9, color: '#555' }}>(you)</span>}
                  </div>
                  {user.online && user.position && (
                    <div style={{ fontSize: 9, color: user.color, opacity: 0.8 }}>{user.position}</div>
                  )}
                  <div style={{ fontSize: 9, color: '#333' }}>{user.role}</div>
                </div>
                {user.online && user.id !== 'u1' && (
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: user.color, boxShadow: `0 0 4px ${user.color}` }} />
                )}
              </div>
            ))}
          </div>

          {/* Voice Controls */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid #1a1a1a', background: '#0a0a0a' }}>
            <div style={{ fontSize: 10, color: '#444', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Voice Chat</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setMicOn(v => !v)}
                style={{ flex: 1, padding: '6px', background: micOn ? '#22c55e22' : '#1a1a1a', border: `1px solid ${micOn ? '#22c55e55' : '#333'}`, borderRadius: 6, color: micOn ? '#22c55e' : '#555', cursor: 'pointer', fontSize: 13 }}>
                {micOn ? '🎤' : '🔇'}
              </button>
              <button style={{ flex: 1, padding: '6px', background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, color: '#555', cursor: 'pointer', fontSize: 13 }}>
                🔈
              </button>
              <button onClick={() => setRecording(v => !v)}
                style={{ flex: 1, padding: '6px', background: recording ? '#ef444422' : '#1a1a1a', border: `1px solid ${recording ? '#ef444455' : '#333'}`, borderRadius: 6, color: recording ? '#ef4444' : '#555', cursor: 'pointer', fontSize: 13 }}>
                {recording ? '⏺' : '⏺'}
              </button>
            </div>
            {micOn && (
              <div style={{ display: 'flex', gap: 1, marginTop: 6, justifyContent: 'center' }}>
                {Array.from({length:12}, (_,i) => (
                  <div key={i} style={{ width: 3, background: '#22c55e', borderRadius: 1.5, height: `${Math.random() * 16 + 4}px`, animation: `pulse ${0.3 + i * 0.05}s infinite alternate` }} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Tabs */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Tab bar */}
          <div style={{ display: 'flex', borderBottom: '1px solid #1a1a1a', background: '#0d0d0d' }}>
            {[['room', '💬 Chat'], ['history', '📋 History'], ['comments', '📌 Comments']].map(([t, label]) => (
              <button key={t} onClick={() => setTab(t)}
                style={{ padding: '8px 16px', background: tab === t ? '#111' : 'transparent', border: 'none', borderBottom: `2px solid ${tab === t ? '#3b82f6' : 'transparent'}`, color: tab === t ? '#ddd' : '#555', cursor: 'pointer', fontSize: 12 }}>
                {label}
              </button>
            ))}
          </div>

          {/* Chat tab */}
          {tab === 'room' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {messages.map(msg => (
                  <div key={msg.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${msg.color}33`, border: `1.5px solid ${msg.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: msg.color, flexShrink: 0 }}>
                      {msg.user.charAt(0)}
                    </div>
                    <div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: msg.color }}>{msg.user}</span>
                        <span style={{ fontSize: 9, color: '#444' }}>{msg.time}</span>
                      </div>
                      <div style={{ fontSize: 13, color: msg.user === 'You' ? '#ddd' : '#aaa', background: msg.user === 'You' ? '#1e3a5f' : '#111', padding: '6px 10px', borderRadius: '0 8px 8px 8px', border: `1px solid ${msg.user === 'You' ? '#3b82f622' : '#1a1a1a'}`, maxWidth: 400, lineHeight: 1.4 }}>
                        {msg.text}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div style={{ padding: '10px 16px', background: '#0d0d0d', borderTop: '1px solid #1a1a1a', display: 'flex', gap: 8 }}>
                <input value={newMessage} onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  placeholder="Message..." style={{ flex: 1, background: '#1a1a1a', border: '1px solid #333', color: '#fff', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none' }} />
                <button onClick={sendMessage}
                  style={{ padding: '8px 16px', background: '#1e3a5f', border: '1px solid #3b82f644', borderRadius: 8, color: '#3b82f6', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                  Send
                </button>
              </div>
            </div>
          )}

          {/* History tab */}
          {tab === 'history' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {history.map(h => (
                  <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#0d0d0d', border: '1px solid #141414', borderRadius: 8 }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{h.icon}</span>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 12, color: h.color, fontWeight: 600 }}>{h.user}</span>
                      <span style={{ fontSize: 12, color: '#666' }}> {h.action}</span>
                    </div>
                    <span style={{ fontSize: 9, color: '#444', flexShrink: 0 }}>{h.time}</span>
                    <button style={{ width: 20, height: 20, background: 'transparent', border: '1px solid #222', borderRadius: 3, color: '#444', cursor: 'pointer', fontSize: 9 }} title="Undo">↩</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comments tab */}
          {tab === 'comments' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {comments.map(comment => (
                <div key={comment.id} style={{ display: 'flex', gap: 10, padding: '10px 14px', background: '#0d0d0d', border: `1px solid ${comment.color}33`, borderRadius: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${comment.color}22`, border: `1.5px solid ${comment.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: comment.color, flexShrink: 0 }}>
                    {comment.user.charAt(0)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: comment.color }}>{comment.user}</span>
                      <span style={{ fontSize: 9, color: '#444', background: '#1a1a1a', padding: '1px 6px', borderRadius: 3 }}>Bar {comment.bar}</span>
                      <span style={{ fontSize: 9, color: '#444' }}>{comment.track}</span>
                    </div>
                    <div style={{ fontSize: 13, color: '#aaa' }}>{comment.text}</div>
                  </div>
                  <button style={{ background: 'none', border: 'none', color: '#333', cursor: 'pointer', fontSize: 13 }}>✕</button>
                </div>
              ))}
              <button style={{ padding: '10px', background: '#0d0d0d', border: '2px dashed #1f1f1f', borderRadius: 8, color: '#444', cursor: 'pointer', fontSize: 13 }}>
                + Add comment at current position
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
