const router = require('express').Router()
const { query } = require('../db/sql')
const { authenticate } = require('../middleware/auth')

router.use(authenticate)

router.get('/', async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM crypto_assets WHERE user_id = @userId ORDER BY created_at DESC',
      { userId: req.user.id }
    )
    res.json(result.recordset)
  } catch (err) { next(err) }
})

router.post('/', async (req, res, next) => {
  try {
    const { coin_id, symbol, name, quantity, purchase_price_usd, notes } = req.body
    const result = await query(`
      INSERT INTO crypto_assets (user_id, coin_id, symbol, name, quantity, purchase_price_usd, notes)
      OUTPUT INSERTED.*
      VALUES (@userId, @coin_id, @symbol, @name, @quantity, @purchase_price_usd, @notes)
    `, {
      userId: req.user.id,
      coin_id: coin_id || symbol.toLowerCase(),
      symbol: symbol.toUpperCase(),
      name: name || symbol,
      quantity,
      purchase_price_usd,
      notes: notes || null
    })
    res.status(201).json(result.recordset[0])
  } catch (err) { next(err) }
})

router.put('/:id', async (req, res, next) => {
  try {
    const { quantity, purchase_price_usd, current_price_usd, notes } = req.body
    const result = await query(`
      UPDATE crypto_assets
      SET quantity = ISNULL(@quantity, quantity),
          purchase_price_usd = ISNULL(@purchase_price_usd, purchase_price_usd),
          current_price_usd = ISNULL(@current_price_usd, current_price_usd),
          notes = ISNULL(@notes, notes),
          updated_at = GETUTCDATE()
      OUTPUT INSERTED.*
      WHERE id = @id AND user_id = @userId
    `, { id: req.params.id, userId: req.user.id, quantity, purchase_price_usd, current_price_usd, notes })
    if (!result.recordset[0]) return res.status(404).json({ error: 'Not found' })
    res.json(result.recordset[0])
  } catch (err) { next(err) }
})

router.delete('/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM crypto_assets WHERE id = @id AND user_id = @userId',
      { id: req.params.id, userId: req.user.id })
    res.json({ success: true })
  } catch (err) { next(err) }
})

module.exports = router
