import { useState, useEffect } from 'react'
import Layout from '../components/layout/Layout'
import AssetTable from '../components/ui/AssetTable'
import CsvImportModal from '../components/ui/CsvImportModal'
import EditModal from '../components/ui/EditModal'
import { getCrypto, addCrypto, updateCrypto, deleteCrypto } from '../api/assets'
import api from '../api/client'

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

  useEffect(() => { getCrypto().then(setAssets).finally(() => setLoading(false)) }, [])

  // ── Add ──────────────────────────────────────────────────────────────────
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

  // ── Edit ─────────────────────────────────────────────────────────────────
  const handleEdit = async (data) => {
    const updated = await updateCrypto(editRow.id, {
      name: data.name,
      quantity: parseFloat(data.quantity),
      purchase_price_usd: parseFloat(data.purchase_price_usd),
    })
    setAssets(prev => prev.map(a => a.id === editRow.id ? updated : a))
    setEditRow(null)
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!confirm('Delete?')) return
    await deleteCrypto(id)
    setAssets(prev => prev.filter(a => a.id !== id))
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalValue = assets.reduce((s, a) => s + a.quantity * (a.current_price_usd || a.purchase_price_usd), 0)
  const totalCost  = assets.reduce((s, a) => s + a.quantity * a.purchase_price_usd, 0)
  const pnl        = totalValue - totalCost
  const pnlPct     = totalCost > 0 ? (pnl / totalCost) * 100 : 0

  const columns = [
    { key: 'symbol', label: 'Symbol', render: r => (
      <div className="flex items-center gap-2">
        <img src={`https://assets.parqet.com/logos/symbol/${r.symbol}`} alt="" className="w-7 h-7 rounded-full object-contain bg-white/5 p-0.5 flex-shrink-0" onError={e => { e.target.style.display = 'none' }} />
        <div>
          <div className="font-semibold">{r.symbol}</div>
          <div className="text-slate-500 text-xs">{r.name}</div>
          <div className="text-slate-600 text-xs mt-0.5">
            {r.purchase_date && <span>Bought {fmtDate(r.purchase_date)} · </span>}
            Added {fmtDate(r.created_at)}
          </div>
        </div>
      </div>
    )},
    { key: 'quantity',           label: 'Quantity',  align: 'right', render: r => r.quantity },
    { key: 'purchase_price_usd', label: 'Avg Cost',  align: 'right', render: r => fmt(r.purchase_price_usd) },
    { key: 'current_price_usd',  label: 'Current',   align: 'right', render: r => r.current_price_usd ? fmt(r.current_price_usd) : <span className="text-slate-600">—</span> },
    { key: 'value',              label: 'Value',     align: 'right', render: r => <span className="font-semibold">{fmt(r.quantity * (r.current_price_usd || r.purchase_price_usd))}</span> },
    { key: 'pnl', label: 'P&L', align: 'right', render: r => {
      const p = r.quantity * ((r.current_price_usd || r.purchase_price_usd) - r.purchase_price_usd)
      const pct = r.purchase_price_usd > 0 ? (p / (r.quantity * r.purchase_price_usd)) * 100 : 0
      return <span className={p >= 0 ? 'text-green-400' : 'text-red-400'}>{fmt(p)}<br/><span className="text-xs">{pct >= 0 ? '+' : ''}{pct.toFixed(2)}%</span></span>
    }},
  ]

  return (
    <Layout>
      <div className="flex items-center justify-between mb-8">
        <div><h1 className="text-2xl font-bold">Crypto</h1><p className="text-slate-500 text-sm mt-1">Digital assets portfolio</p></div>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition">Import CSV</button>
          <button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-semibold transition">+ Add Crypto</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5"><p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Total Value</p><p className="text-xl font-bold">{fmt(totalValue)}</p></div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5"><p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Cost Basis</p><p className="text-xl font-bold">{fmt(totalCost)}</p></div>
        <div className={`bg-slate-900 border rounded-2xl p-5 ${pnl >= 0 ? 'border-green-500/30' : 'border-red-500/30'}`}>
          <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Total P&L</p>
          <p className={`text-xl font-bold ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(pnl)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)</p>
        </div>
      </div>

      {showForm && (
        <div className="bg-slate-900 border border-blue-500/30 rounded-2xl p-6 mb-6">
          <h2 className="font-semibold mb-4">Add Crypto Asset</h2>
          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

          {/* Coin lookup */}
          <div className="flex gap-2 mb-4">
            <input
              placeholder="Symbol (e.g. BTC)"
              value={form.symbol}
              onChange={e => { setForm(p => ({ ...p, symbol: e.target.value.toUpperCase() })); setFormInfo(null) }}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 flex-1"
            />
            <button
              onClick={handleGetInfoForForm}
              disabled={!form.symbol}
              className="bg-blue-700 hover:bg-blue-600 px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-40"
            >
              Get Info
            </button>
          </div>

          {formInfo && (
            <div className="flex items-center gap-3 mb-4 p-3 bg-slate-800/60 rounded-xl border border-slate-700 text-xs">
              {formInfo.logo_url && <img src={formInfo.logo_url} alt="" className="w-8 h-8 rounded-full object-contain" onError={e => { e.target.style.display = 'none' }} />}
              <div className="text-slate-300">
                <div><span className="text-slate-500">Name:</span> {formInfo.name}</div>
                <div><span className="text-slate-500">CoinGecko ID:</span> {formInfo.coin_id}</div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <input placeholder="Name (e.g. Bitcoin)" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            <input placeholder="Quantity" type="number" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            <input placeholder="Purchase Price (USD)" type="number" value={form.purchase_price_usd} onChange={e => setForm(p => ({ ...p, purchase_price_usd: e.target.value }))} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            <div>
              <label className="block text-xs text-slate-500 mb-1">Purchase Date (optional)</label>
              <input type="date" value={form.purchase_date} onChange={e => setForm(p => ({ ...p, purchase_date: e.target.value }))} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleAdd} disabled={saving} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
            <button onClick={() => { setShowForm(false); setError(''); setFormInfo(null) }} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-sm transition">Cancel</button>
          </div>
        </div>
      )}

      {loading ? <div className="text-center text-slate-500 py-16 animate-pulse">Loading...</div>
        : <AssetTable columns={columns} rows={assets} onDelete={handleDelete} onEdit={setEditRow} emptyMessage="No crypto assets yet." />}

      {showImport && (
        <CsvImportModal
          endpoint="/crypto/import"
          columns={CSV_COLUMNS}
          exampleRow={CSV_EXAMPLE}
          onClose={() => setShowImport(false)}
          onImported={(rows) => { setAssets(prev => [...rows, ...prev]); setShowImport(false) }}
        />
      )}

      {editRow && (
        <EditModal
          title={`Edit ${editRow.symbol}`}
          fields={EDIT_FIELDS}
          initialValues={editRow}
          onSave={handleEdit}
          onClose={() => setEditRow(null)}
          onGetInfo={fetchCoinInfo}
          infoTriggerKey="symbol"
        />
      )}
    </Layout>
  )
}
