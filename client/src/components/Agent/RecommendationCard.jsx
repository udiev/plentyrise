/**
 * RecommendationCard — displays a single investment recommendation.
 */

const ACTION_STYLES = {
  buy:      { label: 'קנה',   bg: 'bg-green-100',  text: 'text-green-700' },
  sell:     { label: 'מכור',  bg: 'bg-red-100',    text: 'text-red-700'   },
  hold:     { label: 'החזק',  bg: 'bg-slate-100',  text: 'text-slate-600' },
  increase: { label: 'הגדל',  bg: 'bg-blue-100',   text: 'text-blue-700'  },
  decrease: { label: 'הקטן',  bg: 'bg-orange-100', text: 'text-orange-700'},
};

const HORIZON_LABELS = { 'short-term': 'טווח קצר', 'long-term': 'טווח ארוך' };

function ConfidenceStars({ level }) {
  const count = level === 'high' ? 3 : level === 'medium' ? 2 : 1;
  return (
    <div className="flex gap-0.5" title={`ביטחון: ${level}`}>
      {[1, 2, 3].map(i => (
        <svg key={i} className={`w-3 h-3 ${i <= count ? 'text-amber-400' : 'text-slate-200'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export default function RecommendationCard({ rec, onDrillDown }) {
  if (!rec) return null;

  const action = ACTION_STYLES[rec.action] || ACTION_STYLES.hold;

  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${action.bg} ${action.text}`}>
            {action.label}
          </span>
          <span className="font-semibold text-slate-800 text-sm">{rec.ticker_or_asset}</span>
        </div>
        <ConfidenceStars level={rec.confidence} />
      </div>

      <p className="text-xs text-slate-600 mb-3 leading-relaxed">{rec.rationale}</p>

      <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
        {rec.target && (
          <span className="flex items-center gap-1">
            <span className="text-green-500">↑</span>
            <span>יעד: {rec.target}</span>
          </span>
        )}
        {rec.stop_loss && (
          <span className="flex items-center gap-1">
            <span className="text-red-400">↓</span>
            <span>Stop: {rec.stop_loss}</span>
          </span>
        )}
        {rec.horizon && (
          <span className="ml-auto text-slate-400">{HORIZON_LABELS[rec.horizon] || rec.horizon}</span>
        )}
      </div>

      {onDrillDown && (
        <button
          onClick={() => onDrillDown(rec)}
          className="text-xs text-blue-500 hover:text-blue-700 font-medium transition-colors"
        >
          קרא עוד →
        </button>
      )}
    </div>
  );
}
