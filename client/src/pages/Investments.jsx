import { useState, useEffect } from 'react'
import Layout from '../components/layout/Layout'
import AssetTable from '../components/ui/AssetTable'
import CsvImportModal from '../components/ui/CsvImportModal'
import EditModal from '../components/ui/EditModal'
import { getInvestments, addInvestment, updateInvestment, deleteInvestment } from '../api/assets'
import api from '../api/client'
import useT from '../i18n/useT'

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

const CURRENCY_SYMBOLS = { USD: '$', ILS: '₪', EUR: '€', GBP: '£' }

const EDIT_FIELDS = [
  { key: 'symbol',              label: 'Symbol',        placeholder: 'e.g. AAPL or TEVA.TA' },
  { key: 'created_at',          label: 'Added On',      readOnly: true, type: 'date' },
  { key: 'name',                label: 'Name' },
  { key: 'asset_type',          label: 'Type', options: [
    { value: 'stock', label: 'Stock' }, { value: 'etf', label: 'ETF' },
    { value: 'bond', label: 'Bond' }, { value: 'mutual_fund', label: 'Mutual Fund' },
  ]},
  { key: 'quantity',            label: 'Quantity',       type: 'number' },
  { key: 'purchase_price',      label: 'Avg Cost',       type: 'number', placeholder: 'In native currency (NIS for ILS stocks)' },
  { key: 'current_price',       label: 'Current Price',  type: 'number', placeholder: 'Leave blank to keep auto-fetched price' },
  { key: 'auto_price_disabled', label: 'Disable Auto Price Update', type: 'checkbox', checkboxLabel: 'Keep manual price (stop auto-updating)' },
  { key: 'purchase_date',       label: 'Purchase Date',  type: 'date' },
  { key: 'currency',            label: 'Currency', options: [
    { value: 'USD', label: 'USD' }, { value: 'ILS', label: 'ILS' },
    { value: 'EUR', label: 'EUR' }, { value: 'GBP', label: 'GBP' },
  ]},
  { key: 'broker', label: 'Broker' },
]

const fmt    = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n || 0)
const fmtCur = (n, cur) => new Intl.NumberFormat('en-US', { style: 'currency', currency: cur || 'USD', maximumFractionDigits: 2 }).format(n || 0)

// Convert a price in native currency to USD
function toUSD(price, currency, fx) {
  if (!price) return 0
  return price * (fx[currency] || 1)
}

async function fetchTickerInfo(symbol) {
  const { data } = await api.get(`/investments/ticker-info/${symbol}`)
  return data
}

const inputCls = 'w-full rounded-lg px-3 py-2 text-sm focus:outline-none transition text-slate-800 placeholder-slate-400'
const inputStyle = { background: 'var(--surface2)', border: '1px solid rgba(0,0,0,0.1)' }

export default function Investments() {
  const [investments, setInvestments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ symbol: '', name: '', asset_type: 'stock', quantity: '', purchase_price: '', purchase_date: '', currency: 'USD', broker: '' })
  const [formInfo, setFormInfo] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [editRow, setEditRow] = useState(null)
  const [fx, setFx] = useState({ USD: 1, ILS: 0.27, EUR: 1.08, GBP: 1.27 })
  const tr = useT()

  useEffect(() => { getInvestments().then(setInvestments).finally(() => setLoading(false)) }, [])

  useEffect(() => {
    api.get('/settings/exchange-rates').then(r => {
      const map = { USD: 1 }
      for (const p of r.data.pairs || []) {
        if (p.to === 'USD') map[p.from] = p.rate
      }
      setFx(prev => ({ ...prev, ...map }))
    }).catch(() => {})
  }, [])

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

  const handleEdit = async (data) => {
    const payload = {
      symbol:               data.symbol ? data.symbol.toUpperCase() : undefined,
      name:                 data.name,
      asset_type:           data.asset_type,
      quantity:             parseFloat(data.quantity),
      purchase_price:       parseFloat(data.purchase_price),
      currency:             data.currency,
      broker:               data.broker,
      auto_price_disabled:  !!data.auto_price_disabled,
    }
    // Only send current_price if user actually typed something
    if (data.current_price !== '' && data.current_price !== null && data.current_price !== undefined) {
      payload.current_price = parseFloat(data.current_price)
    }
    const updated = await updateInvestment(editRow.id, payload)
    setInvestments(prev => prev.map(i => i.id === editRow.id ? updated : i))
    setEditRow(null)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete?')) return
    await deleteInvestment(id)
    setInvestments(prev => prev.filter(i => i.id !== id))
  }

  const totalValue = investments.reduce((s, i) => s + toUSD(i.quantity * (i.current_price || i.purchase_price), i.currency, fx), 0)
  const totalCost  = investments.reduce((s, i) => s + toUSD(i.quantity * i.purchase_price, i.currency, fx), 0)
  const pnl        = totalValue - totalCost
  const pnlPct     = totalCost > 0 ? (pnl / totalCost) * 100 : 0

  const columns = [
    { key: 'symbol', label: tr('symbol'), render: r => (
      <div className="flex items-center gap-2">
        <img src={`https://assets.parqet.com/logos/symbol/${r.symbol}`} alt="" className="w-7 h-7 rounded object-contain bg-slate-100 p-0.5 flex-shrink-0" onError={e => { e.target.style.display = 'none' }} />
        <div>
          <div className="font-semibold text-slate-800">{r.symbol}</div>
          <div className="text-slate-500 text-xs">{r.name} • {r.asset_type}</div>
          <div className="text-slate-400 text-xs mt-0.5">
            {r.purchase_date && <span>Bought {fmtDate(r.purchase_date)} · </span>}
            Added {fmtDate(r.created_at)}
          </div>
        </div>
      </div>
    )},
    { key: 'quantity',       label: tr('qty'),       align: 'right', render: r => r.quantity },
    { key: 'purchase_price', label: tr('avg_cost'),  align: 'right', render: r => (
      <div>
        <div>{fmtCur(r.purchase_price, r.currency)}</div>
        {r.currency !== 'USD' && <div className="text-xs text-slate-400">{fmt(toUSD(r.purchase_price, r.currency, fx))}</div>}
      </div>
    )},
    { key: 'current_price',  label: tr('current'),   align: 'right', render: r => r.current_price ? (
      <div>
        <div className="flex items-center justify-end gap-1">
          {fmtCur(r.current_price, r.currency)}
          {r.auto_price_disabled ? <span className="text-xs bg-amber-100 text-amber-700 px-1 rounded">manual</span> : null}
        </div>
        {r.currency !== 'USD' && <div className="text-xs text-slate-400">{fmt(toUSD(r.current_price, r.currency, fx))}</div>}
      </div>
    ) : <span className="text-slate-300">—</span> },
    { key: 'value',          label: tr('value'),     align: 'right', render: r => (
      <span className="font-semibold text-slate-800">{fmt(toUSD(r.quantity * (r.current_price || r.purchase_price), r.currency, fx))}</span>
    )},
    { key: 'pnl', label: tr('pnl'), align: 'right', render: r => {
      const valueUSD = toUSD(r.quantity * (r.current_price || r.purchase_price), r.currency, fx)
      const costUSD  = toUSD(r.quantity * r.purchase_price, r.currency, fx)
      const p = valueUSD - costUSD
      const pct = costUSD > 0 ? (p / costUSD) * 100 : 0
      return <span className={p >= 0 ? 'text-green-600' : 'text-red-600'}>{fmt(p)}<br/><span className="text-xs">{pct >= 0 ? '+' : ''}{pct.toFixed(2)}%</span></span>
    }},
  ]

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 md:mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">{tr('investments')}</h1>
          <p className="text-slate-500 text-sm mt-1">{tr('investments_sub')}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-200 transition bg-white border border-slate-200">{tr('import_csv')}</button>
          <button onClick={() => setShowForm(true)} className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition" style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}>{tr('add_investment')}</button>
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
          <h2 className="font-semibold mb-4 text-slate-800">{tr('add_investment')}</h2>
          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
          <div className="flex gap-2 mb-4">
            <input placeholder="Symbol (e.g. AAPL)" value={form.symbol} onChange={e => { setForm(p => ({ ...p, symbol: e.target.value.toUpperCase() })); setFormInfo(null) }} className={inputCls} style={{ ...inputStyle, flex: 1 }} />
            <button onClick={handleGetInfoForForm} disabled={!form.symbol} className="px-4 py-2 rounded-lg text-sm font-medium text-white transition disabled:opacity-40" style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}>{tr('get_info')}</button>
          </div>
          {formInfo && (
            <div className="flex items-center gap-3 mb-4 p-3 rounded-xl text-xs bg-slate-50 border border-slate-200">
              <img src={formInfo.logo_url} alt="" className="w-8 h-8 rounded object-contain bg-white p-0.5 border border-slate-200" onError={e => { e.target.style.display = 'none' }} />
              <div className="text-slate-600 space-y-0.5">
                {formInfo.name     && <div><span className="text-slate-400">Name:</span> {formInfo.name}</div>}
                {formInfo.sector   && <div><span className="text-slate-400">Sector:</span> {formInfo.sector}</div>}
                {formInfo.industry && <div><span className="text-slate-400">Industry:</span> {formInfo.industry}</div>}
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <input placeholder="Name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={inputCls} style={inputStyle} />
            <select value={form.asset_type} onChange={e => setForm(p => ({ ...p, asset_type: e.target.value }))} className={inputCls} style={inputStyle}>
              <option value="stock">Stock</option><option value="etf">ETF</option><option value="bond">Bond</option><option value="mutual_fund">Mutual Fund</option>
            </select>
            <select value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))} className={inputCls} style={inputStyle}>
              <option>USD</option><option>ILS</option><option>EUR</option><option>GBP</option>
            </select>
            <input placeholder="Quantity" type="number" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} className={inputCls} style={inputStyle} />
            <input placeholder="Purchase Price" type="number" value={form.purchase_price} onChange={e => setForm(p => ({ ...p, purchase_price: e.target.value }))} className={inputCls} style={inputStyle} />
            <input placeholder="Broker (optional)" value={form.broker} onChange={e => setForm(p => ({ ...p, broker: e.target.value }))} className={inputCls} style={inputStyle} />
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
        : <AssetTable columns={columns} rows={investments} onDelete={handleDelete} onEdit={setEditRow} emptyMessage="No investments yet." />}

      {showImport && <CsvImportModal endpoint="/investments/import" columns={CSV_COLUMNS} exampleRow={CSV_EXAMPLE} onClose={() => setShowImport(false)} onImported={(rows) => { setInvestments(prev => [...rows, ...prev]); setShowImport(false) }} />}
      {editRow && <EditModal title={`Edit ${editRow.symbol}`} fields={EDIT_FIELDS} initialValues={editRow} onSave={handleEdit} onClose={() => setEditRow(null)} onGetInfo={fetchTickerInfo} infoTriggerKey="symbol" />}
    </Layout>
  )
}
