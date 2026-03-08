const router = require('express').Router()
const axios  = require('axios')
const { authenticate } = require('../middleware/auth')

// GET /api/v1/settings/exchange-rates
// Returns live exchange rates for key currency pairs
router.get('/exchange-rates', authenticate, async (req, res, next) => {
  try {
    const { data } = await axios.get(
      'https://open.er-api.com/v6/latest/USD',
      { timeout: 8000 }
    )

    if (data.result !== 'success') {
      return res.status(502).json({ error: 'Exchange rate service unavailable' })
    }

    const r = data.rates
    const pairs = [
      { from: 'USD', to: 'ILS', rate: r.ILS },
      { from: 'USD', to: 'EUR', rate: r.EUR },
      { from: 'USD', to: 'GBP', rate: r.GBP },
      { from: 'EUR', to: 'USD', rate: r.USD / r.EUR },
      { from: 'EUR', to: 'ILS', rate: r.ILS / r.EUR },
      { from: 'GBP', to: 'USD', rate: r.USD / r.GBP },
      { from: 'GBP', to: 'ILS', rate: r.ILS / r.GBP },
      { from: 'ILS', to: 'USD', rate: r.USD / r.ILS },
    ]

    res.json({
      base:        'USD',
      updated_at:  data.time_last_update_utc,
      pairs:       pairs.map(p => ({ ...p, rate: parseFloat(p.rate.toFixed(4)) })),
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router
