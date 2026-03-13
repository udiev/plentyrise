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

    // Use v8 chart — same endpoint that already works in priceService
    const { data } = await axios.get(
      `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`,
      { headers: YAHOO_HEADERS, timeout: 8000 }
    )
    const meta = data?.chart?.result?.[0]?.meta
    if (!meta) return res.status(404).json({ error: 'Ticker not found' })

    const typeMap = { EQUITY: 'stock', ETF: 'etf', MUTUALFUND: 'mutual_fund', BOND: 'bond' }

    // Optionally fetch sector from v10 — don't fail if it's blocked
    let sector = null, industry = null
    try {
      const { data: sd } = await axios.get(
        `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=assetProfile`,
        { headers: YAHOO_HEADERS, timeout: 5000 }
      )
      const ap = sd?.quoteSummary?.result?.[0]?.assetProfile || {}
      sector   = ap.sector   || null
      industry = ap.industry || null
    } catch {}

    res.json({
      name:       meta.longName || meta.shortName || symbol,
      asset_type: typeMap[meta.instrumentType] || 'stock',
      sector,
      industry,
      logo_url:   `https://assets.parqet.com/logos/symbol/${symbol}`,
    })
  } catch (err) {
    console.error('ticker-info error:', err.message)
    res.status(404).json({ error: 'Ticker not found' })
  }
})

// Ensure auto_price_disabled column exists (runs once at startup)
;(async () => {
  try {
    await query(`ALTER TABLE investments ADD auto_price_disabled BIT NOT NULL DEFAULT 0`)
  } catch { /* column already exists */ }
})()

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
    const { symbol, name, asset_type, quantity, purchase_price, currency, broker, account_name, is_crypto_tracker, purchase_date } = req.body
    const sym = symbol.toUpperCase()
    const params = {
      userId: req.user.id,
      symbol: sym,
      name: name || sym,
      asset_type: asset_type || 'stock',
      quantity, purchase_price,
      currency: currency || 'USD',
      broker: broker || null,
      account_name: account_name || null,
      is_crypto_tracker: is_crypto_tracker || false,
      purchase_date: purchase_date || null,
    }

    let row
    try {
      const r = await query(`
        INSERT INTO investments (user_id, symbol, name, asset_type, quantity, purchase_price, currency, broker, account_name, is_crypto_tracker, purchase_date)
        OUTPUT INSERTED.*
        VALUES (@userId, @symbol, @name, @asset_type, @quantity, @purchase_price, @currency, @broker, @account_name, @is_crypto_tracker, @purchase_date)
      `, params)
      row = r.recordset[0]
    } catch (colErr) {
      // Fallback if purchase_date column doesn't exist yet
      if (colErr.message?.includes('purchase_date')) {
        const r = await query(`
          INSERT INTO investments (user_id, symbol, name, asset_type, quantity, purchase_price, currency, broker, account_name, is_crypto_tracker)
          OUTPUT INSERTED.*
          VALUES (@userId, @symbol, @name, @asset_type, @quantity, @purchase_price, @currency, @broker, @account_name, @is_crypto_tracker)
        `, params)
        row = r.recordset[0]
      } else throw colErr
    }

    // Auto-fetch current price immediately after insert
    try {
      const { fetchStockPrice } = require('../services/priceService')
      const price = await fetchStockPrice(sym)
      if (price) {
        await query('UPDATE investments SET current_price = @price, updated_at = GETUTCDATE() WHERE id = @id', { price, id: row.id })
        row.current_price = price
      }
    } catch {}

    res.status(201).json(row)
  } catch (err) { next(err) }
})

router.put('/:id', async (req, res, next) => {
  try {
    const { symbol, quantity, purchase_price, current_price, broker, account_name, name, asset_type, purchase_date, auto_price_disabled } = req.body
    const sym = symbol ? symbol.toUpperCase() : null
    const autoDisabled = auto_price_disabled !== undefined ? (auto_price_disabled ? 1 : 0) : null
    let result
    try {
      result = await query(`
        UPDATE investments
        SET symbol         = ISNULL(@symbol, symbol),
            quantity       = ISNULL(@quantity, quantity),
            purchase_price = ISNULL(@purchase_price, purchase_price),
            current_price  = ISNULL(@current_price, current_price),
            name           = ISNULL(@name, name),
            asset_type     = ISNULL(@asset_type, asset_type),
            broker         = ISNULL(@broker, broker),
            account_name   = ISNULL(@account_name, account_name),
            auto_price_disabled = ISNULL(@autoDisabled, auto_price_disabled),
            purchase_date  = CASE WHEN @purchase_date IS NOT NULL THEN CAST(@purchase_date AS DATE) ELSE purchase_date END,
            updated_at     = GETUTCDATE()
        OUTPUT INSERTED.*
        WHERE id = @id AND user_id = @userId
      `, { id: req.params.id, userId: req.user.id, symbol: sym, quantity, purchase_price, current_price, name, asset_type, broker, account_name, autoDisabled, purchase_date: purchase_date || null })
    } catch (colErr) {
      if (colErr.message?.includes('auto_price_disabled') || colErr.message?.includes('purchase_date')) {
        result = await query(`
          UPDATE investments
          SET symbol = ISNULL(@symbol, symbol), quantity = ISNULL(@quantity, quantity),
              purchase_price = ISNULL(@purchase_price, purchase_price),
              current_price = ISNULL(@current_price, current_price), name = ISNULL(@name, name),
              asset_type = ISNULL(@asset_type, asset_type), broker = ISNULL(@broker, broker),
              updated_at = GETUTCDATE()
          OUTPUT INSERTED.*
          WHERE id = @id AND user_id = @userId
        `, { id: req.params.id, userId: req.user.id, symbol: sym, quantity, purchase_price, current_price, name, asset_type, broker })
      } else throw colErr
    }
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
