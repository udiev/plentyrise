const router = require('express').Router()
const { query } = require('../db/sql')
const { authenticate } = require('../middleware/auth')

router.use(authenticate)

router.get('/', async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM pension_assets WHERE user_id = @userId ORDER BY created_at DESC',
      { userId: req.user.id }
    )
    res.json(result.recordset)
  } catch (err) { next(err) }
})

router.post('/', async (req, res, next) => {
  try {
    const { name, pension_type, current_value, employee_monthly, employer_monthly, track, managing_company, notes } = req.body
    const result = await query(`
      INSERT INTO pension_assets (user_id, name, pension_type, current_value, employee_monthly, employer_monthly, track, managing_company, notes)
      OUTPUT INSERTED.*
      VALUES (@userId, @name, @pension_type, @current_value, @employee_monthly, @employer_monthly, @track, @managing_company, @notes)
    `, {
      userId: req.user.id,
      name, pension_type,
      current_value: current_value || 0,
      employee_monthly: employee_monthly || 0,
      employer_monthly: employer_monthly || 0,
      track: track || null,
      managing_company: managing_company || null,
      notes: notes || null
    })
    res.status(201).json(result.recordset[0])
  } catch (err) { next(err) }
})

router.put('/:id', async (req, res, next) => {
  try {
    const { current_value, employee_monthly, employer_monthly, track, notes } = req.body
    const result = await query(`
      UPDATE pension_assets
      SET current_value = ISNULL(@current_value, current_value),
          employee_monthly = ISNULL(@employee_monthly, employee_monthly),
          employer_monthly = ISNULL(@employer_monthly, employer_monthly),
          track = ISNULL(@track, track),
          notes = ISNULL(@notes, notes),
          updated_at = GETUTCDATE()
      OUTPUT INSERTED.*
      WHERE id = @id AND user_id = @userId
    `, { id: req.params.id, userId: req.user.id, current_value, employee_monthly, employer_monthly, track, notes })
    if (!result.recordset[0]) return res.status(404).json({ error: 'Not found' })
    res.json(result.recordset[0])
  } catch (err) { next(err) }
})

router.delete('/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM pension_assets WHERE id = @id AND user_id = @userId',
      { id: req.params.id, userId: req.user.id })
    res.json({ success: true })
  } catch (err) { next(err) }
})

module.exports = router
