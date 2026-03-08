import { useState, useEffect } from 'react'
import Layout from '../components/layout/Layout'
import AssetTable from '../components/ui/AssetTable'
import CsvImportModal from '../components/ui/CsvImportModal'
import EditModal from '../components/ui/EditModal'
import { getCash, addCash, updateCash, deleteCash } from '../api/assets'

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null

const EDIT_FIELDS = [
  { key: 'name',          label: 'Account Name',   fullWidth: true },
  { key: 'holding_type',  label: 'Type', options: [
    { value: 'savings', label: 'Savings' }, { value: 'checking', label: 'Checking' },
    { value: 'deposit', label: 'Deposit' }, { value: 'loan', label: 'Loan' },
    { value: 'mortgage', label: 'Mortgage' }, { value: 'credit_card', label: 'Credit Card' },
  ]},
  { key: 'currency',      label: 'Currency', options: [
    { value: 'ILS', label: 'ILS' }, { value: 'USD', label: 'USD' },
    { value: 'EUR', label: 'EUR' }, { value: 'GBP', label: 'GBP' },
  ]},
  { key: 'balance',       label: 'Balance',        type: 'number' },
  { key: 'institution',   label: 'Institution' },
  { key: 'interest_rate', label: 'Interest Rate (e.g. 0.05)', type: 'number' },
]

const CSV_COLUMNS = [
  { key: 'name', label: 'Name', required: true },
  { key: 'holding_type', label: 'Holding Type', default: 'savings' },
  { key: 'balance', label: 'Balance', required: true, type: 'number' },
  { key: 'currency', label: 'Currency', default: 'ILS' },
  { key: 'institution', label: 'Institution' },
  { key: 'interest_rate', label: 'Interest Rate', type: 'number' },
]
const CSV_EXAMPLE = { name: 'Bank Hapoalim', holding_type: 'savings', balance: 50000, currency: 'ILS', institution: 'Hapoalim', interest_rate: 0.03 }

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0)

export default function Cash() {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', holding_type: 'savings', balance: '', currency: 'ILS', institution: '', interest_rate: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [editRow, setEditRow] = useState(null)

  useEffect(() => { getCash().then(setAssets).finally(() => setLoading(false)) }, [])

  const handleAdd = async () => {
    if (!form.name || !form.balance) { setError('Name and balance required'); return }
    setSaving(true); setError('')
    try {
      const asset = await addCash({ ...form, balance: parseFloat(form.balance), interest_rate: form.interest_rate ? parseFloat(form.interest_rate) : null })
      setAssets(prev => [asset, ...prev])
      setShowForm(false)
      setForm({ name: '', holding_type: 'savings', balance: '', currency: 'ILS', institution: '', interest_rate: '' })
    } catch (err) { setError(err.response?.data?.error || 'Failed') }
    finally { setSaving(false) }
  }

  const handleEdit = async (data) => {
    const updated = await updateCash(editRow.id, {
      name: data.name, balance: parseFloat(data.balance),
      interest_rate: data.interest_rate !== '' && data.interest_rate != null ? parseFloat(data.interest_rate) : null,
      notes: data.notes,
    })
    setAssets(prev => prev.map(a => a.id === editRow.id ? updated : a))
    setEditRow(null)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete?')) return
    await deleteCash(id)
    setAssets(prev => prev.filter(a => a.id !== id))
  }

  const totalAssets = assets.filter(a => a.balance > 0).reduce((s, a) => s + a.balance, 0)
  const totalDebt = assets.filter(a => a.balance < 0).reduce((s, a) => s + Math.abs(a.balance), 0)
  const netLiquid = totalAssets - totalDebt

  const columns = [
    { key: 'name', label: 'Account', render: r => (
      <div>
        <div className="font-semibold">{r.name}</div>
        <div className="text-slate-500 text-xs capitalize">{r.holding_type} • {r.currency}</div>
        <div className="text-slate-600 text-xs mt-0.5">Added {fmtDate(r.created_at)}</div>
      </div>
    )},
    { key: 'institution', label: 'Institution', render: r => r.institution || <span className="text-slate-600">—</span> },
    { key: 'interest_rate', label: 'Rate', align: 'right', render: r => r.interest_rate ? `${(r.interest_rate * 100).toFixed(2)}%` : <span className="text-slate-600">—</span> },
    { key: 'balance', label: 'Balance', align: 'right', render: r => <span className={`font-semibold ${r.balance >= 0 ? 'text-white' : 'text-red-400'}`}>{fmt(r.balance)}</span> },
  ]

  return (
    <Layout>
      <div className="flex items-center justify-between mb-8">
        <div><h1 className="text-2xl font-bold">Cash & Debt</h1><p className="text-slate-500 text-sm mt-1">Savings, accounts, loans, mortgages</p></div>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition">Import CSV</button>
          <button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-semibold transition">+ Add Account</button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-900 border border-green-500/30 rounded-2xl p-5"><p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Total Liquid Assets</p><p className="text-xl font-bold text-green-400">{fmt(totalAssets)}</p></div>
        <div className="bg-slate-900 border border-red-500/30 rounded-2xl p-5"><p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Total Debt</p><p className="text-xl font-bold text-red-400">{fmt(totalDebt)}</p></div>
        <div className={`bg-slate-900 border rounded-2xl p-5 ${netLiquid >= 0 ? 'border-blue-500/30' : 'border-red-500/30'}`}>
          <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Net Liquid</p>
          <p className={`text-xl font-bold ${netLiquid >= 0 ? 'text-blue-400' : 'text-red-400'}`}>{fmt(netLiquid)}</p>
        </div>
      </div>

      {showForm && (
        <div className="bg-slate-900 border border-blue-500/30 rounded-2xl p-6 mb-6">
          <h2 className="font-semibold mb-4">Add Account</h2>
          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
          <div className="grid grid-cols-3 gap-4">
            <input placeholder="Account name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            <select value={form.holding_type} onChange={e => setForm(p => ({ ...p, holding_type: e.target.value }))} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
              <option value="savings">Savings</option>
              <option value="checking">Checking</option>
              <option value="deposit">Deposit</option>
              <option value="loan">Loan</option>
              <option value="mortgage">Mortgage</option>
              <option value="credit_card">Credit Card</option>
            </select>
            <select value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
              <option>ILS</option><option>USD</option><option>EUR</option><option>GBP</option>
            </select>
            <input placeholder="Balance (negative for debt)" type="number" value={form.balance} onChange={e => setForm(p => ({ ...p, balance: e.target.value }))} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            <input placeholder="Institution (optional)" value={form.institution} onChange={e => setForm(p => ({ ...p, institution: e.target.value }))} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            <input placeholder="Interest Rate (e.g. 0.05 = 5%)" type="number" value={form.interest_rate} onChange={e => setForm(p => ({ ...p, interest_rate: e.target.value }))} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleAdd} disabled={saving} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
            <button onClick={() => { setShowForm(false); setError('') }} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-sm transition">Cancel</button>
          </div>
        </div>
      )}

      {loading ? <div className="text-center text-slate-500 py-16 animate-pulse">Loading...</div>
        : <AssetTable columns={columns} rows={assets} onDelete={handleDelete} onEdit={setEditRow} emptyMessage="No accounts yet." />}

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
          endpoint="/cash/import"
          columns={CSV_COLUMNS}
          exampleRow={CSV_EXAMPLE}
          onClose={() => setShowImport(false)}
          onImported={(rows) => { setAssets(prev => [...rows, ...prev]); setShowImport(false) }}
        />
      )}
    </Layout>
  )
}
