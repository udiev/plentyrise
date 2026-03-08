const router = require('express').Router()
const axios = require('axios')
const { query } = require('../db/sql')
const { authenticate } = require('../middleware/auth')

const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
}

// GET /api/v1/investments/ticker-info/:symbol
router.get('/ticker-info/:symbol', authenticate, async (req, res, next) => {
  try {
    const symbol = req.params.symbol.toUpperCase()
    const { data } = await axios.get(
      `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=quoteType,assetProfile`,
      { headers: YAHOO_HEADERS, timeout: 8000 }
    )
    const qt = data?.quoteSummary?.result?.[0]?.quoteType || {}
    const ap = data?.quoteSummary?.result?.[0]?.assetProfile || {}

    const typeMap = { EQUITY: 'stock', ETF: 'etf', MUTUALFUND: 'mutual_fund', BOND: 'bond' }

    res.json({
      name:       qt.longName || qt.shortName || symbol,
      asset_type: typeMap[qt.quoteType] || 'stock',
      sector:     ap.sector   || null,
      industry:   ap.industry || null,
      logo_url:   `https://assets.parqet.com/logos/symbol/${symbol}`,
    })
  } catch (err) {
    res.status(404).json({ error: 'Ticker not found or Yahoo Finance unavailable' })
  }
})

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

router.post('/import', async (req, res, next) => {
  try {
    const { rows } = req.body
    if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'No rows provided' })
    const results = []
    for (const row of rows) {
      const { symbol, name, asset_type, quantity, purchase_price, currency, broker } = row
      if (!symbol || !quantity || !purchase_price) continue
      const r = await query(`
        INSERT INTO investments (user_id, symbol, name, asset_type, quantity, purchase_price, currency, broker)
        OUTPUT INSERTED.*
        VALUES (@userId, @symbol, @name, @asset_type, @quantity, @purchase_price, @currency, @broker)
      `, {
        userId: req.user.id,
        symbol: String(symbol).toUpperCase(),
        name: name || symbol,
        asset_type: asset_type || 'stock',
        quantity: parseFloat(quantity),
        purchase_price: parseFloat(purchase_price),
        currency: currency || 'USD',
        broker: broker || null,
      })
      if (r.recordset[0]) results.push(r.recordset[0])
    }
    res.status(201).json(results)
  } catch (err) { next(err) }
})

module.exports = router
