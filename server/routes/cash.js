const router = require('express').Router()
const { query } = require('../db/sql')
const { authenticate } = require('../middleware/auth')

router.use(authenticate)

router.get('/', async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM cash_holdings WHERE user_id = @userId ORDER BY created_at DESC',
      { userId: req.user.id }
    )
    res.json(result.recordset)
  } catch (err) { next(err) }
})

router.post('/', async (req, res, next) => {
  try {
    const { name, holding_type, balance, currency, institution, interest_rate, notes } = req.body
    const result = await query(`
      INSERT INTO cash_holdings (user_id, name, holding_type, balance, currency, institution, interest_rate, notes)
      OUTPUT INSERTED.*
      VALUES (@userId, @name, @holding_type, @balance, @currency, @institution, @interest_rate, @notes)
    `, {
      userId: req.user.id,
      name, holding_type: holding_type || 'savings',
      balance, currency: currency || 'ILS',
      institution: institution || null,
      interest_rate: interest_rate || null,
      notes: notes || null
    })
    res.status(201).json(result.recordset[0])
  } catch (err) { next(err) }
})

router.put('/:id', async (req, res, next) => {
  try {
    const { name, balance, interest_rate, notes } = req.body
    const result = await query(`
      UPDATE cash_holdings
      SET name = ISNULL(@name, name),
          balance = ISNULL(@balance, balance),
          interest_rate = ISNULL(@interest_rate, interest_rate),
          notes = ISNULL(@notes, notes),
          updated_at = GETUTCDATE()
      OUTPUT INSERTED.*
      WHERE id = @id AND user_id = @userId
    `, { id: req.params.id, userId: req.user.id, name, balance, interest_rate, notes })
    if (!result.recordset[0]) return res.status(404).json({ error: 'Not found' })
    res.json(result.recordset[0])
  } catch (err) { next(err) }
})

router.delete('/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM cash_holdings WHERE id = @id AND user_id = @userId',
      { id: req.params.id, userId: req.user.id })
    res.json({ success: true })
  } catch (err) { next(err) }
})

module.exports = router
