// server/routes/assets.js
const router = require('express').Router();
const { query } = require('../db/sql');
const { authenticate } = require('../middleware/auth');

// GET /api/v1/assets/summary
// Returns full portfolio summary for dashboard
router.get('/summary', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get totals from view
    const summaryResult = await query(
      'SELECT * FROM vw_portfolio_summary WHERE user_id = @userId',
      { userId }
    );
    const summary = summaryResult.recordset[0] || {};

    const totalAssets =
      (summary.real_estate_value_usd || 0) +
      (summary.investments_value_usd || 0) +
      (summary.crypto_value_usd || 0) +
      (summary.cash_value_usd || 0) +
      (summary.pension_value_usd || 0);

    const netWorth = totalAssets - (summary.debt_value_usd || 0);

    // Historical P&L: current vs purchase cost
    const plResult = await query(`
      SELECT
        SUM(i.quantity * i.current_price * ISNULL(fx.rate,1)) AS current_val,
        SUM(i.quantity * i.purchase_price * ISNULL(fx.rate,1)) AS cost_basis
      FROM investments i
      LEFT JOIN exchange_rates fx ON fx.from_currency = i.currency AND fx.to_currency = 'USD'
      WHERE i.user_id = @userId AND i.current_price IS NOT NULL
    `, { userId });

    const cryptoPLResult = await query(`
      SELECT
        SUM(quantity * current_price_usd) AS current_val,
        SUM(quantity * purchase_price_usd) AS cost_basis
      FROM crypto_assets
      WHERE user_id = @userId AND current_price_usd IS NOT NULL
    `, { userId });

    const investPL = plResult.recordset[0];
    const cryptoPL = cryptoPLResult.recordset[0];

    const totalCurrent = (investPL?.current_val || 0) + (cryptoPL?.current_val || 0);
    const totalCost = (investPL?.cost_basis || 0) + (cryptoPL?.cost_basis || 0);
    const historicalPnl = totalCurrent - totalCost;
    const historicalPnlPct = totalCost > 0 ? (historicalPnl / totalCost) * 100 : 0;

    // Daily P&L
    const dailyResult = await query(`
      SELECT
        SUM((i.current_price - i.previous_day_price) * i.quantity * ISNULL(fx.rate,1)) AS daily_pnl
      FROM investments i
      LEFT JOIN exchange_rates fx ON fx.from_currency = i.currency AND fx.to_currency = 'USD'
      WHERE i.user_id = @userId
        AND i.current_price IS NOT NULL
        AND i.previous_day_price IS NOT NULL
    `, { userId });

    const cryptoDailyResult = await query(`
      SELECT SUM((current_price_usd - previous_day_price_usd) * quantity) AS daily_pnl
      FROM crypto_assets
      WHERE user_id = @userId
        AND current_price_usd IS NOT NULL
        AND previous_day_price_usd IS NOT NULL
    `, { userId });

    const dailyPnl =
      (dailyResult.recordset[0]?.daily_pnl || 0) +
      (cryptoDailyResult.recordset[0]?.daily_pnl || 0);

    // Top daily movers (investments)
    const moversResult = await query(`
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
    `, { userId });

    // Recent additions
    const recentResult = await query(`
      SELECT TOP 5 'investment' AS type, name, symbol AS identifier, created_at FROM investments WHERE user_id = @userId
      UNION ALL
      SELECT TOP 5 'crypto' AS type, name, symbol AS identifier, created_at FROM crypto_assets WHERE user_id = @userId
      UNION ALL
      SELECT TOP 5 'real_estate' AS type, name, '' AS identifier, created_at FROM real_estate_properties WHERE user_id = @userId
      ORDER BY created_at DESC
    `, { userId });

    res.json({
      net_worth_usd: netWorth,
      total_assets_usd: totalAssets,
      total_debt_usd: summary.debt_value_usd || 0,
      distribution: {
        real_estate: summary.real_estate_value_usd || 0,
        investments: summary.investments_value_usd || 0,
        crypto: summary.crypto_value_usd || 0,
        cash: summary.cash_value_usd || 0,
        pension: summary.pension_value_usd || 0,
        debt: summary.debt_value_usd || 0,
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

module.exports = router;
