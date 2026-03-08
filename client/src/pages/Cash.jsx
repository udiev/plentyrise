import { useState, useEffect } from 'react'
import Layout from '../components/layout/Layout'
import AssetTable from '../components/ui/AssetTable'
import { getCash, addCash, deleteCash } from '../api/assets'

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0)

export default function Cash() {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', holding_type: 'savings', balance: '', currency: 'ILS', institution: '', interest_rate: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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

  const handleDelete = async (id) => {
    if (!confirm('Delete?')) return
    await deleteCash(id)
    setAssets(prev => prev.filter(a => a.id !== id))
  }

  const totalAssets = assets.filter(a => a.balance > 0).reduce((s, a) => s + a.balance, 0)
  const totalDebt = assets.filter(a => a.balance < 0).reduce((s, a) => s + Math.abs(a.balance), 0)
  const netLiquid = totalAssets - totalDebt

  const columns = [
    { key: 'name', label: 'Account', render: r => <><div className="font-semibold">{r.name}</div><div className="text-slate-500 text-xs capitalize">{r.holding_type} • {r.currency}</div></> },
    { key: 'institution', label: 'Institution', render: r => r.institution || <span className="text-slate-600">—</span> },
    { key: 'interest_rate', label: 'Rate', align: 'right', render: r => r.interest_rate ? `${(r.interest_rate * 100).toFixed(2)}%` : <span className="text-slate-600">—</span> },
    { key: 'balance', label: 'Balance', align: 'right', render: r => <span className={`font-semibold ${r.balance >= 0 ? 'text-white' : 'text-red-400'}`}>{fmt(r.balance)}</span> },
  ]

  return (
    <Layout>
      <div className="flex items-center justify-between mb-8">
        <div><h1 className="text-2xl font-bold">Cash & Debt</h1><p className="text-slate-500 text-sm mt-1">Savings, accounts, loans, mortgages</p></div>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-semibold transition">+ Add Account</button>
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
        : <AssetTable columns={columns} rows={assets} onDelete={handleDelete} emptyMessage="No accounts yet." />}
    </Layout>
  )
}
