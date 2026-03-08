export default function AssetTable({ columns, rows, onDelete, onEdit, emptyMessage }) {
  if (rows.length === 0) {
    return (
      <div className="text-center text-slate-600 py-16 border border-dashed border-slate-800 rounded-2xl">
        {emptyMessage || 'No data yet.'}
      </div>
    )
  }
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800">
            {columns.map(col => (
              <th key={col.key} className={`px-6 py-4 text-slate-400 font-medium ${col.align === 'right' ? 'text-right' : 'text-left'}`}>
                {col.label}
              </th>
            ))}
            <th className="px-6 py-4"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id} className={`border-b border-slate-800/50 hover:bg-slate-800/30 transition ${i % 2 === 0 ? '' : 'bg-slate-800/10'}`}>
              {columns.map(col => (
                <td key={col.key} className={`px-6 py-4 ${col.align === 'right' ? 'text-right' : ''}`}>
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
              <td className="px-6 py-4 text-right whitespace-nowrap">
                {onEdit && (
                  <button onClick={() => onEdit(row)} className="text-slate-600 hover:text-blue-400 transition text-xs mr-4">Edit</button>
                )}
                <button onClick={() => onDelete(row.id)} className="text-slate-600 hover:text-red-400 transition text-xs">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
