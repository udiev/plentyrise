const router = require('express').Router()
const axios = require('axios')
const { query } = require('../db/sql')
const { authenticate } = require('../middleware/auth')

// GET /api/v1/crypto/coin-info/:symbol
router.get('/coin-info/:symbol', authenticate, async (req, res, next) => {
  try {
    const symbol = req.params.symbol.toUpperCase()
    const { data } = await axios.get(
      `https://api.coingecko.com/api/v3/search?query=${symbol}`,
      { timeout: 8000 }
    )
    const coin = data?.coins?.find(c => c.symbol.toUpperCase() === symbol) || data?.coins?.[0]
    if (!coin) return res.status(404).json({ error: 'Coin not found' })

    res.json({
      name:     coin.name,
      coin_id:  coin.id,
      logo_url: coin.large || coin.thumb || null,
    })
  } catch (err) {
    res.status(404).json({ error: 'Coin not found or CoinGecko unavailable' })
  }
})

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

router.post('/import', async (req, res, next) => {
  try {
    const { rows } = req.body
    if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'No rows provided' })
    const results = []
    for (const row of rows) {
      const { symbol, name, quantity, purchase_price_usd } = row
      if (!symbol || !quantity || !purchase_price_usd) continue
      const r = await query(`
        INSERT INTO crypto_assets (user_id, coin_id, symbol, name, quantity, purchase_price_usd)
        OUTPUT INSERTED.*
        VALUES (@userId, @coin_id, @symbol, @name, @quantity, @purchase_price_usd)
      `, {
        userId: req.user.id,
        coin_id: String(symbol).toLowerCase(),
        symbol: String(symbol).toUpperCase(),
        name: name || symbol,
        quantity: parseFloat(quantity),
        purchase_price_usd: parseFloat(purchase_price_usd),
      })
      if (r.recordset[0]) results.push(r.recordset[0])
    }
    res.status(201).json(results)
  } catch (err) { next(err) }
})

module.exports = router
