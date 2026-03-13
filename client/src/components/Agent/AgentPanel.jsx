/**
 * AgentPanel — sliding drawer panel with two tabs:
 * 1. "ניתוח תיק" — full portfolio analysis
 * 2. "שיחה" — conversational agent chat
 */
import { useState } from 'react';
import { analyzePortfolio } from '../../services/agentService';
import PortfolioHealthCard from './PortfolioHealthCard';
import AllocationChart from './AllocationChart';
import RecommendationCard from './RecommendationCard';
import AgentChat from './AgentChat';

function RiskBadge({ severity }) {
  const styles = {
    high:   'bg-red-50 text-red-600 border-red-100',
    medium: 'bg-orange-50 text-orange-600 border-orange-100',
    low:    'bg-yellow-50 text-yellow-700 border-yellow-100',
  };
  const labels = { high: 'גבוה', medium: 'בינוני', low: 'נמוך' };
  return (
    <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${styles[severity] || styles.low}`}>
      {labels[severity] || severity}
    </span>
  );
}

function SkeletonBlock({ h = 'h-24' }) {
  return <div className={`${h} rounded-xl bg-slate-100 animate-pulse`} />;
}

export default function AgentPanel({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('analysis');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  async function handleAnalyze() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await analyzePortfolio();
      setResult(data);
    } catch (err) {
      const msg = err.response?.status === 429
        ? 'הגעת לגבול הבקשות (10 לשעה). נסה שוב מאוחר יותר.'
        : 'שגיאה בניתוח התיק. אנא נסה שוב.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleDrillDown(rec) {
    setActiveTab('chat');
    // The AgentChat will pick up the next message via a prompt
    // We store a queued prompt in sessionStorage for AgentChat to read
    sessionStorage.setItem('agentDrillDown', `ספר לי יותר על ההמלצה: ${rec.action} ${rec.ticker_or_asset} — ${rec.rationale}`);
  }

  const analysis = result?.analysis;
  const portfolioHealth = result?.portfolioHealth || (typeof analysis === 'object' ? analysis?.portfolio_health : null);
  const allocationAnalysis = typeof analysis === 'object' ? analysis?.allocation_analysis : null;
  const recommendations = result?.recommendations || (typeof analysis === 'object' ? analysis?.recommendations : []) || [];
  const risks = typeof analysis === 'object' ? analysis?.risks : [];
  const summary = typeof analysis === 'object' ? analysis?.summary : (typeof analysis === 'string' ? analysis : null);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 h-full z-50 flex flex-col bg-white"
        style={{ width: 'min(480px, 100vw)', boxShadow: '-4px 0 32px rgba(0,0,0,0.12)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #6366f1, #3b82f6)' }}
            >
              AI
            </div>
            <span className="font-bold text-slate-800">סוכן השקעות</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-lg leading-none transition">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-4">
          {[
            { id: 'analysis', label: 'ניתוח תיק' },
            { id: 'chat',     label: 'שיחה עם הסוכן' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'analysis' && (
            <div className="p-4 space-y-4">
              {/* Analyze button */}
              <button
                onClick={handleAnalyze}
                disabled={loading}
                className="w-full py-3 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-60"
                style={{ background: loading ? '#94a3b8' : 'linear-gradient(135deg, #6366f1, #3b82f6)' }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    מנתח תיק... (עד 60 שניות)
                  </span>
                ) : 'נתח תיק עכשיו'}
              </button>

              {error && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">{error}</div>
              )}

              {/* Loading skeletons */}
              {loading && (
                <div className="space-y-3">
                  <SkeletonBlock h="h-40" />
                  <SkeletonBlock h="h-48" />
                  <SkeletonBlock h="h-28" />
                  <SkeletonBlock h="h-28" />
                </div>
              )}

              {/* Results */}
              {!loading && result && (
                <>
                  {/* Summary */}
                  {summary && (
                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                      <p className="text-sm text-blue-800 leading-relaxed" style={{ direction: 'rtl' }}>{summary}</p>
                    </div>
                  )}

                  {/* Health + Allocation side by side on wider screens */}
                  <div className="grid grid-cols-1 gap-4">
                    <PortfolioHealthCard health={portfolioHealth} />
                    <AllocationChart allocation={allocationAnalysis} />
                  </div>

                  {/* Risks */}
                  {risks && risks.length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">סיכונים</h3>
                      <div className="space-y-2">
                        {risks.map((risk, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <RiskBadge severity={risk.severity} />
                            <p className="text-xs text-slate-700 flex-1" style={{ direction: 'rtl' }}>
                              {risk.description || risk.type}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  {recommendations.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 px-1">המלצות</h3>
                      <div className="space-y-2">
                        {recommendations.map((rec, i) => (
                          <RecommendationCard key={i} rec={rec} onDrillDown={handleDrillDown} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Next review */}
                  {typeof analysis === 'object' && analysis?.next_review && (
                    <p className="text-xs text-center text-slate-400 pb-2">
                      ביקורת הבאה: {analysis.next_review}
                    </p>
                  )}
                </>
              )}

              {!loading && !result && !error && (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3">📊</div>
                  <p className="text-slate-500 text-sm">לחץ על "נתח תיק עכשיו" לניתוח הוליסטי מלא</p>
                  <p className="text-slate-400 text-xs mt-1">הסוכן יבחן את כל הנכסים שלך ויספק המלצות</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="h-full flex flex-col" style={{ minHeight: 'calc(100vh - 120px)' }}>
              <AgentChat />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
