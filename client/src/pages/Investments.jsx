import { useState, useEffect } from 'react'
import Layout from '../components/layout/Layout'
import AssetTable from '../components/ui/AssetTable'
import CsvImportModal from '../components/ui/CsvImportModal'
import EditModal from '../components/ui/EditModal'
import { getInvestments, addInvestment, updateInvestment, deleteInvestment } from '../api/assets'
import api from '../api/client'

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null

const CSV_COLUMNS = [
  { key: 'symbol', label: 'Symbol', required: true },
  { key: 'name', label: 'Name' },
  { key: 'asset_type', label: 'Asset Type', default: 'stock' },
  { key: 'quantity', label: 'Quantity', required: true, type: 'number' },
  { key: 'purchase_price', label: 'Purchase Price', required: true, type: 'number' },
  { key: 'currency', label: 'Currency', default: 'USD' },
  { key: 'broker', label: 'Broker' },
]
const CSV_EXAMPLE = { symbol: 'AAPL', name: 'Apple Inc', asset_type: 'stock', quantity: 10, purchase_price: 150.00, currency: 'USD', broker: 'IBKR' }

const EDIT_FIELDS = [
  { key: 'symbol',         label: 'Symbol',         readOnly: true },
  { key: 'name',           label: 'Name' },
  { key: 'asset_type',     label: 'Type', options: [
    { value: 'stock', label: 'Stock' }, { value: 'etf', label: 'ETF' },
    { value: 'bond', label: 'Bond' }, { value: 'mutual_fund', label: 'Mutual Fund' },
  ]},
  { key: 'quantity',       label: 'Quantity',       type: 'number' },
  { key: 'purchase_price', label: 'Avg Cost (USD)', type: 'number' },
  { key: 'purchase_date',  label: 'Purchase Date',  type: 'date' },
  { key: 'currency',       label: 'Currency', options: [
    { value: 'USD', label: 'USD' }, { value: 'ILS', label: 'ILS' },
    { value: 'EUR', label: 'EUR' }, { value: 'GBP', label: 'GBP' },
  ]},
  { key: 'broker', label: 'Broker' },
]

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n || 0)

async function fetchTickerInfo(symbol) {
  const { data } = await api.get(`/investments/ticker-info/${symbol}`)
  return data
}

export default function Investments() {
  const [investments, setInvestments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ symbol: '', name: '', asset_type: 'stock', quantity: '', purchase_price: '', purchase_date: '', currency: 'USD', broker: '' })
  const [formInfo, setFormInfo] = useState(null)   // fetched ticker info for the add form
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [editRow, setEditRow] = useState(null)

  useEffect(() => { getInvestments().then(setInvestments).finally(() => setLoading(false)) }, [])

  // ── Add ──────────────────────────────────────────────────────────────────
  const handleGetInfoForForm = async () => {
    if (!form.symbol) return
    try {
      const info = await fetchTickerInfo(form.symbol)
      setFormInfo(info)
      setForm(p => ({ ...p, name: info.name || p.name, asset_type: info.asset_type || p.asset_type }))
    } catch { setError('Could not fetch ticker info') }
  }

  const handleAdd = async () => {
    if (!form.symbol || !form.quantity || !form.purchase_price) { setError('Symbol, quantity and price required'); return }
    setSaving(true); setError('')
    try {
      const inv = await addInvestment({ ...form, quantity: parseFloat(form.quantity), purchase_price: parseFloat(form.purchase_price) })
      setInvestments(prev => [inv, ...prev])
      setShowForm(false)
      setForm({ symbol: '', name: '', asset_type: 'stock', quantity: '', purchase_price: '', purchase_date: '', currency: 'USD', broker: '' })
      setFormInfo(null)
    } catch (err) { setError(err.response?.data?.error || 'Failed') }
    finally { setSaving(false) }
  }

  // ── Edit ─────────────────────────────────────────────────────────────────
  const handleEdit = async (data) => {
    const updated = await updateInvestment(editRow.id, {
      name: data.name,
      asset_type: data.asset_type,
      quantity: parseFloat(data.quantity),
      purchase_price: parseFloat(data.purchase_price),
      currency: data.currency,
      broker: data.broker,
    })
    setInvestments(prev => prev.map(i => i.id === editRow.id ? updated : i))
    setEditRow(null)
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!confirm('Delete?')) return
    await deleteInvestment(id)
    setInvestments(prev => prev.filter(i => i.id !== id))
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalValue = investments.reduce((s, i) => s + i.quantity * (i.current_price || i.purchase_price), 0)
  const totalCost  = investments.reduce((s, i) => s + i.quantity * i.purchase_price, 0)
  const pnl        = totalValue - totalCost
  const pnlPct     = totalCost > 0 ? (pnl / totalCost) * 100 : 0

  const columns = [
    { key: 'symbol', label: 'Symbol', render: r => (
      <div className="flex items-center gap-2">
        <img src={`https://assets.parqet.com/logos/symbol/${r.symbol}`} alt="" className="w-7 h-7 rounded object-contain bg-white/5 p-0.5 flex-shrink-0" onError={e => { e.target.style.display = 'none' }} />
        <div>
          <div className="font-semibold">{r.symbol}</div>
          <div className="text-slate-500 text-xs">{r.name} • {r.asset_type}</div>
          <div className="text-slate-600 text-xs mt-0.5">
            {r.purchase_date && <span>Bought {fmtDate(r.purchase_date)} · </span>}
            Added {fmtDate(r.created_at)}
          </div>
        </div>
      </div>
    )},
    { key: 'quantity',       label: 'Qty',       align: 'right', render: r => r.quantity },
    { key: 'purchase_price', label: 'Avg Cost',  align: 'right', render: r => fmt(r.purchase_price) },
    { key: 'current_price',  label: 'Current',   align: 'right', render: r => r.current_price ? fmt(r.current_price) : <span className="text-slate-600">—</span> },
    { key: 'value',          label: 'Value',     align: 'right', render: r => <span className="font-semibold">{fmt(r.quantity * (r.current_price || r.purchase_price))}</span> },
    { key: 'pnl', label: 'P&L', align: 'right', render: r => {
      const p = r.quantity * ((r.current_price || r.purchase_price) - r.purchase_price)
      const pct = (p / (r.quantity * r.purchase_price)) * 100
      return <span className={p >= 0 ? 'text-green-400' : 'text-red-400'}>{fmt(p)}<br/><span className="text-xs">{pct >= 0 ? '+' : ''}{pct.toFixed(2)}%</span></span>
    }},
  ]

  return (
    <Layout>
      <div className="flex items-center justify-between mb-8">
        <div><h1 className="text-2xl font-bold">Investments</h1><p className="text-slate-500 text-sm mt-1">Stocks, ETFs, Bonds, Mutual Funds</p></div>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition">Import CSV</button>
          <button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-semibold transition">+ Add Investment</button>
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
          <h2 className="font-semibold mb-4">Add Investment</h2>
          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

          {/* Ticker lookup */}
          <div className="flex gap-2 mb-4">
            <input
              placeholder="Symbol (e.g. AAPL)"
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
              <img src={formInfo.logo_url} alt="" className="w-8 h-8 rounded object-contain bg-white p-0.5" onError={e => { e.target.style.display = 'none' }} />
              <div className="text-slate-300 space-y-0.5">
                {formInfo.name     && <div><span className="text-slate-500">Name:</span> {formInfo.name}</div>}
                {formInfo.sector   && <div><span className="text-slate-500">Sector:</span> {formInfo.sector}</div>}
                {formInfo.industry && <div><span className="text-slate-500">Industry:</span> {formInfo.industry}</div>}
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <input placeholder="Name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            <select value={form.asset_type} onChange={e => setForm(p => ({ ...p, asset_type: e.target.value }))} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
              <option value="stock">Stock</option><option value="etf">ETF</option><option value="bond">Bond</option><option value="mutual_fund">Mutual Fund</option>
            </select>
            <select value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
              <option>USD</option><option>ILS</option><option>EUR</option><option>GBP</option>
            </select>
            <input placeholder="Quantity" type="number" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            <input placeholder="Purchase Price" type="number" value={form.purchase_price} onChange={e => setForm(p => ({ ...p, purchase_price: e.target.value }))} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            <input placeholder="Broker (optional)" value={form.broker} onChange={e => setForm(p => ({ ...p, broker: e.target.value }))} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
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
        : <AssetTable columns={columns} rows={investments} onDelete={handleDelete} onEdit={setEditRow} emptyMessage="No investments yet." />}

      {showImport && (
        <CsvImportModal
          endpoint="/investments/import"
          columns={CSV_COLUMNS}
          exampleRow={CSV_EXAMPLE}
          onClose={() => setShowImport(false)}
          onImported={(rows) => { setInvestments(prev => [...rows, ...prev]); setShowImport(false) }}
        />
      )}

      {editRow && (
        <EditModal
          title={`Edit ${editRow.symbol}`}
          fields={EDIT_FIELDS}
          initialValues={editRow}
          onSave={handleEdit}
          onClose={() => setEditRow(null)}
          onGetInfo={fetchTickerInfo}
          infoTriggerKey="symbol"
        />
      )}
    </Layout>
  )
}
