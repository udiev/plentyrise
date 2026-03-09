import { useState } from 'react'

function toDateInput(val) {
  if (!val) return ''
  try { return new Date(val).toISOString().split('T')[0] } catch { return '' }
}

export default function EditModal({ title, fields, initialValues, onSave, onClose, onGetInfo, infoTriggerKey = 'symbol' }) {
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

  const inputCls = 'w-full rounded-lg px-3 py-2 text-sm focus:outline-none transition text-slate-800 placeholder-slate-400'
  const inputStyle = { background: 'var(--surface2)', border: '1px solid rgba(0,0,0,0.1)' }
  const inputFocusStyle = { borderColor: 'var(--accent)', background: '#fff' }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div
        className="w-full sm:max-w-lg sm:mx-4 sm:rounded-2xl flex flex-col bg-white"
        style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.15)', maxHeight: '100dvh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0 border-b border-slate-100">
          <h2 className="font-semibold text-base text-slate-800">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none transition">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Get Info row */}
          {onGetInfo && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
              {info?.logo_url && (
                <img
                  src={info.logo_url}
                  alt=""
                  className="w-9 h-9 rounded-lg object-contain bg-white p-0.5 flex-shrink-0 border border-slate-200"
                  onError={e => { e.target.style.display = 'none' }}
                />
              )}
              <div className="flex-1 min-w-0">
                {info ? (
                  <div className="text-xs text-slate-600 space-y-0.5">
                    {info.name     && <div><span className="text-slate-400">Name:</span> {info.name}</div>}
                    {info.sector   && <div><span className="text-slate-400">Sector:</span> {info.sector}</div>}
                    {info.industry && <div><span className="text-slate-400">Industry:</span> {info.industry}</div>}
                    {info.asset_type && <div><span className="text-slate-400">Type:</span> {info.asset_type}</div>}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Click to auto-fill name, type & sector from the web.</p>
                )}
              </div>
              <button
                onClick={handleGetInfo}
                disabled={fetching || !form[infoTriggerKey]}
                className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}
              >
                {fetching ? '...' : 'Get Info'}
              </button>
            </div>
          )}

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {fields.map(f => (
              <div key={f.key} className={f.fullWidth ? 'sm:col-span-2' : ''}>
                <label className="block text-xs font-medium text-slate-500 mb-1">{f.label}</label>
                {f.readOnly ? (
                  <div className="rounded-lg px-3 py-2 text-sm text-slate-500 bg-slate-50 border border-slate-200">
                    {f.type === 'date' && form[f.key]
                      ? new Date(form[f.key]).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : (form[f.key] ?? '—')}
                  </div>
                ) : f.options ? (
                  <select
                    value={form[f.key] ?? ''}
                    onChange={e => set(f.key, e.target.value)}
                    className={inputCls}
                    style={inputStyle}
                    onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                    onBlur={e => Object.assign(e.target.style, inputStyle)}
                  >
                    {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <input
                    type={f.type || 'text'}
                    value={form[f.key] ?? ''}
                    onChange={e => set(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className={inputCls}
                    style={inputStyle}
                    onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                    onBlur={e => Object.assign(e.target.style, inputStyle)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between px-6 py-4 flex-shrink-0 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition border border-slate-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-lg text-sm font-semibold text-white transition disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
