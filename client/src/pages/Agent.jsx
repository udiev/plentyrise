import { useState, useEffect, useRef } from 'react'
import Layout from '../components/layout/Layout'
import PortfolioHealthCard from '../components/Agent/PortfolioHealthCard'
import AllocationChart from '../components/Agent/AllocationChart'
import RecommendationCard from '../components/Agent/RecommendationCard'
import { analyzePortfolio, chatWithAgent, getLastAnalysis } from '../services/agentService'
import { getSummary } from '../api/assets'

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0)

const SUGGESTIONS = [
  'What is my biggest risk right now?',
  'Should I rebalance my portfolio?',
  'Analyze my currency exposure',
  'What should I buy this week?',
  'How is my portfolio diversified?',
]

function TypingDots() {
  return (
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
  )
}

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user'
  let content = msg.content
  if (typeof content === 'object') content = content.summary || JSON.stringify(content, null, 2)
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
          isUser ? 'text-white rounded-tr-sm' : 'text-slate-800 bg-slate-50 border border-slate-100 rounded-tl-sm'
        }`}
        style={isUser ? { background: 'linear-gradient(135deg, #3b82f6, #6366f1)' } : {}}
      >
        {content}
      </div>
    </div>
  )
}

function HoldingRow({ label, value, pnl, pnlPct, color }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
        <span className="text-sm text-slate-700">{label}</span>
      </div>
      <div className="text-right">
        <div className="text-sm font-semibold text-slate-800">{fmt(value)}</div>
        {pnl !== undefined && (
          <div className={`text-xs ${pnl >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {pnl >= 0 ? '+' : ''}{fmt(pnl)} {pnlPct !== undefined ? `(${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%)` : ''}
          </div>
        )}
      </div>
    </div>
  )
}

export default function AgentPage() {
  // Analysis state
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [analysisError, setAnalysisError] = useState(null)
  const [lastAnalyzed, setLastAnalyzed] = useState(null)

  // Holdings
  const [summary, setSummary] = useState(null)

  // Chat state
  const [messages, setMessages] = useState([])
  const [conversationHistory, setConversationHistory] = useState([])
  const [input, setInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError, setChatError] = useState(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatLoading])

  // Load holdings summary + last analysis on mount
  useEffect(() => {
    getSummary().then(setSummary).catch(() => {})
    getLastAnalysis().then(data => {
      if (!data) return
      const a = data.analysis
      setAnalysisResult({
        analysis: a,
        recommendations: (typeof a === 'object' ? a?.recommendations : null) || [],
        portfolioHealth: typeof a === 'object' ? a?.portfolio_health : null,
      })
      setLastAnalyzed(data.created_at)
    }).catch(() => {})
  }, [])

  async function runAnalysis() {
    setAnalyzing(true)
    setAnalysisError(null)
    try {
      const data = await analyzePortfolio()
      setAnalysisResult(data)
      setLastAnalyzed(new Date().toISOString())
    } catch (err) {
      const msg = err.response?.data?.error
      setAnalysisError(
        err.response?.status === 429
          ? 'Rate limit reached (10/hour). Try again later.'
          : msg || 'Analysis failed. Please try again.'
      )
    } finally {
      setAnalyzing(false)
    }
  }

  async function sendMessage(text) {
    const trimmed = text.trim()
    if (!trimmed || chatLoading) return
    setInput('')
    setChatError(null)
    setMessages(prev => [...prev, { role: 'user', content: trimmed }])
    setChatLoading(true)
    try {
      const result = await chatWithAgent(trimmed, conversationHistory)
      setMessages(prev => [...prev, { role: 'assistant', content: result.analysis }])
      setConversationHistory(result.conversationHistory || [])
    } catch (err) {
      const msg = err.response?.data?.error
      setChatError(
        err.response?.status === 429
          ? 'Rate limit reached (10/hour). Try again later.'
          : msg || 'Connection error. Please try again.'
      )
    } finally {
      setChatLoading(false)
      inputRef.current?.focus()
    }
  }

  function drillDown(rec) {
    sendMessage(`Tell me more about this recommendation: ${rec.action} ${rec.ticker_or_asset} — ${rec.rationale}`)
    document.getElementById('agent-chat')?.scrollIntoView({ behavior: 'smooth' })
  }

  const analysis = analysisResult?.analysis
  const portfolioHealth = analysisResult?.portfolioHealth || (typeof analysis === 'object' ? analysis?.portfolio_health : null)
  const allocationAnalysis = typeof analysis === 'object' ? analysis?.allocation_analysis : null
  const recommendations = analysisResult?.recommendations || (typeof analysis === 'object' ? analysis?.recommendations : []) || []
  const risks = typeof analysis === 'object' ? analysis?.risks : []
  const analysisSummary = typeof analysis === 'object' ? analysis?.summary : (typeof analysis === 'string' ? analysis : null)

  const holdingRows = summary ? [
    { label: 'Investments',     value: summary.investments?.current_value,  pnl: summary.investments?.pnl,  color: '#3b82f6' },
    { label: 'Crypto',          value: summary.crypto?.current_value,        pnl: summary.crypto?.pnl,        color: '#f59e0b' },
    { label: 'Real Estate',     value: summary.real_estate?.current_value,   color: '#10b981' },
    { label: 'Cash & Savings',  value: summary.cash?.total_balance,          color: '#6366f1' },
    { label: 'Pension',         value: summary.pension?.total_value,         color: '#ec4899' },
    { label: 'Alternative',     value: summary.alternative?.total_value,     color: '#14b8a6' },
  ].filter(r => r.value > 0) : []

  const totalValue = holdingRows.reduce((s, r) => s + (r.value || 0), 0)

  return (
    <Layout>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 md:mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #6366f1, #3b82f6)' }}>
              AI
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-800">Investment Agent</h1>
          </div>
          <p className="text-slate-500 text-sm">AI-powered portfolio analysis and personalized recommendations</p>
        </div>
        <div className="flex flex-col items-end gap-1 self-start sm:self-auto">
          <button
            onClick={runAnalysis}
            disabled={analyzing}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-60"
            style={{ background: analyzing ? '#94a3b8' : 'linear-gradient(135deg, #6366f1, #3b82f6)' }}
          >
            {analyzing ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Analyzing...
              </>
            ) : (
              <>
                <span>✦</span>
                {analysisResult ? 'Re-analyze Portfolio' : 'Analyze Portfolio'}
              </>
            )}
          </button>
          {lastAnalyzed && !analyzing && (
            <span className="text-xs text-slate-400">
              Last analyzed: {new Date(lastAnalyzed).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              {(Date.now() - new Date(lastAnalyzed).getTime()) > 24 * 60 * 60 * 1000 && (
                <span className="ml-1 text-amber-500">· may be outdated</span>
              )}
            </span>
          )}
        </div>
      </div>

      {analysisError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">{analysisError}</div>
      )}

      {/* ── Top row: Holdings + Health + Allocation ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">

        {/* Holdings Summary */}
        <div className="bg-white rounded-2xl p-5" style={{ border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Portfolio Holdings</h2>
            {summary && <span className="text-xs text-slate-400">Live</span>}
          </div>
          <p className="text-2xl font-bold text-slate-800 font-num mb-4">{fmt(totalValue)}</p>
          {holdingRows.length > 0 ? (
            <div>
              {holdingRows.map(r => (
                <HoldingRow key={r.label} {...r}
                  pnlPct={r.pnl && r.value ? ((r.pnl / (r.value - r.pnl)) * 100) : undefined}
                />
              ))}
            </div>
          ) : (
            <div className="text-slate-400 text-sm text-center py-6">Loading holdings...</div>
          )}
        </div>

        {/* Portfolio Health */}
        <div>
          {analyzing ? (
            <div className="h-full bg-slate-50 rounded-2xl animate-pulse" style={{ minHeight: '200px' }} />
          ) : portfolioHealth ? (
            <PortfolioHealthCard health={portfolioHealth} />
          ) : (
            <div className="h-full bg-white rounded-2xl p-5 flex flex-col items-center justify-center text-center"
              style={{ border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)', minHeight: '200px' }}>
              <div className="text-3xl mb-2">📊</div>
              <p className="text-slate-500 text-sm font-medium">Portfolio Health</p>
              <p className="text-slate-400 text-xs mt-1">Run analysis to see your score</p>
            </div>
          )}
        </div>

        {/* Allocation Chart */}
        <div>
          {analyzing ? (
            <div className="h-full bg-slate-50 rounded-2xl animate-pulse" style={{ minHeight: '200px' }} />
          ) : allocationAnalysis ? (
            <AllocationChart allocation={allocationAnalysis} />
          ) : (
            <div className="h-full bg-white rounded-2xl p-5 flex flex-col items-center justify-center text-center"
              style={{ border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)', minHeight: '200px' }}>
              <div className="text-3xl mb-2">🥧</div>
              <p className="text-slate-500 text-sm font-medium">Asset Allocation</p>
              <p className="text-slate-400 text-xs mt-1">Run analysis to see current vs. recommended</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Summary banner ── */}
      {analysisSummary && !analyzing && (
        <div className="mb-4 p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100">
          <div className="flex items-start gap-3">
            <span className="text-blue-500 text-lg mt-0.5">✦</span>
            <div>
              <p className="text-sm text-blue-900 leading-relaxed">{analysisSummary}</p>
              {lastAnalyzed && (
                <p className="text-xs text-blue-400 mt-1">
                  Last analyzed {new Date(lastAnalyzed).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom row: Recommendations + Chat ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Recommendations */}
        <div className="bg-white rounded-2xl p-5" style={{ border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Top Recommendations</h2>

          {analyzing && (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-xl bg-slate-100 animate-pulse" />)}
            </div>
          )}

          {!analyzing && recommendations.length > 0 && (
            <div className="space-y-3">
              {recommendations.slice(0, 5).map((rec, i) => (
                <RecommendationCard key={i} rec={rec} onDrillDown={drillDown} />
              ))}
            </div>
          )}

          {!analyzing && risks?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Risks</h3>
              <div className="space-y-2">
                {risks.map((risk, i) => {
                  const styles = { high: 'bg-red-50 text-red-600 border-red-100', medium: 'bg-orange-50 text-orange-600 border-orange-100', low: 'bg-yellow-50 text-yellow-700 border-yellow-100' }
                  const s = styles[risk.severity] || styles.low
                  return (
                    <div key={i} className="flex items-start gap-2">
                      <span className={`px-2 py-0.5 rounded-full border text-xs font-medium flex-shrink-0 ${s}`}>{risk.severity}</span>
                      <p className="text-xs text-slate-700">{risk.description || risk.type}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {!analyzing && recommendations.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="text-4xl mb-3">💡</div>
              <p className="text-slate-500 text-sm">No recommendations yet</p>
              <p className="text-slate-400 text-xs mt-1">Click "Analyze Portfolio" to get personalized insights</p>
            </div>
          )}
        </div>

        {/* Chat */}
        <div id="agent-chat" className="bg-white rounded-2xl flex flex-col"
          style={{ border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)', minHeight: '480px' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
            <div>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ask the Agent</h2>
              <p className="text-xs text-slate-400 mt-0.5">Ask anything about your portfolio</p>
            </div>
            {messages.length > 0 && (
              <button
                onClick={() => { setMessages([]); setConversationHistory([]); setChatError(null) }}
                className="text-xs text-slate-400 hover:text-slate-600 transition"
              >
                Clear
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0" style={{ maxHeight: '360px' }}>
            {messages.length === 0 && (
              <div className="pt-4 pb-2">
                <p className="text-slate-400 text-sm text-center mb-4">Ask the agent anything about your portfolio</p>
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
            {chatLoading && <TypingDots />}

            {chatError && (
              <div className="mx-2 mb-2 p-2.5 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600">{chatError}</div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-4 pb-4 pt-2 border-t border-slate-100 flex-shrink-0">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }}
                placeholder="Ask the agent..."
                disabled={chatLoading}
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 disabled:opacity-50"
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || chatLoading}
                className="w-9 h-9 flex items-center justify-center rounded-xl text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}
              >
                <svg className="w-4 h-4 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
