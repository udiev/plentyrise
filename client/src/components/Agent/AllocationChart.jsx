/**
 * AllocationChart — side-by-side donut charts: current vs recommended allocation.
 */
import { useState } from 'react';

const CATEGORY_LABELS = {
  investments: 'מניות',
  crypto:      'קריפטו',
  real_estate: 'נדל״ן',
  cash:        'מזומן',
  pension:     'פנסיה',
  alternative: 'אלטרנטיבי',
};

const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#6366f1', '#ec4899', '#14b8a6'];

function buildArcPath(cx, cy, r, startAngle, endAngle) {
  const toRad = (deg) => (deg - 90) * (Math.PI / 180);
  const x1 = cx + r * Math.cos(toRad(startAngle));
  const y1 = cy + r * Math.sin(toRad(startAngle));
  const x2 = cx + r * Math.cos(toRad(endAngle));
  const y2 = cy + r * Math.sin(toRad(endAngle));
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

function DonutChart({ data, title }) {
  const [hovered, setHovered] = useState(null);
  const keys = Object.keys(data).filter(k => (data[k] || 0) > 0);
  let cumulative = 0;

  const slices = keys.map((key, i) => {
    const pct = data[key] || 0;
    const startAngle = cumulative * 3.6; // 100% → 360deg
    cumulative += pct;
    const endAngle = cumulative * 3.6;
    return { key, pct, startAngle, endAngle, color: COLORS[i % COLORS.length] };
  });

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</p>
      <svg viewBox="0 0 100 100" className="w-28 h-28">
        {slices.map((s) => (
          <path
            key={s.key}
            d={buildArcPath(50, 50, s.key === hovered ? 46 : 42, s.startAngle, s.endAngle)}
            fill={s.color}
            opacity={hovered && hovered !== s.key ? 0.5 : 1}
            onMouseEnter={() => setHovered(s.key)}
            onMouseLeave={() => setHovered(null)}
            className="cursor-pointer transition-all"
          />
        ))}
        {/* Center hole */}
        <circle cx="50" cy="50" r="28" fill="white" />
        {hovered && (
          <>
            <text x="50" y="47" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#1e293b">
              {data[hovered]?.toFixed(0)}%
            </text>
            <text x="50" y="57" textAnchor="middle" fontSize="7" fill="#64748b">
              {CATEGORY_LABELS[hovered] || hovered}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}

export default function AllocationChart({ allocation }) {
  if (!allocation) return null;

  const { current, recommended, gaps } = allocation;

  const allKeys = [...new Set([...Object.keys(current || {}), ...Object.keys(recommended || {})])];

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">הקצאת נכסים</h3>

      <div className="flex justify-around mb-4">
        {current && <DonutChart data={current} title="נוכחי" />}
        {recommended && <DonutChart data={recommended} title="מומלץ" />}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-1 mb-3">
        {allKeys.map((key, i) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
            <span className="text-xs text-slate-600">{CATEGORY_LABELS[key] || key}</span>
            {current?.[key] !== undefined && (
              <span className="text-xs text-slate-400 ml-auto">{current[key]?.toFixed(0)}%</span>
            )}
          </div>
        ))}
      </div>

      {/* Gaps */}
      {gaps && gaps.length > 0 && (
        <div className="border-t border-slate-100 pt-3 space-y-1">
          {gaps.map((gap, i) => (
            <p key={i} className="text-xs text-orange-600 flex items-start gap-1">
              <span>⚠</span>
              <span>{gap}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
