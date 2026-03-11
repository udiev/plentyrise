import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import useT from '../../i18n/useT'
import { sendMessage, getSessions, getHistory, updateConsent } from '../../api/ai'

// ── Typing indicator ──────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 mb-3">
      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
        style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}>
        A
      </div>
      <div className="px-4 py-3 rounded-2xl rounded-bl-sm max-w-xs"
        style={{ background: 'var(--surface2, #f1f5f9)' }}>
        <div className="flex gap-1 items-center h-4">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-2 h-2 rounded-full bg-slate-400"
              style={{ animation: 'bounce 1.2s infinite', animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Message bubble ────────────────────────────────────────────────────────────
function MessageBubble({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex items-end gap-2 mb-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}>
          A
        </div>
      )}
      <div
        className={`px-4 py-3 rounded-2xl max-w-xs text-sm whitespace-pre-wrap leading-relaxed ${
          isUser
            ? 'rounded-br-sm text-white'
            : 'rounded-bl-sm text-slate-700'
        }`}
        style={isUser
          ? { background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }
          : { background: 'var(--surface2, #f1f5f9)' }
        }
      >
        {msg.content}
      </div>
    </div>
  )
}

// ── Consent modal ─────────────────────────────────────────────────────────────
function ConsentModal({ onAccept, onDecline }) {
  const tr = useT()
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl text-white mb-4"
          style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}>
          ✨
        </div>
        <h2 className="text-lg font-bold text-slate-800 mb-2">{tr('ai_consent_title')}</h2>
        <p className="text-sm text-slate-500 mb-6 leading-relaxed">{tr('ai_consent_body')}</p>
        <div className="flex gap-3">
          <button
            onClick={onAccept}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}
          >
            {tr('ai_consent_accept')}
          </button>
          <button
            onClick={onDecline}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition"
          >
            {tr('ai_consent_decline')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AiChat() {
  const { user, refreshUser } = useAuth()
  const tr = useT()

  const [open, setOpen] = useState(false)
  const [sessionId, setSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showConsent, setShowConsent] = useState(false)
  const [sessions, setSessions] = useState([])
  const [showSessions, setShowSessions] = useState(false)

  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, loading])

  const openPanel = async (currentUser) => {
    const u = currentUser || user
    if (!u?.ai_data_access) {
      setShowConsent(true)
      return
    }
    setOpen(true)
    try {
      const s = await getSessions()
      setSessions(s)
    } catch { /* non-critical */ }
    if (!sessionId) startNewSession()
  }

  const startNewSession = () => {
    const id = crypto.randomUUID()
    setSessionId(id)
    setMessages([{ role: 'assistant', content: tr('ai_disclaimer') }])
    setError(null)
  }

  const handleAcceptConsent = async () => {
    try {
      await updateConsent(true)
      const updated = await refreshUser()
      setShowConsent(false)
      openPanel(updated)
    } catch {
      setError(tr('ai_error'))
    }
  }

  const handleDeclineConsent = () => setShowConsent(false)

  const handleOpen = () => {
    if (open) { setOpen(false); return }
    openPanel()
  }

  const loadSession = async (sid) => {
    setShowSessions(false)
    setLoading(true)
    try {
      const hist = await getHistory(sid)
      setSessionId(sid)
      setMessages(hist.map(h => ({ role: h.role, content: h.content })))
      setError(null)
    } catch {
      setError(tr('ai_error'))
    } finally {
      setLoading(false)
    }
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading) return

    setInput('')
    setError(null)
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setLoading(true)

    try {
      const data = await sendMessage({ message: text, sessionId })
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
      if (!sessionId) setSessionId(data.sessionId)
    } catch (err) {
      if (err.response?.status === 403 && err.response?.data?.error === 'consent_required') {
        setShowConsent(true)
        setOpen(false)
      } else {
        setError(tr('ai_error'))
      }
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!user) return null

  return (
    <>
      {/* Bounce keyframe */}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
      `}</style>

      {/* Consent modal */}
      {showConsent && (
        <ConsentModal onAccept={handleAcceptConsent} onDecline={handleDeclineConsent} />
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed z-50 flex flex-col bg-white shadow-2xl overflow-hidden
            bottom-0 left-0 right-0 h-full
            md:bottom-20 md:right-6 md:left-auto md:w-96 md:h-[600px] md:rounded-2xl">

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100"
              style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}>
              <div className="flex items-center gap-2">
                <span className="text-white font-bold text-sm">Ari ✨</span>
                <span className="text-blue-200 text-xs">{tr('ai_chat')}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSessions(s => !s)}
                  className="text-blue-200 hover:text-white text-xs px-2 py-1 rounded-lg hover:bg-white/10 transition"
                  title={tr('ai_sessions')}
                >
                  {tr('ai_sessions')}
                </button>
                <button
                  onClick={startNewSession}
                  className="text-blue-200 hover:text-white text-xs px-2 py-1 rounded-lg hover:bg-white/10 transition"
                  title={tr('ai_new_session')}
                >
                  +
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="text-blue-200 hover:text-white text-lg leading-none transition"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Sessions dropdown */}
            {showSessions && sessions.length > 0 && (
              <div className="border-b border-slate-100 bg-slate-50 max-h-40 overflow-y-auto">
                {sessions.map(s => (
                  <button
                    key={s.sessionId}
                    onClick={() => loadSession(s.sessionId)}
                    className="w-full text-left px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 transition border-b border-slate-100 last:border-0"
                  >
                    {new Date(s.started_at).toLocaleString()} —{' '}
                    <span className="text-slate-400">{s.sessionId.slice(0, 8)}…</span>
                  </button>
                ))}
              </div>
            )}

            {/* Message list */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {messages.map((msg, i) => (
                <MessageBubble key={i} msg={msg} />
              ))}
              {loading && <TypingIndicator />}
              {error && (
                <div className="text-center text-xs text-red-500 py-2">{error}</div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input row */}
            <div className="border-t border-slate-100 px-3 py-3 flex gap-2 items-end">
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={tr('ai_chat_placeholder')}
                className="flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-blue-400 transition max-h-32 overflow-y-auto"
                style={{ lineHeight: '1.5' }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0 transition disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}
              >
                ↑
              </button>
            </div>
          </div>
      )}

      {/* Floating button */}
      <button
        onClick={handleOpen}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg hover:scale-110 transition-transform"
        style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}
        aria-label={tr('ai_chat')}
      >
        {open ? (
          <span className="text-lg leading-none">✕</span>
        ) : (
          <span className="text-2xl leading-none">✨</span>
        )}
      </button>
    </>
  )
}
