const router = require('express').Router()
const { query } = require('../db/sql')
const { authenticate } = require('../middleware/auth')

router.use(authenticate)

router.get('/', async (req, res, next) => {
  try {
    let result
    try {
      result = await query(
        'SELECT * FROM alternative_investments WHERE user_id = @userId ORDER BY created_at DESC',
        { userId: req.user.id }
      )
    } catch (err) {
      if (err.message?.includes('alternative_investments')) return res.json([])
      throw err
    }
    res.json(result.recordset)
  } catch (err) { next(err) }
})

router.post('/', async (req, res, next) => {
  try {
    const { name, investment_type, amount_invested, current_value, monthly_income, monthly_expenses, currency, purchase_date, exit_date, notes } = req.body
    if (!name) return res.status(400).json({ error: 'Name required' })
    let row
    try {
      const r = await query(`
        INSERT INTO alternative_investments (user_id, name, investment_type, amount_invested, current_value, monthly_income, monthly_expenses, currency, purchase_date, exit_date, notes)
        OUTPUT INSERTED.*
        VALUES (@userId, @name, @investment_type, @amount_invested, @current_value, @monthly_income, @monthly_expenses, @currency, @purchase_date, @exit_date, @notes)
      `, {
        userId: req.user.id,
        name,
        investment_type: investment_type || 'private_equity',
        amount_invested: amount_invested || 0,
        current_value: current_value || 0,
        monthly_income: monthly_income || 0,
        monthly_expenses: monthly_expenses || 0,
        currency: currency || 'ILS',
        purchase_date: purchase_date || null,
        exit_date: exit_date || null,
        notes: notes || null,
      })
      row = r.recordset[0]
    } catch (colErr) {
      if (colErr.message?.includes('alternative_investments')) {
        return res.status(503).json({ error: 'Table not created yet. Run the SQL migration first.' })
      }
      throw colErr
    }
    res.status(201).json(row)
  } catch (err) { next(err) }
})

router.put('/:id', async (req, res, next) => {
  try {
    const { name, investment_type, amount_invested, current_value, monthly_income, monthly_expenses, currency, purchase_date, exit_date, notes } = req.body
    let result
    try {
      result = await query(`
        UPDATE alternative_investments
        SET name              = ISNULL(@name, name),
            investment_type   = ISNULL(@investment_type, investment_type),
            amount_invested   = ISNULL(@amount_invested, amount_invested),
            current_value     = ISNULL(@current_value, current_value),
            monthly_income    = ISNULL(@monthly_income, monthly_income),
            monthly_expenses  = ISNULL(@monthly_expenses, monthly_expenses),
            currency          = ISNULL(@currency, currency),
            notes             = ISNULL(@notes, notes),
            purchase_date     = CASE WHEN @purchase_date IS NOT NULL THEN CAST(@purchase_date AS DATE) ELSE purchase_date END,
            exit_date         = CASE WHEN @exit_date IS NOT NULL THEN CAST(@exit_date AS DATE) ELSE exit_date END,
            updated_at        = GETUTCDATE()
        OUTPUT INSERTED.*
        WHERE id = @id AND user_id = @userId
      `, {
        id: req.params.id,
        userId: req.user.id,
        name,
        investment_type,
        amount_invested,
        current_value,
        monthly_income,
        monthly_expenses,
        currency,
        notes,
        purchase_date: purchase_date || null,
        exit_date: exit_date || null,
      })
    } catch (colErr) {
      if (colErr.message?.includes('alternative_investments')) {
        return res.status(503).json({ error: 'Table not created yet. Run the SQL migration first.' })
      }
      throw colErr
    }
    if (!result.recordset[0]) return res.status(404).json({ error: 'Not found' })
    res.json(result.recordset[0])
  } catch (err) { next(err) }
})

router.delete('/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM alternative_investments WHERE id = @id AND user_id = @userId',
      { id: req.params.id, userId: req.user.id })
    res.json({ success: true })
  } catch (err) { next(err) }
})

router.post('/import', async (req, res, next) => {
  try {
    const { rows } = req.body
    if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'No rows provided' })
    const results = []
    for (const row of rows) {
      const { name, investment_type, amount_invested, current_value, currency, monthly_income, monthly_expenses, purchase_date, exit_date } = row
      if (!name || !amount_invested || !current_value) continue
      const r = await query(`
        INSERT INTO alternative_investments (user_id, name, investment_type, amount_invested, current_value, currency, monthly_income, monthly_expenses, purchase_date, exit_date)
        OUTPUT INSERTED.*
        VALUES (@userId, @name, @investment_type, @amount_invested, @current_value, @currency, @monthly_income, @monthly_expenses, @purchase_date, @exit_date)
      `, {
        userId: req.user.id,
        name,
        investment_type: investment_type || 'private_equity',
        amount_invested: parseFloat(amount_invested),
        current_value: parseFloat(current_value),
        currency: currency || 'ILS',
        monthly_income: parseFloat(monthly_income || 0),
        monthly_expenses: parseFloat(monthly_expenses || 0),
        purchase_date: purchase_date || null,
        exit_date: exit_date || null,
      })
      if (r.recordset[0]) results.push(r.recordset[0])
    }
    res.status(201).json(results)
  } catch (err) { next(err) }
})

module.exports = router
