import { useState, useEffect } from 'react'
import Layout from '../components/layout/Layout'
import AssetTable from '../components/ui/AssetTable'
import CsvImportModal from '../components/ui/CsvImportModal'
import EditModal from '../components/ui/EditModal'
import { getAlternative, addAlternative, updateAlternative, deleteAlternative } from '../api/assets'
import useT from '../i18n/useT'

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null

function ExitDateBadge({ date }) {
  if (!date) return <span className="text-slate-600">—</span>
  const d = new Date(date)
  const now = new Date()
  const threeMonths = new Date(); threeMonths.setMonth(threeMonths.getMonth() + 3)
  if (d < now) return <span className="text-slate-400 text-xs">⚪ Exited · {d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
  if (d <= threeMonths) return <span className="text-orange-400 text-xs">🟠 {d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} · Soon</span>
  return <span className="text-green-400 text-xs">🟢 {d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
}

const TYPE_LABELS = {
  private_equity: 'Private Equity',
  real_estate_fund: 'Real Estate Fund',
  p2p_lending: 'P2P Lending',
  hedge_fund: 'Hedge Fund',
  other: 'Other',
}

const EDIT_FIELDS = [
  { key: 'name',              label: 'Name',              fullWidth: true },
  { key: 'created_at',        label: 'Added On',          readOnly: true, type: 'date' },
  { key: 'purchase_date',     label: 'Purchase Date',     type: 'date' },
  { key: 'investment_type',   label: 'Investment Type', options: [
    { value: 'private_equity',    label: 'Private Equity' },
    { value: 'real_estate_fund',  label: 'Real Estate Fund' },
    { value: 'p2p_lending',       label: 'P2P Lending' },
    { value: 'hedge_fund',        label: 'Hedge Fund' },
    { value: 'other',             label: 'Other' },
  ]},
  { key: 'currency', label: 'Currency', options: [
    { value: 'ILS', label: 'ILS' }, { value: 'USD', label: 'USD' },
    { value: 'EUR', label: 'EUR' }, { value: 'GBP', label: 'GBP' },
  ]},
  { key: 'amount_invested',   label: 'Amount Invested',   type: 'number' },
  { key: 'current_value',     label: 'Current Value',     type: 'number' },
  { key: 'monthly_income',    label: 'Monthly Income',    type: 'number' },
  { key: 'monthly_expenses',  label: 'Monthly Expenses',  type: 'number' },
  { key: 'exit_date',         label: 'Exit Date',         type: 'date' },
]

const CSV_COLUMNS = [
  { key: 'name',              label: 'Name',              required: true },
  { key: 'investment_type',   label: 'Investment Type',   default: 'private_equity' },
  { key: 'amount_invested',   label: 'Amount Invested',   required: true, type: 'number' },
  { key: 'current_value',     label: 'Current Value',     required: true, type: 'number' },
  { key: 'currency',          label: 'Currency',          default: 'ILS' },
  { key: 'monthly_income',    label: 'Monthly Income',    type: 'number', default: 0 },
  { key: 'monthly_expenses',  label: 'Monthly Expenses',  type: 'number', default: 0 },
  { key: 'purchase_date',     label: 'Purchase Date' },
  { key: 'exit_date',         label: 'Exit Date' },
]
const CSV_EXAMPLE = { name: 'Growth Fund I', investment_type: 'private_equity', amount_invested: 100000, current_value: 120000, currency: 'ILS', monthly_income: 500, monthly_expenses: 50, purchase_date: '2023-01-01', exit_date: '2028-01-01' }

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0)

export default function AlternativeInvestments() {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', investment_type: 'private_equity', amount_invested: '', current_value: '', monthly_income: '', monthly_expenses: '', currency: 'ILS', purchase_date: '', exit_date: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [editRow, setEditRow] = useState(null)
  const tr = useT()

  useEffect(() => { getAlternative().then(setAssets).finally(() => setLoading(false)) }, [])

  const handleAdd = async () => {
    if (!form.name || !form.amount_invested || !form.current_value) { setError('Name, amount invested and current value required'); return }
    setSaving(true); setError('')
    try {
      const asset = await addAlternative({
        ...form,
        amount_invested: parseFloat(form.amount_invested),
        current_value: parseFloat(form.current_value),
        monthly_income: parseFloat(form.monthly_income || 0),
        monthly_expenses: parseFloat(form.monthly_expenses || 0),
        purchase_date: form.purchase_date || null,
        exit_date: form.exit_date || null,
      })
      setAssets(prev => [asset, ...prev])
      setShowForm(false)
      setForm({ name: '', investment_type: 'private_equity', amount_invested: '', current_value: '', monthly_income: '', monthly_expenses: '', currency: 'ILS', purchase_date: '', exit_date: '' })
    } catch (err) { setError(err.response?.data?.error || 'Failed') }
    finally { setSaving(false) }
  }

  const handleEdit = async (data) => {
    const updated = await updateAlternative(editRow.id, {
      name: data.name,
      investment_type: data.investment_type,
      currency: data.currency,
      amount_invested: parseFloat(data.amount_invested),
      current_value: parseFloat(data.current_value),
      monthly_income: parseFloat(data.monthly_income || 0),
      monthly_expenses: parseFloat(data.monthly_expenses || 0),
      purchase_date: data.purchase_date || null,
      exit_date: data.exit_date || null,
    })
    setAssets(prev => prev.map(a => a.id === editRow.id ? updated : a))
    setEditRow(null)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete?')) return
    await deleteAlternative(id)
    setAssets(prev => prev.filter(a => a.id !== id))
  }

  const totalInvested = assets.reduce((s, a) => s + (a.amount_invested || 0), 0)
  const totalValue = assets.reduce((s, a) => s + (a.current_value || 0), 0)
  const monthlyNet = assets.reduce((s, a) => s + (a.monthly_income || 0) - (a.monthly_expenses || 0), 0)

  const inputCls = 'bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500'

  const columns = [
    { key: 'name', label: tr('name'), render: r => (
      <div>
        <div className="font-semibold">{r.name}</div>
        <div className="text-slate-500 text-xs">{TYPE_LABELS[r.investment_type] || r.investment_type} • {r.currency}</div>
        <div className="text-slate-600 text-xs mt-0.5">
          {r.purchase_date && <span>Bought {fmtDate(r.purchase_date)} · </span>}
          Added {fmtDate(r.created_at)}
        </div>
      </div>
    )},
    { key: 'exit_date', label: 'Exit Date', render: r => <ExitDateBadge date={r.exit_date} /> },
    { key: 'amount_invested', label: 'Invested', align: 'right', render: r => fmt(r.amount_invested) },
    { key: 'current_value', label: tr('current_value'), align: 'right', render: r => <span className="font-semibold">{fmt(r.current_value)}</span> },
    { key: 'monthly', label: tr('monthly_net'), align: 'right', render: r => {
      const net = (r.monthly_income || 0) - (r.monthly_expenses || 0)
      return <span className={net >= 0 ? 'text-green-400' : 'text-red-400'}>{fmt(net)}/mo</span>
    }},
    { key: 'gain', label: 'Gain/Loss', align: 'right', render: r => {
      const gain = (r.current_value || 0) - (r.amount_invested || 0)
      const pct = r.amount_invested ? (gain / r.amount_invested) * 100 : 0
      return <span className={gain >= 0 ? 'text-green-400' : 'text-red-400'}>{fmt(gain)}<br/><span className="text-xs">{pct >= 0 ? '+' : ''}{pct.toFixed(1)}%</span></span>
    }},
  ]

  return (
    <Layout>
      <div className="flex items-center justify-between mb-8">
        <div><h1 className="text-2xl font-bold">{tr('alternative')}</h1><p className="text-slate-500 text-sm mt-1">{tr('alternative_sub')}</p></div>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition">{tr('import_csv')}</button>
          <button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-semibold transition">{tr('add_alternative')}</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5"><p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Total Invested</p><p className="text-xl font-bold">{fmt(totalInvested)}</p></div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5"><p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Current Value</p><p className="text-xl font-bold">{fmt(totalValue)}</p></div>
        <div className={`bg-slate-900 border rounded-2xl p-5 ${monthlyNet >= 0 ? 'border-green-500/30' : 'border-red-500/30'}`}>
          <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Monthly Net Income</p>
          <p className={`text-xl font-bold ${monthlyNet >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(monthlyNet)}/mo</p>
        </div>
      </div>

      {showForm && (
        <div className="bg-slate-900 border border-blue-500/30 rounded-2xl p-6 mb-6">
          <h2 className="font-semibold mb-4">{tr('add_alternative')}</h2>
          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
          <div className="grid grid-cols-3 gap-4">
            <input placeholder="Investment name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={inputCls} />
            <select value={form.investment_type} onChange={e => setForm(p => ({ ...p, investment_type: e.target.value }))} className={inputCls}>
              <option value="private_equity">Private Equity</option>
              <option value="real_estate_fund">Real Estate Fund</option>
              <option value="p2p_lending">P2P Lending</option>
              <option value="hedge_fund">Hedge Fund</option>
              <option value="other">Other</option>
            </select>
            <select value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))} className={inputCls}>
              <option>ILS</option><option>USD</option><option>EUR</option><option>GBP</option>
            </select>
            <input placeholder="Amount Invested" type="number" value={form.amount_invested} onChange={e => setForm(p => ({ ...p, amount_invested: e.target.value }))} className={inputCls} />
            <input placeholder="Current Value" type="number" value={form.current_value} onChange={e => setForm(p => ({ ...p, current_value: e.target.value }))} className={inputCls} />
            <input placeholder="Monthly Income" type="number" value={form.monthly_income} onChange={e => setForm(p => ({ ...p, monthly_income: e.target.value }))} className={inputCls} />
            <input placeholder="Monthly Expenses" type="number" value={form.monthly_expenses} onChange={e => setForm(p => ({ ...p, monthly_expenses: e.target.value }))} className={inputCls} />
            <div><label className="text-xs text-slate-500 block mb-1">Purchase Date (optional)</label><input type="date" value={form.purchase_date} onChange={e => setForm(p => ({ ...p, purchase_date: e.target.value }))} className={`${inputCls} w-full`} /></div>
            <div><label className="text-xs text-slate-500 block mb-1">Exit Date (optional)</label><input type="date" value={form.exit_date} onChange={e => setForm(p => ({ ...p, exit_date: e.target.value }))} className={`${inputCls} w-full`} /></div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleAdd} disabled={saving} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50">{saving ? tr('saving') : tr('save')}</button>
            <button onClick={() => { setShowForm(false); setError('') }} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-sm transition">{tr('cancel')}</button>
          </div>
        </div>
      )}

      {loading ? <div className="text-center text-slate-500 py-16 animate-pulse">Loading...</div>
        : <AssetTable columns={columns} rows={assets} onDelete={handleDelete} onEdit={setEditRow} emptyMessage="No alternative investments yet." />}

      {editRow && (
        <EditModal
          title={`Edit ${editRow.name}`}
          fields={EDIT_FIELDS}
          initialValues={editRow}
          onSave={handleEdit}
          onClose={() => setEditRow(null)}
        />
      )}

      {showImport && (
        <CsvImportModal
          endpoint="/alternative-investments/import"
          columns={CSV_COLUMNS}
          exampleRow={CSV_EXAMPLE}
          onClose={() => setShowImport(false)}
          onImported={(rows) => { setAssets(prev => [...rows, ...prev]); setShowImport(false) }}
        />
      )}
    </Layout>
  )
}
