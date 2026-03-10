const router = require('express').Router()
const { query } = require('../db/sql')
const { authenticate } = require('../middleware/auth')

router.use(authenticate)

// ── Default assumptions ────────────────────────────────────────────────────
const DEFAULT_ASSUMPTIONS = [
  { key: 'stock_yield',              value: 0.04, label: 'Stock Yield (annual %)' },
  { key: 'portfolio_growth',         value: 0.07, label: 'Portfolio Growth (annual %)' },
  { key: 'inflation_rate',           value: 0.03, label: 'Inflation Rate (annual %)' },
  { key: 'real_estate_appreciation', value: 0.03, label: 'Real Estate Appreciation (annual %)' },
]

// ── Ensure tables exist (idempotent) ──────────────────────────────────────
async function ensureTables() {
  await query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='income_sources' AND xtype='U')
    CREATE TABLE income_sources (
      id         INT IDENTITY PRIMARY KEY,
      user_id    INT NOT NULL,
      name       NVARCHAR(200) NOT NULL,
      amount     DECIMAL(18,4) NOT NULL,
      currency   NVARCHAR(10) DEFAULT 'ILS',
      frequency  NVARCHAR(20) DEFAULT 'monthly',
      start_date DATE,
      end_date   DATE,
      created_at DATETIME2 DEFAULT GETUTCDATE()
    )
  `)
  await query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='expense_goals' AND xtype='U')
    CREATE TABLE expense_goals (
      id          INT IDENTITY PRIMARY KEY,
      user_id     INT NOT NULL,
      name        NVARCHAR(200) NOT NULL,
      amount      DECIMAL(18,4) NOT NULL,
      currency    NVARCHAR(10) DEFAULT 'ILS',
      frequency   NVARCHAR(20) DEFAULT 'monthly',
      target_date DATE,
      created_at  DATETIME2 DEFAULT GETUTCDATE()
    )
  `)
  await query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='cashflow_assumptions' AND xtype='U')
    CREATE TABLE cashflow_assumptions (
      id      INT IDENTITY PRIMARY KEY,
      user_id INT NOT NULL,
      [key]   NVARCHAR(100) NOT NULL,
      value   DECIMAL(10,4) NOT NULL,
      label   NVARCHAR(200),
      CONSTRAINT uq_cashflow_assumptions UNIQUE (user_id, [key])
    )
  `)
}

// Run once at module load
ensureTables().catch(err => console.error('cashflow ensureTables:', err))

// ── Helper: get assumptions map for a user ────────────────────────────────
async function getAssumptionsMap(userId) {
  const result = await query(
    'SELECT [key], value FROM cashflow_assumptions WHERE user_id = @userId',
    { userId }
  )
  const map = {}
  for (const d of DEFAULT_ASSUMPTIONS) map[d.key] = d.value
  for (const row of result.recordset) map[row.key] = parseFloat(row.value)
  return map
}

// ═══════════════════════════════════════════════════════════════════════════
// Income Sources
// ═══════════════════════════════════════════════════════════════════════════

router.get('/income', async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM income_sources WHERE user_id = @userId ORDER BY created_at DESC',
      { userId: req.user.id }
    )
    res.json(result.recordset)
  } catch (err) { next(err) }
})

router.post('/income', async (req, res, next) => {
  try {
    const { name, amount, currency, frequency, start_date, end_date } = req.body
    if (!name || amount == null) return res.status(400).json({ error: 'name and amount required' })
    const result = await query(`
      INSERT INTO income_sources (user_id, name, amount, currency, frequency, start_date, end_date)
      OUTPUT INSERTED.*
      VALUES (@userId, @name, @amount, @currency, @frequency, @start_date, @end_date)
    `, {
      userId: req.user.id,
      name,
      amount: parseFloat(amount),
      currency: currency || 'ILS',
      frequency: frequency || 'monthly',
      start_date: start_date || null,
      end_date: end_date || null,
    })
    res.status(201).json(result.recordset[0])
  } catch (err) { next(err) }
})

router.put('/income/:id', async (req, res, next) => {
  try {
    const { name, amount, currency, frequency, start_date, end_date } = req.body
    const result = await query(`
      UPDATE income_sources
      SET name       = ISNULL(@name, name),
          amount     = ISNULL(@amount, amount),
          currency   = ISNULL(@currency, currency),
          frequency  = ISNULL(@frequency, frequency),
          start_date = @start_date,
          end_date   = @end_date
      OUTPUT INSERTED.*
      WHERE id = @id AND user_id = @userId
    `, {
      id: req.params.id,
      userId: req.user.id,
      name: name || null,
      amount: amount != null ? parseFloat(amount) : null,
      currency: currency || null,
      frequency: frequency || null,
      start_date: start_date || null,
      end_date: end_date || null,
    })
    if (!result.recordset[0]) return res.status(404).json({ error: 'Not found' })
    res.json(result.recordset[0])
  } catch (err) { next(err) }
})

router.delete('/income/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM income_sources WHERE id = @id AND user_id = @userId',
      { id: req.params.id, userId: req.user.id })
    res.json({ success: true })
  } catch (err) { next(err) }
})

// ═══════════════════════════════════════════════════════════════════════════
// Expense Goals
// ═══════════════════════════════════════════════════════════════════════════

router.get('/expenses', async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM expense_goals WHERE user_id = @userId ORDER BY created_at DESC',
      { userId: req.user.id }
    )
    res.json(result.recordset)
  } catch (err) { next(err) }
})

router.post('/expenses', async (req, res, next) => {
  try {
    const { name, amount, currency, frequency, target_date } = req.body
    if (!name || amount == null) return res.status(400).json({ error: 'name and amount required' })
    const result = await query(`
      INSERT INTO expense_goals (user_id, name, amount, currency, frequency, target_date)
      OUTPUT INSERTED.*
      VALUES (@userId, @name, @amount, @currency, @frequency, @target_date)
    `, {
      userId: req.user.id,
      name,
      amount: parseFloat(amount),
      currency: currency || 'ILS',
      frequency: frequency || 'monthly',
      target_date: target_date || null,
    })
    res.status(201).json(result.recordset[0])
  } catch (err) { next(err) }
})

router.put('/expenses/:id', async (req, res, next) => {
  try {
    const { name, amount, currency, frequency, target_date } = req.body
    const result = await query(`
      UPDATE expense_goals
      SET name        = ISNULL(@name, name),
          amount      = ISNULL(@amount, amount),
          currency    = ISNULL(@currency, currency),
          frequency   = ISNULL(@frequency, frequency),
          target_date = @target_date
      OUTPUT INSERTED.*
      WHERE id = @id AND user_id = @userId
    `, {
      id: req.params.id,
      userId: req.user.id,
      name: name || null,
      amount: amount != null ? parseFloat(amount) : null,
      currency: currency || null,
      frequency: frequency || null,
      target_date: target_date || null,
    })
    if (!result.recordset[0]) return res.status(404).json({ error: 'Not found' })
    res.json(result.recordset[0])
  } catch (err) { next(err) }
})

router.delete('/expenses/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM expense_goals WHERE id = @id AND user_id = @userId',
      { id: req.params.id, userId: req.user.id })
    res.json({ success: true })
  } catch (err) { next(err) }
})

// ═══════════════════════════════════════════════════════════════════════════
// Assumptions
// ═══════════════════════════════════════════════════════════════════════════

router.get('/assumptions', async (req, res, next) => {
  try {
    const stored = await query(
      'SELECT [key], value, label FROM cashflow_assumptions WHERE user_id = @userId',
      { userId: req.user.id }
    )
    const storedMap = {}
    for (const row of stored.recordset) storedMap[row.key] = row

    const result = DEFAULT_ASSUMPTIONS.map(d => ({
      key: d.key,
      label: storedMap[d.key]?.label || d.label,
      value: storedMap[d.key] ? parseFloat(storedMap[d.key].value) : d.value,
    }))
    res.json(result)
  } catch (err) { next(err) }
})

router.put('/assumptions', async (req, res, next) => {
  try {
    const updates = Array.isArray(req.body) ? req.body : [req.body]
    for (const { key, value, label } of updates) {
      if (!key || value == null) continue
      await query(`
        MERGE cashflow_assumptions AS target
        USING (SELECT @userId AS user_id, @key AS [key]) AS source
          ON target.user_id = source.user_id AND target.[key] = source.[key]
        WHEN MATCHED THEN
          UPDATE SET value = @value, label = ISNULL(@label, label)
        WHEN NOT MATCHED THEN
          INSERT (user_id, [key], value, label) VALUES (@userId, @key, @value, @label);
      `, { userId: req.user.id, key, value: parseFloat(value), label: label || null })
    }
    res.json({ success: true })
  } catch (err) { next(err) }
})

// ═══════════════════════════════════════════════════════════════════════════
// Forecast
// ═══════════════════════════════════════════════════════════════════════════

router.get('/forecast', async (req, res, next) => {
  try {
    const uid = req.user.id
    const assumptions = await getAssumptionsMap(uid)

    // 1. Manual income sources
    const incomeRows = await query(
      "SELECT amount, frequency FROM income_sources WHERE user_id = @userId AND (end_date IS NULL OR end_date >= GETUTCDATE())",
      { userId: uid }
    )
    let manualMonthly = 0
    for (const r of incomeRows.recordset) {
      manualMonthly += r.frequency === 'annual' ? parseFloat(r.amount) / 12 : parseFloat(r.amount)
    }

    // 2. Auto-aggregated income
    let realEstateMonthly = 0
    try {
      const re = await query(
        'SELECT monthly_income, monthly_expense FROM real_estate_properties WHERE user_id = @userId',
        { userId: uid }
      )
      for (const r of re.recordset) {
        realEstateMonthly += parseFloat(r.monthly_income || 0) - parseFloat(r.monthly_expense || 0)
      }
    } catch (_) {}

    let pensionMonthly = 0
    try {
      const pen = await query(
        'SELECT employee_monthly, employer_monthly FROM pension_assets WHERE user_id = @userId',
        { userId: uid }
      )
      for (const r of pen.recordset) {
        pensionMonthly += parseFloat(r.employee_monthly || 0) + parseFloat(r.employer_monthly || 0)
      }
    } catch (_) {}

    let altMonthly = 0
    try {
      const alt = await query(
        'SELECT monthly_income, monthly_expenses FROM alternative_investments WHERE user_id = @userId',
        { userId: uid }
      )
      for (const r of alt.recordset) {
        altMonthly += parseFloat(r.monthly_income || 0) - parseFloat(r.monthly_expenses || 0)
      }
    } catch (_) {}

    let investmentMonthly = 0
    let investmentPortfolioValue = 0
    try {
      const inv = await query(
        'SELECT quantity, current_price FROM investments WHERE user_id = @userId',
        { userId: uid }
      )
      for (const r of inv.recordset) {
        investmentPortfolioValue += parseFloat(r.quantity || 0) * parseFloat(r.current_price || 0)
      }
      investmentMonthly = (investmentPortfolioValue * assumptions.stock_yield) / 12
    } catch (_) {}

    // 3. Expense goals (ongoing monthly, exclude one_time with past target_date)
    const expRows = await query(
      `SELECT amount, frequency, target_date FROM expense_goals
       WHERE user_id = @userId
         AND (frequency != 'one_time' OR target_date IS NULL OR target_date >= GETUTCDATE())`,
      { userId: uid }
    )
    let baseMonthlyExpenses = 0
    for (const r of expRows.recordset) {
      if (r.frequency === 'one_time') continue // exclude one-time from ongoing
      baseMonthlyExpenses += parseFloat(r.amount)
    }

    const totalMonthlyIncome = manualMonthly + realEstateMonthly + pensionMonthly + altMonthly + investmentMonthly

    // 4. Estimate total portfolio value for growth projection
    let totalPortfolioValue = investmentPortfolioValue
    try {
      const reVal = await query(
        'SELECT current_value FROM real_estate_properties WHERE user_id = @userId',
        { userId: uid }
      )
      for (const r of reVal.recordset) totalPortfolioValue += parseFloat(r.current_value || 0)
    } catch (_) {}
    try {
      const penVal = await query(
        'SELECT current_value FROM pension_assets WHERE user_id = @userId',
        { userId: uid }
      )
      for (const r of penVal.recordset) totalPortfolioValue += parseFloat(r.current_value || 0)
    } catch (_) {}

    // 5. Build forecast for years 1, 5, 10
    const YEARS = [1, 5, 10]
    const forecast = YEARS.map(yr => {
      const incomeGrowth  = Math.pow(1 + assumptions.stock_yield, yr)
      const expenseGrowth = Math.pow(1 + assumptions.inflation_rate, yr)
      const portfolioGrowth = Math.pow(1 + assumptions.portfolio_growth, yr)

      const monthly_income   = totalMonthlyIncome * incomeGrowth
      const monthly_expenses = baseMonthlyExpenses * expenseGrowth
      const monthly_net      = monthly_income - monthly_expenses
      const portfolio_value  = totalPortfolioValue * portfolioGrowth

      return {
        year: yr,
        monthly_income:   Math.round(monthly_income),
        monthly_expenses: Math.round(monthly_expenses),
        monthly_net:      Math.round(monthly_net),
        portfolio_value:  Math.round(portfolio_value),
      }
    })

    res.json({
      today: {
        monthly_income:   Math.round(totalMonthlyIncome),
        monthly_expenses: Math.round(baseMonthlyExpenses),
        monthly_net:      Math.round(totalMonthlyIncome - baseMonthlyExpenses),
        income_breakdown: {
          manual:       Math.round(manualMonthly),
          real_estate:  Math.round(realEstateMonthly),
          pension:      Math.round(pensionMonthly),
          alternative:  Math.round(altMonthly),
          investments:  Math.round(investmentMonthly),
        },
      },
      forecast,
    })
  } catch (err) { next(err) }
})

module.exports = router
