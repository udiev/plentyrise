/**
 * AgentChat — conversational interface for the investment agent.
 */
import { useState, useRef, useEffect } from 'react';
import { chatWithAgent } from '../../services/agentService';

const SUGGESTIONS = [
  'מה הסיכון הגדול בתיק שלי?',
  'מה כדאי לקנות השבוע?',
  'נתח את חשיפת המטבע שלי',
  'האם התיק מפוזר מספיק?',
  'מה מצב שוק ההון כרגע?',
];

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';

  // Render plain text or JSON analysis
  let content = msg.content;
  if (typeof content === 'object') {
    // Render structured JSON as text
    content = content.summary || JSON.stringify(content, null, 2);
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white mr-2 mt-0.5"
          style={{ background: 'linear-gradient(135deg, #6366f1, #3b82f6)' }}>
          AI
        </div>
      )}
      <div
        className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'text-white rounded-tr-sm'
            : 'text-slate-800 bg-slate-50 border border-slate-100 rounded-tl-sm'
        }`}
        style={isUser ? { background: 'linear-gradient(135deg, #3b82f6, #6366f1)' } : {}}
      >
        {content}
      </div>
    </div>
  );
}

export default function AgentChat() {
  const [messages, setMessages] = useState([]);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function sendMessage(text) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setInput('');
    setError(null);

    const userMsg = { role: 'user', content: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const result = await chatWithAgent(trimmed, conversationHistory);
      const assistantMsg = { role: 'assistant', content: result.analysis };
      setMessages(prev => [...prev, assistantMsg]);
      setConversationHistory(result.conversationHistory || []);
    } catch (err) {
      const errMsg = err.response?.status === 429
        ? 'הגעת לגבול הבקשות (10 לשעה). נסה שוב מאוחר יותר.'
        : 'שגיאה בחיבור לסוכן. אנא נסה שוב.';
      setError(errMsg);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function clearChat() {
    setMessages([]);
    setConversationHistory([]);
    setError(null);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
        <p className="text-xs text-slate-500">שאל כל שאלה על התיק שלך</p>
        {messages.length > 0 && (
          <button onClick={clearChat} className="text-xs text-slate-400 hover:text-slate-600 transition">
            נקה שיחה
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
        {messages.length === 0 && (
          <div className="text-center py-6">
            <p className="text-slate-400 text-sm mb-4">שאל את הסוכן כל שאלה על ניהול התיק שלך</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-blue-50 hover:text-blue-600 border border-slate-200 rounded-full text-xs text-slate-600 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}

        {loading && (
          <div className="flex justify-start mb-3">
            <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white mr-2 mt-0.5"
              style={{ background: 'linear-gradient(135deg, #6366f1, #3b82f6)' }}>
              AI
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <span key={i} className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mx-2 mb-2 p-2.5 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 pb-3 pt-2 border-t border-slate-100">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="שאל את הסוכן..."
            rows={1}
            disabled={loading}
            className="flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 disabled:opacity-50"
            style={{ direction: 'rtl', minHeight: '38px', maxHeight: '100px' }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}
          >
            <svg className="w-4 h-4 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
