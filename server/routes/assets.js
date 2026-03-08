// server/routes/assets.js
const router = require('express').Router();
const { query } = require('../db/sql');
const { authenticate } = require('../middleware/auth');

// Helper: get USD conversion rates from exchange_rates table, with hardcoded fallbacks
async function getFxRates() {
  try {
    const result = await query(`
      SELECT from_currency, rate FROM exchange_rates WHERE to_currency = 'USD'
    `);
    const rates = { USD: 1 };
    for (const row of result.recordset) {
      rates[row.from_currency] = row.rate;
    }
    // Hardcoded fallbacks if not in DB
    if (!rates.ILS) rates.ILS = 0.27;
    if (!rates.EUR) rates.EUR = 1.08;
    if (!rates.GBP) rates.GBP = 1.27;
    return rates;
  } catch {
    return { USD: 1, ILS: 0.27, EUR: 1.08, GBP: 1.27 };
  }
}

// GET /api/v1/assets/summary
router.get('/summary', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const fx = await getFxRates();

    // Run all aggregation queries in parallel
    const [invResult, cryptoResult, reResult, cashResult, pensionResult, moversResult, recentResult] = await Promise.all([
      // Investments: sum by currency
      query(`
        SELECT currency,
          SUM(quantity * ISNULL(current_price, purchase_price)) AS current_val,
          SUM(quantity * purchase_price) AS cost_basis,
          SUM(CASE WHEN current_price IS NOT NULL AND previous_day_price IS NOT NULL
                   THEN (current_price - previous_day_price) * quantity ELSE 0 END) AS daily_pnl
        FROM investments
        WHERE user_id = @userId
        GROUP BY currency
      `, { userId }),

      // Crypto: always USD
      query(`
        SELECT
          SUM(quantity * ISNULL(current_price_usd, purchase_price_usd)) AS current_val,
          SUM(quantity * purchase_price_usd) AS cost_basis,
          SUM(CASE WHEN current_price_usd IS NOT NULL AND previous_day_price_usd IS NOT NULL
                   THEN (current_price_usd - previous_day_price_usd) * quantity ELSE 0 END) AS daily_pnl
        FROM crypto_assets
        WHERE user_id = @userId
      `, { userId }),

      // Real estate: sum current_value by currency (use purchase_price if no current_value)
      query(`
        SELECT currency,
          SUM(ISNULL(current_value, purchase_price)) AS value
        FROM real_estate_properties
        WHERE user_id = @userId
        GROUP BY currency
      `, { userId }),

      // Cash: separate assets vs debt by holding_type
      query(`
        SELECT currency, holding_type,
          SUM(balance) AS balance
        FROM cash_holdings
        WHERE user_id = @userId
        GROUP BY currency, holding_type
      `, { userId }),

      // Pension: current_value in ILS
      query(`
        SELECT SUM(current_value) AS total FROM pension_assets WHERE user_id = @userId
      `, { userId }),

      // Top movers
      query(`
        SELECT TOP 5
          symbol, name, asset_type,
          current_price, previous_day_price,
          ((current_price - previous_day_price) / NULLIF(previous_day_price, 0)) * 100 AS daily_change_pct
        FROM investments
        WHERE user_id = @userId
          AND current_price IS NOT NULL
          AND previous_day_price IS NOT NULL
          AND previous_day_price > 0
        ORDER BY ABS(((current_price - previous_day_price) / previous_day_price) * 100) DESC
      `, { userId }),

      // Recent activity
      query(`
        SELECT TOP 10 type, name, identifier, created_at FROM (
          SELECT 'investment' AS type, name, symbol AS identifier, created_at FROM investments WHERE user_id = @userId
          UNION ALL
          SELECT 'crypto' AS type, name, symbol AS identifier, created_at FROM crypto_assets WHERE user_id = @userId
          UNION ALL
          SELECT 'real_estate' AS type, name, '' AS identifier, created_at FROM real_estate_properties WHERE user_id = @userId
        ) combined
        ORDER BY created_at DESC
      `, { userId }),
    ]);

    // Aggregate investments (convert to USD)
    const DEBT_TYPES = new Set(['debt', 'loan', 'credit_card', 'mortgage', 'overdraft']);

    let investmentsUsd = 0, investmentsCost = 0, investmentsDailyPnl = 0;
    for (const row of invResult.recordset) {
      const rate = fx[row.currency] || 1;
      investmentsUsd += (row.current_val || 0) * rate;
      investmentsCost += (row.cost_basis || 0) * rate;
      investmentsDailyPnl += (row.daily_pnl || 0) * rate;
    }

    // Crypto (already USD)
    const cryptoRow = cryptoResult.recordset[0] || {};
    const cryptoUsd = cryptoRow.current_val || 0;
    const cryptoCost = cryptoRow.cost_basis || 0;
    const cryptoDailyPnl = cryptoRow.daily_pnl || 0;

    // Real estate (convert to USD)
    let realEstateUsd = 0;
    for (const row of reResult.recordset) {
      const rate = fx[row.currency] || 1;
      realEstateUsd += (row.value || 0) * rate;
    }

    // Cash & Debt (convert to USD)
    let cashUsd = 0, debtUsd = 0;
    for (const row of cashResult.recordset) {
      const rate = fx[row.currency] || 1;
      const valUsd = (row.balance || 0) * rate;
      if (DEBT_TYPES.has(row.holding_type)) {
        debtUsd += valUsd;
      } else {
        cashUsd += valUsd;
      }
    }

    // Pension (ILS → USD)
    const pensionIls = pensionResult.recordset[0]?.total || 0;
    const pensionUsd = pensionIls * (fx.ILS || 0.27);

    // Totals
    const totalAssetsUsd = investmentsUsd + cryptoUsd + realEstateUsd + cashUsd + pensionUsd;
    const netWorthUsd = totalAssetsUsd - debtUsd;
    const historicalPnl = (investmentsUsd - investmentsCost) + (cryptoUsd - cryptoCost);
    const historicalPnlPct = (investmentsCost + cryptoCost) > 0
      ? (historicalPnl / (investmentsCost + cryptoCost)) * 100
      : 0;
    const dailyPnl = investmentsDailyPnl + cryptoDailyPnl;

    res.json({
      net_worth_usd: netWorthUsd,
      total_assets_usd: totalAssetsUsd,
      total_debt_usd: debtUsd,
      distribution: {
        real_estate: realEstateUsd,
        investments: investmentsUsd,
        crypto: cryptoUsd,
        cash: cashUsd,
        pension: pensionUsd,
        debt: debtUsd,
      },
      pnl: {
        historical: historicalPnl,
        historical_pct: historicalPnlPct,
        daily: dailyPnl,
      },
      top_movers: moversResult.recordset,
      recent_activity: recentResult.recordset,
    });
  } catch (err) { next(err); }
});

// POST /api/v1/assets/refresh-prices
router.post('/refresh-prices', authenticate, async (req, res, next) => {
  try {
    const { refreshAllPrices } = require('../services/priceService');
    await refreshAllPrices();
    res.json({ success: true, message: 'Prices refreshed' });
  } catch (err) { next(err); }
});

module.exports = router;
