export default function AssetTable({ columns, rows, onDelete, onEdit, emptyMessage }) {
  if (rows.length === 0) {
    return (
      <div
        className="text-center py-16 rounded-2xl bg-white"
        style={{ border: '1px dashed rgba(0,0,0,0.12)' }}
      >
        <div className="text-3xl mb-3 opacity-30">📭</div>
        <p className="text-slate-400 text-sm">{emptyMessage || 'No data yet.'}</p>
      </div>
    )
  }

  return (
    <div
      className="rounded-2xl overflow-hidden bg-white"
      style={{ border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: 640 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: '#FAFBFC' }}>
              {columns.map(col => (
                <th
                  key={col.key}
                  className={`px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                >
                  {col.label}
                </th>
              ))}
              <th className="px-5 py-3.5 w-20" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.id}
                className="transition-colors"
                style={{
                  borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none',
                  background: i % 2 === 1 ? 'rgba(0,0,0,0.015)' : 'transparent',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#F0F4FF'}
                onMouseLeave={e => e.currentTarget.style.background = i % 2 === 1 ? 'rgba(0,0,0,0.015)' : 'transparent'}
              >
                {columns.map(col => (
                  <td key={col.key} className={`px-5 py-4 text-slate-800 ${col.align === 'right' ? 'text-right font-num' : ''}`}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
                <td className="px-5 py-4 text-right whitespace-nowrap">
                  {onEdit && (
                    <button
                      onClick={() => onEdit(row)}
                      title="Edit"
                      className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition mr-1"
                    >
                      ✏
                    </button>
                  )}
                  <button
                    onClick={() => onDelete(row.id)}
                    title="Delete"
                    className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                  >
                    🗑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
