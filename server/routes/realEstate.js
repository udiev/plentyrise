const router = require('express').Router()
const { query } = require('../db/sql')
const { authenticate } = require('../middleware/auth')

router.use(authenticate)

router.get('/', async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM real_estate_properties WHERE user_id = @userId ORDER BY created_at DESC',
      { userId: req.user.id }
    )
    res.json(result.recordset)
  } catch (err) { next(err) }
})

router.post('/', async (req, res, next) => {
  try {
    const { name, property_type, purchase_price, current_value, monthly_income, monthly_expenses, purchase_date, exit_date, currency, address, notes } = req.body
    const params = {
      userId: req.user.id,
      name, property_type: property_type || 'apartment',
      purchase_price, current_value,
      monthly_income: monthly_income || 0,
      monthly_expenses: monthly_expenses || 0,
      purchase_date: purchase_date || null,
      exit_date: exit_date || null,
      currency: currency || 'ILS',
      address: address || null,
      notes: notes || null
    }
    let result
    try {
      result = await query(`
        INSERT INTO real_estate_properties (user_id, name, property_type, purchase_price, current_value, monthly_income, monthly_expenses, purchase_date, exit_date, currency, address, notes)
        OUTPUT INSERTED.*
        VALUES (@userId, @name, @property_type, @purchase_price, @current_value, @monthly_income, @monthly_expenses, @purchase_date, @exit_date, @currency, @address, @notes)
      `, params)
    } catch (colErr) {
      if (colErr.message?.includes('exit_date')) {
        result = await query(`
          INSERT INTO real_estate_properties (user_id, name, property_type, purchase_price, current_value, monthly_income, monthly_expenses, purchase_date, currency, address, notes)
          OUTPUT INSERTED.*
          VALUES (@userId, @name, @property_type, @purchase_price, @current_value, @monthly_income, @monthly_expenses, @purchase_date, @currency, @address, @notes)
        `, params)
      } else throw colErr
    }
    res.status(201).json(result.recordset[0])
  } catch (err) { next(err) }
})

router.put('/:id', async (req, res, next) => {
  try {
    const { name, current_value, monthly_income, monthly_expenses, purchase_date, exit_date, notes } = req.body
    let result
    try {
      result = await query(`
        UPDATE real_estate_properties
        SET name             = ISNULL(@name, name),
            current_value    = ISNULL(@current_value, current_value),
            monthly_income   = ISNULL(@monthly_income, monthly_income),
            monthly_expenses = ISNULL(@monthly_expenses, monthly_expenses),
            notes            = ISNULL(@notes, notes),
            purchase_date    = CASE WHEN @purchase_date IS NOT NULL THEN CAST(@purchase_date AS DATE) ELSE purchase_date END,
            exit_date        = CASE WHEN @exit_date IS NOT NULL THEN CAST(@exit_date AS DATE) ELSE exit_date END,
            updated_at       = GETUTCDATE()
        OUTPUT INSERTED.*
        WHERE id = @id AND user_id = @userId
      `, { id: req.params.id, userId: req.user.id, name, current_value, monthly_income, monthly_expenses, notes, purchase_date: purchase_date || null, exit_date: exit_date || null })
    } catch (colErr) {
      if (colErr.message?.includes('exit_date') || colErr.message?.includes('purchase_date')) {
        result = await query(`
          UPDATE real_estate_properties
          SET name = ISNULL(@name, name),
              current_value = ISNULL(@current_value, current_value),
              monthly_income = ISNULL(@monthly_income, monthly_income),
              monthly_expenses = ISNULL(@monthly_expenses, monthly_expenses),
              notes = ISNULL(@notes, notes),
              updated_at = GETUTCDATE()
          OUTPUT INSERTED.*
          WHERE id = @id AND user_id = @userId
        `, { id: req.params.id, userId: req.user.id, name, current_value, monthly_income, monthly_expenses, notes })
      } else throw colErr
    }
    if (!result.recordset[0]) return res.status(404).json({ error: 'Not found' })
    res.json(result.recordset[0])
  } catch (err) { next(err) }
})

router.delete('/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM real_estate_properties WHERE id = @id AND user_id = @userId',
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
      const { name, property_type, purchase_price, current_value, currency, monthly_income, monthly_expenses, address, exit_date } = row
      if (!name || !purchase_price || !current_value) continue
      const r = await query(`
        INSERT INTO real_estate_properties (user_id, name, property_type, purchase_price, current_value, currency, monthly_income, monthly_expenses, address, exit_date)
        OUTPUT INSERTED.*
        VALUES (@userId, @name, @property_type, @purchase_price, @current_value, @currency, @monthly_income, @monthly_expenses, @address, @exit_date)
      `, {
        userId: req.user.id,
        name,
        property_type: property_type || 'apartment',
        purchase_price: parseFloat(purchase_price),
        current_value: parseFloat(current_value),
        currency: currency || 'ILS',
        monthly_income: parseFloat(monthly_income || 0),
        monthly_expenses: parseFloat(monthly_expenses || 0),
        address: address || null,
        exit_date: exit_date || null,
      })
      if (r.recordset[0]) results.push(r.recordset[0])
    }
    res.status(201).json(results)
  } catch (err) { next(err) }
})

module.exports = router
