import { useState, useEffect } from 'react'
import Layout from '../components/layout/Layout'
import AssetTable from '../components/ui/AssetTable'
import CsvImportModal from '../components/ui/CsvImportModal'
import EditModal from '../components/ui/EditModal'
import { getCrypto, addCrypto, updateCrypto, deleteCrypto } from '../api/assets'
import api from '../api/client'
import useT from '../i18n/useT'

const CSV_COLUMNS = [
  { key: 'symbol', label: 'Symbol', required: true },
  { key: 'name', label: 'Name' },
  { key: 'quantity', label: 'Quantity', required: true, type: 'number' },
  { key: 'purchase_price_usd', label: 'Purchase Price USD', required: true, type: 'number' },
]
const CSV_EXAMPLE = { symbol: 'BTC', name: 'Bitcoin', quantity: 0.5, purchase_price_usd: 40000 }

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null

const EDIT_FIELDS = [
  { key: 'symbol',             label: 'Symbol',          readOnly: true },
  { key: 'created_at',         label: 'Added On',        readOnly: true, type: 'date' },
  { key: 'name',               label: 'Name' },
  { key: 'quantity',           label: 'Quantity',        type: 'number' },
  { key: 'purchase_price_usd', label: 'Avg Cost (USD)',  type: 'number' },
  { key: 'purchase_date',      label: 'Purchase Date',   type: 'date' },
]

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n || 0)

async function fetchCoinInfo(symbol) {
  const { data } = await api.get(`/crypto/coin-info/${symbol}`)
  return data
}

const inputCls = 'w-full rounded-lg px-3 py-2 text-sm focus:outline-none transition text-slate-800 placeholder-slate-400'
const inputStyle = { background: 'var(--surface2)', border: '1px solid rgba(0,0,0,0.1)' }

export default function Crypto() {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ symbol: '', name: '', quantity: '', purchase_price_usd: '', purchase_date: '' })
  const [formInfo, setFormInfo] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [editRow, setEditRow] = useState(null)
  const tr = useT()

  useEffect(() => { getCrypto().then(setAssets).finally(() => setLoading(false)) }, [])

  const handleGetInfoForForm = async () => {
    if (!form.symbol) return
    try {
      const info = await fetchCoinInfo(form.symbol)
      setFormInfo(info)
      setForm(p => ({ ...p, name: info.name || p.name }))
    } catch { setError('Coin not found on CoinGecko') }
  }

  const handleAdd = async () => {
    if (!form.symbol || !form.quantity || !form.purchase_price_usd) { setError('All fields required'); return }
    setSaving(true); setError('')
    try {
      const asset = await addCrypto({ ...form, quantity: parseFloat(form.quantity), purchase_price_usd: parseFloat(form.purchase_price_usd) })
      setAssets(prev => [asset, ...prev])
      setShowForm(false)
      setForm({ symbol: '', name: '', quantity: '', purchase_price_usd: '', purchase_date: '' })
      setFormInfo(null)
    } catch (err) { setError(err.response?.data?.error || 'Failed') }
    finally { setSaving(false) }
  }

  const handleEdit = async (data) => {
    const updated = await updateCrypto(editRow.id, { name: data.name, quantity: parseFloat(data.quantity), purchase_price_usd: parseFloat(data.purchase_price_usd) })
    setAssets(prev => prev.map(a => a.id === editRow.id ? updated : a))
    setEditRow(null)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete?')) return
    await deleteCrypto(id)
    setAssets(prev => prev.filter(a => a.id !== id))
  }

  const totalValue = assets.reduce((s, a) => s + a.quantity * (a.current_price_usd || a.purchase_price_usd), 0)
  const totalCost  = assets.reduce((s, a) => s + a.quantity * a.purchase_price_usd, 0)
  const pnl        = totalValue - totalCost
  const pnlPct     = totalCost > 0 ? (pnl / totalCost) * 100 : 0

  const columns = [
    { key: 'symbol', label: tr('symbol'), render: r => (
      <div className="flex items-center gap-2">
        <img src={`https://assets.parqet.com/logos/symbol/${r.symbol}`} alt="" className="w-7 h-7 rounded-full object-contain bg-slate-100 p-0.5 flex-shrink-0" onError={e => { e.target.style.display = 'none' }} />
        <div>
          <div className="font-semibold text-slate-800">{r.symbol}</div>
          <div className="text-slate-500 text-xs">{r.name}</div>
          <div className="text-slate-400 text-xs mt-0.5">
            {r.purchase_date && <span>Bought {fmtDate(r.purchase_date)} · </span>}
            Added {fmtDate(r.created_at)}
          </div>
        </div>
      </div>
    )},
    { key: 'quantity',           label: tr('qty'),       align: 'right', render: r => r.quantity },
    { key: 'purchase_price_usd', label: tr('avg_cost'),  align: 'right', render: r => fmt(r.purchase_price_usd) },
    { key: 'current_price_usd',  label: tr('current'),   align: 'right', render: r => r.current_price_usd ? fmt(r.current_price_usd) : <span className="text-slate-300">—</span> },
    { key: 'value',              label: tr('value'),     align: 'right', render: r => <span className="font-semibold text-slate-800">{fmt(r.quantity * (r.current_price_usd || r.purchase_price_usd))}</span> },
    { key: 'pnl', label: tr('pnl'), align: 'right', render: r => {
      const p = r.quantity * ((r.current_price_usd || r.purchase_price_usd) - r.purchase_price_usd)
      const pct = r.purchase_price_usd > 0 ? (p / (r.quantity * r.purchase_price_usd)) * 100 : 0
      return <span className={p >= 0 ? 'text-green-600' : 'text-red-600'}>{fmt(p)}<br/><span className="text-xs">{pct >= 0 ? '+' : ''}{pct.toFixed(2)}%</span></span>
    }},
  ]

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 md:mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">{tr('crypto')}</h1>
          <p className="text-slate-500 text-sm mt-1">{tr('crypto_sub')}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-200 transition bg-white border border-slate-200">{tr('import_csv')}</button>
          <button onClick={() => setShowForm(true)} className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition" style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}>{tr('add_crypto')}</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
        <div className="rounded-2xl p-5 bg-white" style={{ border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
          <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Total Value</p>
          <p className="text-xl font-bold font-num text-slate-800">{fmt(totalValue)}</p>
        </div>
        <div className="rounded-2xl p-5 bg-white" style={{ border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
          <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Cost Basis</p>
          <p className="text-xl font-bold font-num text-slate-800">{fmt(totalCost)}</p>
        </div>
        <div className="rounded-2xl p-5 bg-white" style={{ border: `1px solid ${pnl >= 0 ? 'rgba(5,150,105,0.25)' : 'rgba(220,38,38,0.25)'}`, boxShadow: 'var(--card-shadow)' }}>
          <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Total P&L</p>
          <p className={`text-xl font-bold font-num ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(pnl)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)</p>
        </div>
      </div>

      {showForm && (
        <div className="rounded-2xl p-5 md:p-6 mb-6 bg-white" style={{ border: '1px solid rgba(59,130,246,0.3)', boxShadow: 'var(--card-shadow)' }}>
          <h2 className="font-semibold mb-4 text-slate-800">{tr('add_crypto')}</h2>
          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
          <div className="flex gap-2 mb-4">
            <input placeholder="Symbol (e.g. BTC)" value={form.symbol} onChange={e => { setForm(p => ({ ...p, symbol: e.target.value.toUpperCase() })); setFormInfo(null) }} className={inputCls} style={{ ...inputStyle, flex: 1 }} />
            <button onClick={handleGetInfoForForm} disabled={!form.symbol} className="px-4 py-2 rounded-lg text-sm font-medium text-white transition disabled:opacity-40" style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}>{tr('get_info')}</button>
          </div>
          {formInfo && (
            <div className="flex items-center gap-3 mb-4 p-3 rounded-xl text-xs bg-slate-50 border border-slate-200">
              {formInfo.logo_url && <img src={formInfo.logo_url} alt="" className="w-8 h-8 rounded-full object-contain" onError={e => { e.target.style.display = 'none' }} />}
              <div className="text-slate-600">
                <div><span className="text-slate-400">Name:</span> {formInfo.name}</div>
                <div><span className="text-slate-400">CoinGecko ID:</span> {formInfo.coin_id}</div>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <input placeholder="Name (e.g. Bitcoin)" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={inputCls} style={inputStyle} />
            <input placeholder="Quantity" type="number" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} className={inputCls} style={inputStyle} />
            <input placeholder="Purchase Price (USD)" type="number" value={form.purchase_price_usd} onChange={e => setForm(p => ({ ...p, purchase_price_usd: e.target.value }))} className={inputCls} style={inputStyle} />
            <div>
              <label className="block text-xs text-slate-500 mb-1">Purchase Date (optional)</label>
              <input type="date" value={form.purchase_date} onChange={e => setForm(p => ({ ...p, purchase_date: e.target.value }))} className={inputCls} style={inputStyle} />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleAdd} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}>{saving ? tr('saving') : tr('save')}</button>
            <button onClick={() => { setShowForm(false); setError(''); setFormInfo(null) }} className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition border border-slate-200">{tr('cancel')}</button>
          </div>
        </div>
      )}

      {loading ? <div className="text-center text-slate-400 py-16 animate-pulse">Loading...</div>
        : <AssetTable columns={columns} rows={assets} onDelete={handleDelete} onEdit={setEditRow} emptyMessage="No crypto assets yet." />}

      {showImport && <CsvImportModal endpoint="/crypto/import" columns={CSV_COLUMNS} exampleRow={CSV_EXAMPLE} onClose={() => setShowImport(false)} onImported={(rows) => { setAssets(prev => [...rows, ...prev]); setShowImport(false) }} />}
      {editRow && <EditModal title={`Edit ${editRow.symbol}`} fields={EDIT_FIELDS} initialValues={editRow} onSave={handleEdit} onClose={() => setEditRow(null)} onGetInfo={fetchCoinInfo} infoTriggerKey="symbol" />}
    </Layout>
  )
}
