import { useState } from 'react'

/**
 * Generic edit modal.
 *
 * Props:
 *   title           – modal heading
 *   fields          – [{ key, label, type?, options?, readOnly?, fullWidth?, placeholder? }]
 *   initialValues   – object with current row values
 *   onSave(data)    – async, called with updated form data
 *   onClose()
 *   onGetInfo(sym)  – optional; async fn that returns { name, asset_type?, sector?, industry?, logo_url?, coin_id? }
 *                     if provided a "Get Info" button is shown next to the symbol/ticker field
 *   infoTriggerKey  – which field key triggers the lookup (default: 'symbol')
 */
function toDateInput(val) {
  if (!val) return ''
  try { return new Date(val).toISOString().split('T')[0] } catch { return '' }
}

export default function EditModal({ title, fields, initialValues, onSave, onClose, onGetInfo, infoTriggerKey = 'symbol' }) {
  // Normalize date fields to YYYY-MM-DD so <input type="date"> renders correctly
  const initForm = {}
  fields.forEach(f => {
    initForm[f.key] = f.type === 'date' ? toDateInput(initialValues[f.key]) : (initialValues[f.key] ?? '')
  })
  const [form, setForm] = useState(initForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fetching, setFetching] = useState(false)
  const [info, setInfo] = useState(null)

  const set = (key, value) => setForm(p => ({ ...p, [key]: value }))

  const handleGetInfo = async () => {
    const sym = form[infoTriggerKey]
    if (!sym) return
    setFetching(true)
    setError('')
    try {
      const result = await onGetInfo(sym)
      setInfo(result)
      // Auto-fill writable fields that returned data covers
      setForm(prev => ({
        ...prev,
        ...(result.name        && { name: result.name }),
        ...(result.asset_type  && { asset_type: result.asset_type }),
        ...(result.coin_id     && { coin_id: result.coin_id }),
      }))
    } catch {
      setError('Could not fetch info. Check the ticker symbol.')
    } finally {
      setFetching(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      await onSave(form)
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg mx-4">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl leading-none">✕</button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">

          {/* Get Info row */}
          {onGetInfo && (
            <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl border border-slate-700">
              {info?.logo_url && (
                <img
                  src={info.logo_url}
                  alt=""
                  className="w-9 h-9 rounded-lg object-contain bg-white p-0.5 flex-shrink-0"
                  onError={e => { e.target.style.display = 'none' }}
                />
              )}
              <div className="flex-1 min-w-0">
                {info ? (
                  <div className="text-xs text-slate-300 space-y-0.5">
                    {info.name     && <div><span className="text-slate-500">Name:</span> {info.name}</div>}
                    {info.sector   && <div><span className="text-slate-500">Sector:</span> {info.sector}</div>}
                    {info.industry && <div><span className="text-slate-500">Industry:</span> {info.industry}</div>}
                    {info.asset_type && <div><span className="text-slate-500">Type:</span> {info.asset_type}</div>}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Click to auto-fill name, type & sector from the web.
                  </p>
                )}
              </div>
              <button
                onClick={handleGetInfo}
                disabled={fetching || !form[infoTriggerKey]}
                className="flex-shrink-0 bg-blue-700 hover:bg-blue-600 px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-40"
              >
                {fetching ? '...' : 'Get Info'}
              </button>
            </div>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          {/* Fields */}
          <div className="grid grid-cols-2 gap-3">
            {fields.map(f => (
              <div key={f.key} className={f.fullWidth ? 'col-span-2' : ''}>
                <label className="block text-xs text-slate-500 mb-1">{f.label}</label>
                {f.readOnly ? (
                  <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-slate-400">
                    {f.type === 'date' && form[f.key]
                      ? new Date(form[f.key]).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : (form[f.key] ?? '—')}
                  </div>
                ) : f.options ? (
                  <select
                    value={form[f.key] ?? ''}
                    onChange={e => set(f.key, e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  >
                    {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <input
                    type={f.type || 'text'}
                    value={form[f.key] ?? ''}
                    onChange={e => set(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between p-6 border-t border-slate-800">
          <button onClick={onClose} className="bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg text-sm transition">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
