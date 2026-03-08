import { useState, useEffect } from 'react'
import Layout from '../components/layout/Layout'
import AssetTable from '../components/ui/AssetTable'
import CsvImportModal from '../components/ui/CsvImportModal'
import EditModal from '../components/ui/EditModal'
import { getPension, addPension, updatePension, deletePension } from '../api/assets'
import useT from '../i18n/useT'

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null

const EDIT_FIELDS = [
  { key: 'name',              label: 'Fund Name',             fullWidth: true },
  { key: 'created_at',        label: 'Added On',              readOnly: true, type: 'date' },
  { key: 'pension_type',      label: 'Type', options: [
    { value: 'keren_pensia',      label: 'Keren Pensia' },
    { value: 'keren_hishtalmut',  label: 'Keren Hishtalmut' },
    { value: 'bituach_menahalim', label: 'Bituach Menahalim' },
    { value: 'kupat_gemel',       label: 'Kupat Gemel' },
  ]},
  { key: 'managing_company',  label: 'Managing Company' },
  { key: 'current_value',     label: 'Current Value (ILS)',   type: 'number' },
  { key: 'employee_monthly',  label: 'Employee Monthly (ILS)', type: 'number' },
  { key: 'employer_monthly',  label: 'Employer Monthly (ILS)', type: 'number' },
  { key: 'track',             label: 'Investment Track',      fullWidth: true },
]

const CSV_COLUMNS = [
  { key: 'name', label: 'Name', required: true },
  { key: 'pension_type', label: 'Pension Type', required: true },
  { key: 'current_value', label: 'Current Value (ILS)', type: 'number', default: 0 },
  { key: 'employee_monthly', label: 'Employee Monthly', type: 'number', default: 0 },
  { key: 'employer_monthly', label: 'Employer Monthly', type: 'number', default: 0 },
  { key: 'track', label: 'Track' },
  { key: 'managing_company', label: 'Managing Company' },
]
const CSV_EXAMPLE = { name: 'My Pensia', pension_type: 'keren_pensia', current_value: 150000, employee_monthly: 1200, employer_monthly: 1800, track: 'General', managing_company: 'Harel' }

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0)
const fmtILS = (n) => new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n || 0)

const PENSION_TYPES = {
  keren_hishtalmut: 'Keren Hishtalmut',
  keren_pensia: 'Keren Pensia',
  bituach_menahalim: "Bituach Menahalim",
  kupat_gemel: 'Kupat Gemel'
}

export default function Pension() {
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', pension_type: 'keren_pensia', current_value: '', employee_monthly: '', employer_monthly: '', track: '', managing_company: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [editRow, setEditRow] = useState(null)
  const tr = useT()

  useEffect(() => { getPension().then(setAssets).finally(() => setLoading(false)) }, [])

  const handleAdd = async () => {
    if (!form.name || !form.pension_type) { setError('Name and type required'); return }
    setSaving(true); setError('')
    try {
      const asset = await addPension({ ...form, current_value: parseFloat(form.current_value || 0), employee_monthly: parseFloat(form.employee_monthly || 0), employer_monthly: parseFloat(form.employer_monthly || 0) })
      setAssets(prev => [asset, ...prev])
      setShowForm(false)
      setForm({ name: '', pension_type: 'keren_pensia', current_value: '', employee_monthly: '', employer_monthly: '', track: '', managing_company: '' })
    } catch (err) { setError(err.response?.data?.error || 'Failed') }
    finally { setSaving(false) }
  }

  const handleEdit = async (data) => {
    const updated = await updatePension(editRow.id, {
      current_value: parseFloat(data.current_value || 0),
      employee_monthly: parseFloat(data.employee_monthly || 0),
      employer_monthly: parseFloat(data.employer_monthly || 0),
      track: data.track,
      notes: data.notes,
    })
    setAssets(prev => prev.map(a => a.id === editRow.id ? updated : a))
    setEditRow(null)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete?')) return
    await deletePension(id)
    setAssets(prev => prev.filter(a => a.id !== id))
  }

  const totalValue = assets.reduce((s, a) => s + a.current_value, 0)
  const totalMonthly = assets.reduce((s, a) => s + a.employee_monthly + a.employer_monthly, 0)

  const columns = [
    { key: 'name', label: tr('name'), render: r => (
      <div>
        <div className="font-semibold">{r.name}</div>
        <div className="text-slate-500 text-xs">{PENSION_TYPES[r.pension_type]}</div>
        <div className="text-slate-600 text-xs mt-0.5">Added {fmtDate(r.created_at)}</div>
      </div>
    )},
    { key: 'managing_company', label: tr('company'), render: r => r.managing_company || <span className="text-slate-600">—</span> },
    { key: 'track', label: tr('track'), render: r => r.track || <span className="text-slate-600">—</span> },
    { key: 'monthly', label: tr('monthly_total'), align: 'right', render: r => <span className="text-green-400">{fmtILS(r.employee_monthly + r.employer_monthly)}</span> },
    { key: 'current_value', label: tr('current_value'), align: 'right', render: r => <span className="font-semibold">{fmtILS(r.current_value)}</span> },
  ]

  return (
    <Layout>
      <div className="flex items-center justify-between mb-8">
        <div><h1 className="text-2xl font-bold">{tr('pension')}</h1><p className="text-slate-500 text-sm mt-1">{tr('pension_sub')}</p></div>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition">{tr('import_csv')}</button>
          <button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-semibold transition">{tr('add_fund')}</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5"><p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Total Value (ILS)</p><p className="text-xl font-bold">{fmtILS(totalValue)}</p></div>
        <div className="bg-slate-900 border border-green-500/30 rounded-2xl p-5"><p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Total Monthly Contributions</p><p className="text-xl font-bold text-green-400">{fmtILS(totalMonthly)}/mo</p></div>
      </div>

      {showForm && (
        <div className="bg-slate-900 border border-blue-500/30 rounded-2xl p-6 mb-6">
          <h2 className="font-semibold mb-4">{tr('add_fund')}</h2>
          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
          <div className="grid grid-cols-3 gap-4">
            <input placeholder="Fund name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            <select value={form.pension_type} onChange={e => setForm(p => ({ ...p, pension_type: e.target.value }))} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
              {Object.entries(PENSION_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input placeholder="Managing Company" value={form.managing_company} onChange={e => setForm(p => ({ ...p, managing_company: e.target.value }))} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            <input placeholder="Current Value (ILS)" type="number" value={form.current_value} onChange={e => setForm(p => ({ ...p, current_value: e.target.value }))} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            <input placeholder="Employee Monthly (ILS)" type="number" value={form.employee_monthly} onChange={e => setForm(p => ({ ...p, employee_monthly: e.target.value }))} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            <input placeholder="Employer Monthly (ILS)" type="number" value={form.employer_monthly} onChange={e => setForm(p => ({ ...p, employer_monthly: e.target.value }))} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            <input placeholder="Investment Track" value={form.track} onChange={e => setForm(p => ({ ...p, track: e.target.value }))} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 col-span-2" />
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleAdd} disabled={saving} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50">{saving ? tr('saving') : tr('save')}</button>
            <button onClick={() => { setShowForm(false); setError('') }} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-sm transition">{tr('cancel')}</button>
          </div>
        </div>
      )}

      {loading ? <div className="text-center text-slate-500 py-16 animate-pulse">Loading...</div>
        : <AssetTable columns={columns} rows={assets} onDelete={handleDelete} onEdit={setEditRow} emptyMessage="No pension funds yet." />}

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
          endpoint="/pension/import"
          columns={CSV_COLUMNS}
          exampleRow={CSV_EXAMPLE}
          onClose={() => setShowImport(false)}
          onImported={(rows) => { setAssets(prev => [...rows, ...prev]); setShowImport(false) }}
        />
      )}
    </Layout>
  )
}
