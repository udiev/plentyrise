import { useState, useEffect, useCallback } from 'react'
import Layout from '../components/layout/Layout'
import useT from '../i18n/useT'
import {
  getIncome, addIncome, updateIncome, deleteIncome,
  getExpenses, addExpense, updateExpense, deleteExpense,
  getAssumptions, updateAssumptions,
  getForecast,
} from '../api/cashflow'
import { getRealEstate, getInvestments, getPension, getAlternative } from '../api/assets'

const fmtILS = (n) =>
  new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(n || 0)

const fmtPct = (v) => `${(parseFloat(v) * 100).toFixed(1)}%`

const inputCls = 'w-full rounded-lg px-3 py-2 text-sm focus:outline-none transition text-slate-800 placeholder-slate-400'
const inputStyle = { background: 'var(--surface2)', border: '1px solid rgba(0,0,0,0.1)' }

const INCOME_BLANK = { name: '', amount: '', currency: 'ILS', frequency: 'monthly', start_date: '', end_date: '' }
const EXPENSE_BLANK = { name: '', amount: '', currency: 'ILS', frequency: 'monthly', target_date: '' }

// ── Small reusable inline form ────────────────────────────────────────────
function InlineForm({ fields, values, onChange, onSave, onCancel, saving, error }) {
  return (
    <div className="rounded-xl p-4 mb-4 bg-white" style={{ border: '1px solid rgba(59,130,246,0.3)', boxShadow: 'var(--card-shadow)' }}>
      {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {fields.map(f => (
          f.options
            ? <select key={f.key} value={values[f.key]} onChange={e => onChange(f.key, e.target.value)} className={inputCls} style={inputStyle}>
                {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            : <input
                key={f.key}
                type={f.type || 'text'}
                placeholder={f.label}
                value={values[f.key] ?? ''}
                onChange={e => onChange(f.key, e.target.value)}
                className={inputCls}
                style={inputStyle}
              />
        ))}
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={onSave} disabled={saving} className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition" style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button onClick={onCancel} className="px-4 py-1.5 rounded-lg text-sm text-slate-600 border border-slate-200 hover:bg-slate-50 transition">Cancel</button>
      </div>
    </div>
  )
}

// ── Editable row ──────────────────────────────────────────────────────────
function EditableRow({ row, fields, onSave, onCancel }) {
  const [values, setValues] = useState({ ...row })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setValues(p => ({ ...p, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    await onSave(values)
    setSaving(false)
  }

  return (
    <tr className="bg-blue-50">
      {fields.map(f => (
        <td key={f.key} className="px-4 py-2">
          {f.readOnly
            ? <span className="text-sm text-slate-500">{row[f.key]}</span>
            : f.options
              ? <select value={values[f.key]} onChange={e => set(f.key, e.target.value)} className="rounded px-2 py-1 text-sm border border-slate-200 bg-white">
                  {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              : <input type={f.type || 'text'} value={values[f.key] ?? ''} onChange={e => set(f.key, e.target.value)} className="rounded px-2 py-1 text-sm border border-slate-200 bg-white w-full" />
          }
        </td>
      ))}
      <td className="px-4 py-2 text-right whitespace-nowrap">
        <button onClick={handleSave} disabled={saving} className="text-xs text-blue-600 hover:underline mr-3 disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
        <button onClick={onCancel} className="text-xs text-slate-400 hover:underline">Cancel</button>
      </td>
    </tr>
  )
}

// ── Generic CRUD table ────────────────────────────────────────────────────
function CrudTable({ rows, fields, onEdit, onDelete, editId, editValues, onEditChange, onEditSave, onEditCancel, autoRows = [] }) {
  return (
    <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--border)' }}>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-100">
            {fields.map(f => <th key={f.key} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">{f.label}</th>)}
            <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && autoRows.length === 0 && (
            <tr><td colSpan={fields.length + 1} className="px-4 py-8 text-center text-slate-400 text-sm">No entries yet</td></tr>
          )}
          {rows.map(row =>
            editId === row.id
              ? <EditableRow key={row.id} row={row} fields={fields.filter(f => !f.readOnly)} onSave={onEditSave} onCancel={onEditCancel} />
              : (
                <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50 transition">
                  {fields.map(f => (
                    <td key={f.key} className="px-4 py-3 text-slate-700">
                      {f.render ? f.render(row) : (row[f.key] ?? <span className="text-slate-300">—</span>)}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => onEdit(row)} className="text-xs text-blue-500 hover:underline mr-3">Edit</button>
                    <button onClick={() => onDelete(row.id)} className="text-xs text-red-400 hover:underline">Delete</button>
                  </td>
                </tr>
              )
          )}
          {autoRows.map((row, i) => (
            <tr key={`auto-${i}`} className="border-b border-slate-50 bg-slate-50/50">
              {fields.map(f => (
                <td key={f.key} className="px-4 py-3 text-slate-500 italic">
                  {f.render ? f.render(row) : (row[f.key] ?? <span className="text-slate-300">—</span>)}
                </td>
              ))}
              <td className="px-4 py-3 text-right text-xs text-slate-400">Auto</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════════════════
export default function CashFlow() {
  const tr = useT()

  const [forecast, setForecast] = useState(null)
  const [income, setIncome] = useState([])
  const [expenses, setExpenses] = useState([])
  const [assumptions, setAssumptions] = useState([])
  const [autoIncome, setAutoIncome] = useState([])
  const [loading, setLoading] = useState(true)

  // Add-form state
  const [showIncomeForm, setShowIncomeForm] = useState(false)
  const [incomeForm, setIncomeForm] = useState(INCOME_BLANK)
  const [incomeFormError, setIncomeFormError] = useState('')
  const [incomeFormSaving, setIncomeFormSaving] = useState(false)

  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [expenseForm, setExpenseForm] = useState(EXPENSE_BLANK)
  const [expenseFormError, setExpenseFormError] = useState('')
  const [expenseFormSaving, setExpenseFormSaving] = useState(false)

  // Edit state
  const [editIncomeId, setEditIncomeId] = useState(null)
  const [editExpenseId, setEditExpenseId] = useState(null)

  const loadAll = useCallback(async () => {
    setLoading(true)

    // Asset fetches are independent — never block the page
    const [re, inv, pen, alt] = await Promise.all([
      getRealEstate().catch(() => []),
      getInvestments().catch(() => []),
      getPension().catch(() => []),
      getAlternative().catch(() => []),
    ])

    // Cashflow-specific fetches — best effort
    const [f, inc, exp, ass] = await Promise.allSettled([
      getForecast(), getIncome(), getExpenses(), getAssumptions(),
    ]).then(r => r.map(x => x.status === 'fulfilled' ? x.value : null))

    if (f)   setForecast(f)
    if (inc) setIncome(inc)
    if (exp) setExpenses(exp)
    if (ass) setAssumptions(ass)

    // Build auto income rows from actual asset data
    const stockYield = ass?.find?.(a => a.key === 'stock_yield')?.value ?? 0.04

    const rows = [
      ...re.filter(p => parseFloat(p.monthly_income || 0) - parseFloat(p.monthly_expenses || 0) > 0).map(p => ({
        name: p.name,
        amount: parseFloat(p.monthly_income || 0) - parseFloat(p.monthly_expenses || 0),
        frequency: 'monthly',
        source: 'Real Estate',
      })),
      ...inv.filter(s => parseFloat(s.quantity || 0) * parseFloat(s.current_price || 0) > 0).map(s => ({
        name: `${s.symbol} (${s.name || s.symbol})`,
        amount: Math.round((parseFloat(s.quantity) * parseFloat(s.current_price) * stockYield) / 12),
        frequency: 'monthly',
        source: 'Investments',
      })),
      ...pen.filter(p => parseFloat(p.employee_monthly || 0) + parseFloat(p.employer_monthly || 0) > 0).map(p => ({
        name: p.name,
        amount: parseFloat(p.employee_monthly || 0) + parseFloat(p.employer_monthly || 0),
        frequency: 'monthly',
        source: 'Pension',
      })),
      ...alt.filter(a => parseFloat(a.monthly_income || 0) - parseFloat(a.monthly_expenses || 0) > 0).map(a => ({
        name: a.name,
        amount: parseFloat(a.monthly_income || 0) - parseFloat(a.monthly_expenses || 0),
        frequency: 'monthly',
        source: 'Alternative',
      })),
    ]
    setAutoIncome(rows)

    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Income handlers ──────────────────────────────────────────────────────
  const handleAddIncome = async () => {
    if (!incomeForm.name || !incomeForm.amount) { setIncomeFormError('Name and amount required'); return }
    setIncomeFormSaving(true); setIncomeFormError('')
    try {
      const row = await addIncome({ ...incomeForm, amount: parseFloat(incomeForm.amount) })
      setIncome(p => [row, ...p])
      setShowIncomeForm(false)
      setIncomeForm(INCOME_BLANK)
      loadForecast()
    } catch (err) { setIncomeFormError(err.response?.data?.error || 'Failed') }
    finally { setIncomeFormSaving(false) }
  }

  const handleEditIncomeSave = async (data) => {
    const updated = await updateIncome(editIncomeId, { ...data, amount: parseFloat(data.amount) })
    setIncome(p => p.map(r => r.id === editIncomeId ? updated : r))
    setEditIncomeId(null)
    loadForecast()
  }

  const handleDeleteIncome = async (id) => {
    if (!confirm('Delete income source?')) return
    await deleteIncome(id)
    setIncome(p => p.filter(r => r.id !== id))
    loadForecast()
  }

  // ── Expense handlers ─────────────────────────────────────────────────────
  const handleAddExpense = async () => {
    if (!expenseForm.name || !expenseForm.amount) { setExpenseFormError('Name and amount required'); return }
    setExpenseFormSaving(true); setExpenseFormError('')
    try {
      const row = await addExpense({ ...expenseForm, amount: parseFloat(expenseForm.amount) })
      setExpenses(p => [row, ...p])
      setShowExpenseForm(false)
      setExpenseForm(EXPENSE_BLANK)
      loadForecast()
    } catch (err) { setExpenseFormError(err.response?.data?.error || 'Failed') }
    finally { setExpenseFormSaving(false) }
  }

  const handleEditExpenseSave = async (data) => {
    const updated = await updateExpense(editExpenseId, { ...data, amount: parseFloat(data.amount) })
    setExpenses(p => p.map(r => r.id === editExpenseId ? updated : r))
    setEditExpenseId(null)
    loadForecast()
  }

  const handleDeleteExpense = async (id) => {
    if (!confirm('Delete expense goal?')) return
    await deleteExpense(id)
    setExpenses(p => p.filter(r => r.id !== id))
    loadForecast()
  }

  // ── Assumptions handlers ─────────────────────────────────────────────────
  const handleAssumptionBlur = async (key, rawValue) => {
    const numValue = parseFloat(rawValue) / 100
    if (isNaN(numValue)) return
    setAssumptions(p => p.map(a => a.key === key ? { ...a, value: numValue } : a))
    try {
      await updateAssumptions([{ key, value: numValue }])
      loadForecast()
    } catch (_) {}
  }

  const loadForecast = async () => {
    try {
      const f = await getForecast()
      setForecast(f)
    } catch (_) {}
  }

  // ── Field definitions ────────────────────────────────────────────────────
  const INCOME_FIELDS = [
    { key: 'name',       label: 'Name' },
    { key: 'amount',     label: 'Amount (ILS)', type: 'number', render: r => <span className="font-semibold text-green-600">{fmtILS(r.amount)}</span> },
    { key: 'frequency',  label: 'Frequency', options: [
      { value: 'monthly', label: 'Monthly' },
      { value: 'annual',  label: 'Annual' },
    ], render: r => r.frequency === 'annual' ? 'Annual' : 'Monthly' },
    { key: 'source',     label: 'Source', readOnly: true, render: r => r.source
        ? <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-600">{r.source}</span>
        : <span className="text-slate-300">Manual</span>
    },
    { key: 'end_date',   label: 'End Date', type: 'date', render: r => r.end_date ? new Date(r.end_date).toLocaleDateString() : 'Ongoing' },
  ]

  const EXPENSE_FIELDS = [
    { key: 'name',        label: 'Name' },
    { key: 'amount',      label: 'Amount (ILS)', type: 'number', render: r => fmtILS(r.amount) },
    { key: 'frequency',   label: 'Frequency', options: [
      { value: 'monthly',  label: 'Monthly' },
      { value: 'one_time', label: 'One-Time' },
    ], render: r => r.frequency === 'one_time' ? 'One-Time' : 'Monthly' },
    { key: 'target_date', label: 'Target Date', type: 'date', render: r => r.target_date ? new Date(r.target_date).toLocaleDateString() : '—' },
  ]

  const AUTO_INCOME = autoIncome

  if (loading) return (
    <Layout>
      <div className="text-center text-slate-400 py-24 animate-pulse">Loading cash flow…</div>
    </Layout>
  )

  // Compute today snapshot — prefer backend forecast, fall back to live asset data
  const autoTotal = autoIncome.reduce((s, r) => s + r.amount, 0)
  const manualTotal = income.reduce((s, r) => s + (r.frequency === 'annual' ? r.amount / 12 : parseFloat(r.amount || 0)), 0)
  const expenseTotal = expenses.filter(e => e.frequency !== 'one_time').reduce((s, e) => s + parseFloat(e.amount || 0), 0)

  const today = forecast?.today?.monthly_income
    ? forecast.today
    : {
        monthly_income: Math.round(autoTotal + manualTotal),
        monthly_expenses: Math.round(expenseTotal),
        monthly_net: Math.round(autoTotal + manualTotal - expenseTotal),
        income_breakdown: {
          manual: Math.round(manualTotal),
          real_estate: Math.round(autoIncome.filter(r => r.source === 'Real Estate').reduce((s, r) => s + r.amount, 0)),
          investments: Math.round(autoIncome.filter(r => r.source === 'Investments').reduce((s, r) => s + r.amount, 0)),
          pension: Math.round(autoIncome.filter(r => r.source === 'Pension').reduce((s, r) => s + r.amount, 0)),
          alternative: Math.round(autoIncome.filter(r => r.source === 'Alternative').reduce((s, r) => s + r.amount, 0)),
        },
      }
  const netPositive = (today.monthly_net || 0) >= 0

  return (
    <Layout>
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 md:mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">{tr('cashflow')}</h1>
          <p className="text-slate-500 text-sm mt-1">{tr('cashflow_sub')}</p>
        </div>
      </div>

      {/* ── 1. Monthly Snapshot ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-8">
        <div className="rounded-2xl p-5 bg-white" style={{ border: '1px solid rgba(34,197,94,0.25)', boxShadow: 'var(--card-shadow)' }}>
          <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Monthly Income</p>
          <p className="text-xl font-bold font-num text-green-600">{fmtILS(today.monthly_income)}</p>
          <p className="text-slate-400 text-xs mt-1">/mo</p>
        </div>
        <div className="rounded-2xl p-5 bg-white" style={{ border: '1px solid rgba(239,68,68,0.2)', boxShadow: 'var(--card-shadow)' }}>
          <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Monthly Expenses</p>
          <p className="text-xl font-bold font-num text-red-500">{fmtILS(today.monthly_expenses)}</p>
          <p className="text-slate-400 text-xs mt-1">/mo</p>
        </div>
        <div className="rounded-2xl p-5 bg-white" style={{ border: `1px solid ${netPositive ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, boxShadow: 'var(--card-shadow)' }}>
          <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Monthly Net</p>
          <p className={`text-xl font-bold font-num ${netPositive ? 'text-green-600' : 'text-red-500'}`}>{fmtILS(today.monthly_net)}</p>
          <p className="text-slate-400 text-xs mt-1">/mo</p>
        </div>
      </div>

      {/* Income breakdown mini-list */}
      {forecast && (
        <div className="rounded-2xl p-5 bg-white mb-8" style={{ border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Income Breakdown</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {Object.entries({
              Manual: forecast.today.income_breakdown.manual,
              'Real Estate': forecast.today.income_breakdown.real_estate,
              Investments: forecast.today.income_breakdown.investments,
              Pension: forecast.today.income_breakdown.pension,
              Alternative: forecast.today.income_breakdown.alternative,
            }).map(([label, val]) => (
              <div key={label} className="text-center">
                <p className="text-xs text-slate-400 mb-0.5">{label}</p>
                <p className="text-sm font-semibold text-slate-700">{fmtILS(val)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 2. Income Sources ────────────────────────────────────── */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-slate-800">Income Sources</h2>
          <button
            onClick={() => { setShowIncomeForm(true); setIncomeForm(INCOME_BLANK) }}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white transition"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}
          >
            + Add Income
          </button>
        </div>

        {showIncomeForm && (
          <InlineForm
            fields={INCOME_FIELDS.map(f => ({ key: f.key, label: f.label, type: f.type, options: f.options }))}
            values={incomeForm}
            onChange={(k, v) => setIncomeForm(p => ({ ...p, [k]: v }))}
            onSave={handleAddIncome}
            onCancel={() => { setShowIncomeForm(false); setIncomeFormError('') }}
            saving={incomeFormSaving}
            error={incomeFormError}
          />
        )}

        <CrudTable
          rows={income}
          fields={INCOME_FIELDS}
          autoRows={AUTO_INCOME}
          onEdit={row => setEditIncomeId(row.id)}
          onDelete={handleDeleteIncome}
          editId={editIncomeId}
          onEditSave={handleEditIncomeSave}
          onEditCancel={() => setEditIncomeId(null)}
        />
      </section>

      {/* ── 3. Expense Goals ─────────────────────────────────────── */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-slate-800">Expense Goals</h2>
          <button
            onClick={() => { setShowExpenseForm(true); setExpenseForm(EXPENSE_BLANK) }}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white transition"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}
          >
            + Add Expense
          </button>
        </div>

        {showExpenseForm && (
          <InlineForm
            fields={EXPENSE_FIELDS.map(f => ({ key: f.key, label: f.label, type: f.type, options: f.options }))}
            values={expenseForm}
            onChange={(k, v) => setExpenseForm(p => ({ ...p, [k]: v }))}
            onSave={handleAddExpense}
            onCancel={() => { setShowExpenseForm(false); setExpenseFormError('') }}
            saving={expenseFormSaving}
            error={expenseFormError}
          />
        )}

        <CrudTable
          rows={expenses}
          fields={EXPENSE_FIELDS}
          onEdit={row => setEditExpenseId(row.id)}
          onDelete={handleDeleteExpense}
          editId={editExpenseId}
          onEditSave={handleEditExpenseSave}
          onEditCancel={() => setEditExpenseId(null)}
        />
      </section>

      {/* ── 4. Assumptions ───────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-base font-bold text-slate-800 mb-3">Growth & Inflation Assumptions</h2>
        <div className="rounded-2xl p-5 bg-white" style={{ border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {assumptions.map(a => (
              <div key={a.key}>
                <label className="block text-xs text-slate-500 mb-1">{a.label}</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    defaultValue={(parseFloat(a.value) * 100).toFixed(1)}
                    onBlur={e => handleAssumptionBlur(a.key, e.target.value)}
                    className="w-20 rounded-lg px-3 py-2 text-sm focus:outline-none text-slate-800"
                    style={{ background: 'var(--surface2)', border: '1px solid rgba(0,0,0,0.1)' }}
                  />
                  <span className="text-slate-500 text-sm">%</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-3">Changes are saved automatically on blur.</p>
        </div>
      </section>

      {/* ── 5. Forecast Table ────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-base font-bold text-slate-800 mb-3">Financial Forecast</h2>
        <div className="overflow-x-auto rounded-2xl bg-white" style={{ border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Metric</th>
                <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Today</th>
                {forecast?.forecast?.map(f => (
                  <th key={f.year} className="text-right px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Year {f.year}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Monthly Income', key: 'monthly_income', color: 'text-green-600' },
                { label: 'Monthly Expenses', key: 'monthly_expenses', color: 'text-red-500' },
                { label: 'Monthly Net', key: 'monthly_net', isNet: true },
                { label: 'Portfolio Value', key: 'portfolio_value', color: 'text-blue-600' },
              ].map(row => (
                <tr key={row.key} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-5 py-3.5 font-medium text-slate-700">{row.label}</td>
                  <td className={`px-5 py-3.5 text-right font-num font-semibold ${
                    row.isNet
                      ? (today.monthly_net >= 0 ? 'text-green-600' : 'text-red-500')
                      : row.color
                  }`}>
                    {fmtILS(today[row.key])}
                  </td>
                  {forecast?.forecast?.map(f => (
                    <td key={f.year} className={`px-5 py-3.5 text-right font-num font-semibold ${
                      row.isNet
                        ? (f.monthly_net >= 0 ? 'text-green-600' : 'text-red-500')
                        : row.color
                    }`}>
                      {fmtILS(f[row.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </Layout>
  )
}
