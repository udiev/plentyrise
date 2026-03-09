import { useState, useEffect } from 'react'
import Layout from '../components/layout/Layout'
import AssetTable from '../components/ui/AssetTable'
import CsvImportModal from '../components/ui/CsvImportModal'
import EditModal from '../components/ui/EditModal'
import { getRealEstate, addRealEstate, updateRealEstate, deleteRealEstate } from '../api/assets'
import useT from '../i18n/useT'

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null

function ExitDateBadge({ date }) {
  if (!date) return <span className="text-slate-300">—</span>
  const d = new Date(date)
  const now = new Date()
  const threeMonths = new Date(); threeMonths.setMonth(threeMonths.getMonth() + 3)
  if (d < now) return <span className="text-slate-400 text-xs">⚪ Exited · {d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
  if (d <= threeMonths) return <span className="text-orange-500 text-xs">🟠 {d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} · Soon</span>
  return <span className="text-green-600 text-xs">🟢 {d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
}

const EDIT_FIELDS = [
  { key: 'name',              label: 'Name',             fullWidth: true },
  { key: 'created_at',        label: 'Added On',         readOnly: true, type: 'date' },
  { key: 'purchase_date',     label: 'Purchase Date',    type: 'date' },
  { key: 'property_type',     label: 'Type', options: [
    { value: 'apartment', label: 'Apartment' }, { value: 'house', label: 'House' },
    { value: 'commercial', label: 'Commercial' }, { value: 'land', label: 'Land' },
  ]},
  { key: 'currency',          label: 'Currency', options: [
    { value: 'ILS', label: 'ILS' }, { value: 'USD', label: 'USD' },
    { value: 'EUR', label: 'EUR' }, { value: 'GBP', label: 'GBP' },
  ]},
  { key: 'current_value',     label: 'Current Value',    type: 'number' },
  { key: 'monthly_income',    label: 'Monthly Income',   type: 'number' },
  { key: 'monthly_expenses',  label: 'Monthly Expenses', type: 'number' },
  { key: 'exit_date',         label: 'Exit Date',        type: 'date' },
  { key: 'address',           label: 'Address',          fullWidth: true },
]

const CSV_COLUMNS = [
  { key: 'name', label: 'Name', required: true },
  { key: 'property_type', label: 'Property Type', default: 'apartment' },
  { key: 'purchase_price', label: 'Purchase Price', required: true, type: 'number' },
  { key: 'current_value', label: 'Current Value', required: true, type: 'number' },
  { key: 'currency', label: 'Currency', default: 'ILS' },
  { key: 'monthly_income', label: 'Monthly Income', type: 'number', default: 0 },
  { key: 'monthly_expenses', label: 'Monthly Expenses', type: 'number', default: 0 },
  { key: 'address', label: 'Address' },
]
const CSV_EXAMPLE = { name: 'Tel Aviv Apt', property_type: 'apartment', purchase_price: 2000000, current_value: 2500000, currency: 'ILS', monthly_income: 6000, monthly_expenses: 1000, address: '1 Dizengoff St' }

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0)

const inputCls = 'w-full rounded-lg px-3 py-2 text-sm focus:outline-none transition text-slate-800 placeholder-slate-400'
const inputStyle = { background: 'var(--surface2)', border: '1px solid rgba(0,0,0,0.1)' }

export default function RealEstate() {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', property_type: 'apartment', purchase_price: '', current_value: '', monthly_income: '', monthly_expenses: '', currency: 'ILS', address: '', exit_date: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [editRow, setEditRow] = useState(null)
  const tr = useT()

  useEffect(() => { getRealEstate().then(setAssets).finally(() => setLoading(false)) }, [])

  const handleAdd = async () => {
    if (!form.name || !form.purchase_price || !form.current_value) { setError('Name, purchase price and current value required'); return }
    setSaving(true); setError('')
    try {
      const asset = await addRealEstate({ ...form, purchase_price: parseFloat(form.purchase_price), current_value: parseFloat(form.current_value), monthly_income: parseFloat(form.monthly_income || 0), monthly_expenses: parseFloat(form.monthly_expenses || 0), exit_date: form.exit_date || null })
      setAssets(prev => [asset, ...prev])
      setShowForm(false)
      setForm({ name: '', property_type: 'apartment', purchase_price: '', current_value: '', monthly_income: '', monthly_expenses: '', currency: 'ILS', address: '', exit_date: '' })
    } catch (err) { setError(err.response?.data?.error || 'Failed') }
    finally { setSaving(false) }
  }

  const handleEdit = async (data) => {
    const updated = await updateRealEstate(editRow.id, { name: data.name, current_value: parseFloat(data.current_value), monthly_income: parseFloat(data.monthly_income || 0), monthly_expenses: parseFloat(data.monthly_expenses || 0), notes: data.notes, purchase_date: data.purchase_date || null, exit_date: data.exit_date || null })
    setAssets(prev => prev.map(a => a.id === editRow.id ? updated : a))
    setEditRow(null)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete?')) return
    await deleteRealEstate(id)
    setAssets(prev => prev.filter(a => a.id !== id))
  }

  const totalValue  = assets.reduce((s, a) => s + a.current_value, 0)
  const totalCost   = assets.reduce((s, a) => s + a.purchase_price, 0)
  const monthlyNet  = assets.reduce((s, a) => s + a.monthly_income - a.monthly_expenses, 0)

  const columns = [
    { key: 'name', label: tr('name'), render: r => (
      <div>
        <div className="font-semibold text-slate-800">{r.name}</div>
        <div className="text-slate-500 text-xs capitalize">{r.property_type} • {r.currency}</div>
        <div className="text-slate-400 text-xs mt-0.5">{r.purchase_date && <span>Bought {fmtDate(r.purchase_date)} · </span>}Added {fmtDate(r.created_at)}</div>
        {r.exit_date && <div className="mt-0.5"><ExitDateBadge date={r.exit_date} /></div>}
      </div>
    )},
    { key: 'address', label: tr('address'), render: r => r.address || <span className="text-slate-300">—</span> },
    { key: 'purchase_price', label: tr('purchase_price'), align: 'right', render: r => fmt(r.purchase_price) },
    { key: 'current_value',  label: tr('current_value'),  align: 'right', render: r => <span className="font-semibold text-slate-800">{fmt(r.current_value)}</span> },
    { key: 'monthly', label: tr('monthly_net'), align: 'right', render: r => {
      const net = r.monthly_income - r.monthly_expenses
      return <span className={net >= 0 ? 'text-green-600' : 'text-red-600'}>{fmt(net)}</span>
    }},
    { key: 'appreciation', label: tr('appreciation'), align: 'right', render: r => {
      const p = r.current_value - r.purchase_price
      const pct = (p / r.purchase_price) * 100
      return <span className={p >= 0 ? 'text-green-600' : 'text-red-600'}>{fmt(p)}<br/><span className="text-xs">{pct >= 0 ? '+' : ''}{pct.toFixed(1)}%</span></span>
    }}
  ]

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 md:mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">{tr('real_estate')}</h1>
          <p className="text-slate-500 text-sm mt-1">{tr('real_estate_sub')}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-200 transition bg-white border border-slate-200">{tr('import_csv')}</button>
          <button onClick={() => setShowForm(true)} className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition" style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}>{tr('add_property')}</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
        <div className="rounded-2xl p-5 bg-white" style={{ border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
          <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Total Value</p>
          <p className="text-xl font-bold font-num text-slate-800">{fmt(totalValue)}</p>
        </div>
        <div className="rounded-2xl p-5 bg-white" style={{ border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
          <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Total Cost</p>
          <p className="text-xl font-bold font-num text-slate-800">{fmt(totalCost)}</p>
        </div>
        <div className="rounded-2xl p-5 bg-white" style={{ border: `1px solid ${monthlyNet >= 0 ? 'rgba(5,150,105,0.25)' : 'rgba(220,38,38,0.25)'}`, boxShadow: 'var(--card-shadow)' }}>
          <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Monthly Net Income</p>
          <p className={`text-xl font-bold font-num ${monthlyNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(monthlyNet)}/mo</p>
        </div>
      </div>

      {showForm && (
        <div className="rounded-2xl p-5 md:p-6 mb-6 bg-white" style={{ border: '1px solid rgba(59,130,246,0.3)', boxShadow: 'var(--card-shadow)' }}>
          <h2 className="font-semibold mb-4 text-slate-800">{tr('add_property')}</h2>
          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <input placeholder="Property name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={inputCls} style={inputStyle} />
            <select value={form.property_type} onChange={e => setForm(p => ({ ...p, property_type: e.target.value }))} className={inputCls} style={inputStyle}>
              <option value="apartment">Apartment</option><option value="house">House</option><option value="commercial">Commercial</option><option value="land">Land</option>
            </select>
            <select value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))} className={inputCls} style={inputStyle}>
              <option>ILS</option><option>USD</option><option>EUR</option><option>GBP</option>
            </select>
            <input placeholder="Purchase Price" type="number" value={form.purchase_price} onChange={e => setForm(p => ({ ...p, purchase_price: e.target.value }))} className={inputCls} style={inputStyle} />
            <input placeholder="Current Value" type="number" value={form.current_value} onChange={e => setForm(p => ({ ...p, current_value: e.target.value }))} className={inputCls} style={inputStyle} />
            <input placeholder="Address (optional)" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} className={inputCls} style={inputStyle} />
            <input placeholder="Monthly Income" type="number" value={form.monthly_income} onChange={e => setForm(p => ({ ...p, monthly_income: e.target.value }))} className={inputCls} style={inputStyle} />
            <input placeholder="Monthly Expenses" type="number" value={form.monthly_expenses} onChange={e => setForm(p => ({ ...p, monthly_expenses: e.target.value }))} className={inputCls} style={inputStyle} />
            <div>
              <label className="text-xs text-slate-500 block mb-1">Exit Date (optional)</label>
              <input type="date" value={form.exit_date} onChange={e => setForm(p => ({ ...p, exit_date: e.target.value }))} className={inputCls} style={inputStyle} />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleAdd} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}>{saving ? tr('saving') : tr('save')}</button>
            <button onClick={() => { setShowForm(false); setError('') }} className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition border border-slate-200">{tr('cancel')}</button>
          </div>
        </div>
      )}

      {loading ? <div className="text-center text-slate-400 py-16 animate-pulse">Loading...</div>
        : <AssetTable columns={columns} rows={assets} onDelete={handleDelete} onEdit={setEditRow} emptyMessage="No properties yet." />}

      {editRow && <EditModal title={`Edit ${editRow.name}`} fields={EDIT_FIELDS} initialValues={editRow} onSave={handleEdit} onClose={() => setEditRow(null)} />}
      {showImport && <CsvImportModal endpoint="/real-estate/import" columns={CSV_COLUMNS} exampleRow={CSV_EXAMPLE} onClose={() => setShowImport(false)} onImported={(rows) => { setAssets(prev => [...rows, ...prev]); setShowImport(false) }} />}
    </Layout>
  )
}
