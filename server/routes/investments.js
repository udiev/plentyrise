const router = require('express').Router()
const { query } = require('../db/sql')
const { authenticate } = require('../middleware/auth')

router.use(authenticate)

router.get('/', async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM investments WHERE user_id = @userId ORDER BY created_at DESC',
      { userId: req.user.id }
    )
    res.json(result.recordset)
  } catch (err) { next(err) }
})

router.post('/', async (req, res, next) => {
  try {
    const { symbol, name, asset_type, quantity, purchase_price, currency, broker, account_name, is_crypto_tracker } = req.body
    const result = await query(`
      INSERT INTO investments (user_id, symbol, name, asset_type, quantity, purchase_price, currency, broker, account_name, is_crypto_tracker)
      OUTPUT INSERTED.*
      VALUES (@userId, @symbol, @name, @asset_type, @quantity, @purchase_price, @currency, @broker, @account_name, @is_crypto_tracker)
    `, {
      userId: req.user.id,
      symbol: symbol.toUpperCase(),
      name: name || symbol,
      asset_type: asset_type || 'stock',
      quantity, purchase_price,
      currency: currency || 'USD',
      broker: broker || null,
      account_name: account_name || null,
      is_crypto_tracker: is_crypto_tracker || false
    })
    res.status(201).json(result.recordset[0])
  } catch (err) { next(err) }
})

router.put('/:id', async (req, res, next) => {
  try {
    const { quantity, purchase_price, current_price, broker, account_name, notes } = req.body
    const result = await query(`
      UPDATE investments
      SET quantity = ISNULL(@quantity, quantity),
          purchase_price = ISNULL(@purchase_price, purchase_price),
          current_price = ISNULL(@current_price, current_price),
          broker = ISNULL(@broker, broker),
          account_name = ISNULL(@account_name, account_name),
          updated_at = GETUTCDATE()
      OUTPUT INSERTED.*
      WHERE id = @id AND user_id = @userId
    `, { id: req.params.id, userId: req.user.id, quantity, purchase_price, current_price, broker, account_name })
    if (!result.recordset[0]) return res.status(404).json({ error: 'Not found' })
    res.json(result.recordset[0])
  } catch (err) { next(err) }
})

router.delete('/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM investments WHERE id = @id AND user_id = @userId',
      { id: req.params.id, userId: req.user.id })
    res.json({ success: true })
  } catch (err) { next(err) }
})

module.exports = router
