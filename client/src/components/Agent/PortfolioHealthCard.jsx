/**
 * PortfolioHealthCard — displays the agent's portfolio health score (0–10)
 * with a visual arc gauge and per-category breakdown.
 */
export default function PortfolioHealthCard({ health }) {
  if (!health) return null;

  const score = health.score ?? 0;
  const breakdown = health.breakdown || {};

  // Arc SVG parameters
  const radius = 52;
  const circumference = Math.PI * radius; // half-circle arc
  const filled = (score / 10) * circumference;

  const color = score >= 8 ? '#22c55e' : score >= 5 ? '#f97316' : '#ef4444';
  const label = score >= 8 ? 'מצוין' : score >= 5 ? 'בינוני' : 'נמוך';

  const breakdownItems = [
    { key: 'diversification', label: 'פיזור' },
    { key: 'risk',            label: 'סיכון' },
    { key: 'liquidity',       label: 'נזילות' },
    { key: 'returns',         label: 'תשואה' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">בריאות התיק</h3>

      {/* Arc gauge */}
      <div className="flex flex-col items-center mb-4">
        <svg viewBox="0 0 120 65" className="w-36 h-20">
          {/* Background arc */}
          <path
            d="M 10 60 A 50 50 0 0 1 110 60"
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="10"
            strokeLinecap="round"
          />
          {/* Filled arc */}
          <path
            d="M 10 60 A 50 50 0 0 1 110 60"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference}`}
          />
          {/* Score text */}
          <text x="60" y="58" textAnchor="middle" fontSize="18" fontWeight="bold" fill={color}>
            {score.toFixed(1)}
          </text>
          <text x="60" y="70" textAnchor="middle" fontSize="9" fill="#94a3b8">
            {label}
          </text>
        </svg>
      </div>

      {/* Breakdown bars */}
      <div className="space-y-2">
        {breakdownItems.map(({ key, label: itemLabel }) => {
          const val = breakdown[key] ?? 0;
          const barColor = val >= 8 ? 'bg-green-400' : val >= 5 ? 'bg-orange-400' : 'bg-red-400';
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="text-xs text-slate-500 w-14 text-right">{itemLabel}</span>
              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${(val / 10) * 100}%` }} />
              </div>
              <span className="text-xs font-medium text-slate-700 w-6">{val}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
