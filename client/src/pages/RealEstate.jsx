import { useState, useEffect } from 'react'
import Layout from '../components/layout/Layout'
import AssetTable from '../components/ui/AssetTable'
import { getRealEstate, addRealEstate, deleteRealEstate } from '../api/assets'

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0)

export default function RealEstate() {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', property_type: 'apartment', purchase_price: '', current_value: '', monthly_income: '', monthly_expenses: '', currency: 'ILS', address: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { getRealEstate().then(setAssets).finally(() => setLoading(false)) }, [])

  const handleAdd = async () => {
    if (!form.name || !form.purchase_price || !form.current_value) { setError('Name, purchase price and current value required'); return }
    setSaving(true); setError('')
    try {
      const asset = await addRealEstate({ ...form, purchase_price: parseFloat(form.purchase_price), current_value: parseFloat(form.current_value), monthly_income: parseFloat(form.monthly_income || 0), monthly_expenses: parseFloat(form.monthly_expenses || 0) })
      setAssets(prev => [asset, ...prev])
      setShowForm(false)
      setForm({ name: '', property_type: 'apartment', purchase_price: '', current_value: '', monthly_income: '', monthly_expenses: '', currency: 'ILS', address: '' })
    } catch (err) { setError(err.response?.data?.error || 'Failed') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete?')) return
    await deleteRealEstate(id)
    setAssets(prev => prev.filter(a => a.id !== id))
  }

  const totalValue = assets.reduce((s, a) => s + a.current_value, 0)
  const totalCost = assets.reduce((s, a) => s + a.purchase_price, 0)
  const monthlyNet = assets.reduce((s, a) => s + a.monthly_income - a.monthly_expenses, 0)

  const columns = [
    { key: 'name', label: 'Property', render: r => <><div className="font-semibold">{r.name}</div><div className="text-slate-500 text-xs capitalize">{r.property_type} • {r.currency}</div></> },
    { key: 'address', label: 'Address', render: r => r.address || <span className="text-slate-600">—</span> },
    { key: 'purchase_price', label: 'Purchase Price', align: 'right', render: r => fmt(r.purchase_price) },
    { key: 'current_value', label: 'Current Value', align: 'right', render: r => <span className="font-semibold">{fmt(r.current_value)}</span> },
    { key: 'monthly', label: 'Monthly Net', align: 'right', render: r => {
      const net = r.monthly_income - r.monthly_expenses
      return <span className={net >= 0 ? 'text-green-400' : 'text-red-400'}>{fmt(net)}</span>
    }},
    { key: 'appreciation', label: 'Appreciation', align: 'right', render: r => {
      const p = r.current_value - r.purchase_price
      const pct = (p / r.purchase_price) * 100
      return <span className={p >= 0 ? 'text-green-400' : 'text-red-400'}>{fmt(p)}<br/><span className="text-xs">{pct >= 0 ? '+' : ''}{pct.toFixed(1)}%</span></span>
    }}
  ]

  return (
    <Layout>
      <div className="flex items-center justify-between mb-8">
        <div><h1 className="text-2xl font-bold">Real Estate</h1><p className="text-slate-500 text-sm mt-1">Properties portfolio</p></div>
        <button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-semibold transition">+ Add Property</button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5"><p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Total Value</p><p className="text-xl font-bold">{fmt(totalValue)}</p></div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5"><p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Total Cost</p><p className="text-xl font-bold">{fmt(totalCost)}</p></div>
        <div className={`bg-slate-900 border rounded-2xl p-5 ${monthlyNet >= 0 ? 'border-green-500/30' : 'border-red-500/30'}`}>
          <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Monthly Net Income</p>
          <p className={`text-xl font-bold ${monthlyNet >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(monthlyNet)}/mo</p>
        </div>
      </div>

      {showForm && (
        <div className="bg-slate-900 border border-blue-500/30 rounded-2xl p-6 mb-6">
          <h2 className="font-semibold mb-4">Add Property</h2>
          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
          <div className="grid grid-cols-3 gap-4">
            <input placeholder="Property name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            <select value={form.property_type} onChange={e => setForm(p => ({ ...p, property_type: e.target.value }))} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
              <option value="apartment">Apartment</option>
              <option value="house">House</option>
              <option value="commercial">Commercial</option>
              <option value="land">Land</option>
            </select>
            <select value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
              <option>ILS</option><option>USD</option><option>EUR</option><option>GBP</option>
            </select>
            <input placeholder="Purchase Price" type="number" value={form.purchase_price} onChange={e => setForm(p => ({ ...p, purchase_price: e.target.value }))} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            <input placeholder="Current Value" type="number" value={form.current_value} onChange={e => setForm(p => ({ ...p, current_value: e.target.value }))} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            <input placeholder="Address (optional)" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            <input placeholder="Monthly Income" type="number" value={form.monthly_income} onChange={e => setForm(p => ({ ...p, monthly_income: e.target.value }))} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            <input placeholder="Monthly Expenses" type="number" value={form.monthly_expenses} onChange={e => setForm(p => ({ ...p, monthly_expenses: e.target.value }))} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleAdd} disabled={saving} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
            <button onClick={() => { setShowForm(false); setError('') }} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-sm transition">Cancel</button>
          </div>
        </div>
      )}

      {loading ? <div className="text-center text-slate-500 py-16 animate-pulse">Loading...</div>
        : <AssetTable columns={columns} rows={assets} onDelete={handleDelete} emptyMessage="No properties yet." />}
    </Layout>
  )
}
