// server/routes/ai.js
const router = require('express').Router();
const crypto = require('crypto');
const axios = require('axios');
const { query } = require('../db/sql');
const { authenticate } = require('../middleware/auth');
const { saveMessage, getHistory, getUserSessions } = require('../db/cosmos');

const DEBT_TYPES = new Set(['debt', 'loan', 'credit_card', 'mortgage', 'overdraft']);

async function getFxRates() {
  try {
    const result = await query(`SELECT from_currency, rate FROM exchange_rates WHERE to_currency = 'USD'`);
    const rates = { USD: 1 };
    for (const row of result.recordset) rates[row.from_currency] = row.rate;
    if (!rates.ILS) rates.ILS = 0.27;
    if (!rates.EUR) rates.EUR = 1.08;
    if (!rates.GBP) rates.GBP = 1.27;
    return rates;
  } catch {
    return { USD: 1, ILS: 0.27, EUR: 1.08, GBP: 1.27 };
  }
}

async function aggregateFinancialData(userId) {
  const fx = await getFxRates();
  const ilsPerUsd = 1 / (fx.ILS || 0.27);

  const safeQuery = async (sql, params) => {
    try { return await query(sql, params); }
    catch { return { recordset: [] }; }
  };

  const [invResult, cryptoResult, reResult, cashResult, pensionResult, altResult, incomeResult, expenseResult] =
    await Promise.all([
      safeQuery(`SELECT symbol, name, asset_type, currency, quantity, purchase_price,
                   ISNULL(current_price, purchase_price) AS current_price
                 FROM investments WHERE user_id = @userId ORDER BY quantity * ISNULL(current_price, purchase_price) DESC`, { userId }),

      safeQuery(`SELECT symbol, name, quantity, purchase_price_usd,
                   ISNULL(current_price_usd, purchase_price_usd) AS current_price_usd
                 FROM crypto_assets WHERE user_id = @userId`, { userId }),

      safeQuery(`SELECT name, property_type, currency, purchase_price,
                   ISNULL(current_value, purchase_price) AS current_value,
                   monthly_income, monthly_expenses
                 FROM real_estate_properties WHERE user_id = @userId`, { userId }),

      safeQuery(`SELECT name, holding_type, currency, balance, interest_rate
                 FROM cash_holdings WHERE user_id = @userId`, { userId }),

      safeQuery(`SELECT name, current_value, employee_monthly, employer_monthly
                 FROM pension_assets WHERE user_id = @userId`, { userId }),

      safeQuery(`SELECT name, investment_type, currency,
                   ISNULL(amount_invested, 0) AS invested_amount,
                   ISNULL(current_value, amount_invested) AS current_value
                 FROM alternative_investments WHERE user_id = @userId`, { userId }),

      safeQuery(`SELECT name, amount, currency, frequency FROM income_sources WHERE user_id = @userId`, { userId }),

      safeQuery(`SELECT name, amount, currency, frequency FROM expense_goals WHERE user_id = @userId`, { userId }),
    ]);

  // --- Compute totals in ILS ---
  const ILS = (val, currency) => {
    const rate = fx[currency] || 1;
    const usdVal = val * rate;
    return usdVal * ilsPerUsd;
  };

  let investmentsIls = 0, investmentsCostIls = 0;
  for (const r of invResult.recordset) {
    investmentsIls += ILS(r.quantity * r.current_price, r.currency);
    investmentsCostIls += ILS(r.quantity * r.purchase_price, r.currency);
  }

  let cryptoUsd = 0, cryptoCostUsd = 0;
  for (const r of cryptoResult.recordset) {
    cryptoUsd += r.quantity * r.current_price_usd;
    cryptoCostUsd += r.quantity * r.purchase_price_usd;
  }
  const cryptoIls = cryptoUsd * ilsPerUsd;

  let realEstateIls = 0;
  for (const r of reResult.recordset) realEstateIls += ILS(r.current_value, r.currency);

  let cashIls = 0, debtIls = 0;
  for (const r of cashResult.recordset) {
    const val = ILS(r.balance, r.currency);
    if (DEBT_TYPES.has(r.holding_type)) debtIls += val;
    else cashIls += val;
  }

  let pensionIls = 0;
  for (const r of pensionResult.recordset) pensionIls += (r.current_value || 0);

  let altIls = 0;
  for (const r of altResult.recordset) altIls += ILS(r.current_value, r.currency);

  const totalAssetsIls = investmentsIls + cryptoIls + realEstateIls + cashIls + pensionIls + altIls;
  const netWorthIls = totalAssetsIls - debtIls;
  const totalAssetsUsd = totalAssetsIls * (fx.ILS || 0.27);
  const netWorthUsd = netWorthIls * (fx.ILS || 0.27);

  const dist = (v) => totalAssetsIls > 0 ? ((v / totalAssetsIls) * 100).toFixed(1) : '0.0';

  const fmt = (v) => Math.round(v).toLocaleString('en-IL');
  const fmtSign = (v) => (v >= 0 ? '+' : '') + fmt(v);
  const pct = (gain, cost) => cost > 0 ? ((gain / cost) * 100).toFixed(1) : '0.0';

  // Monthly cashflow
  let incomeMonthly = 0;
  for (const r of incomeResult.recordset) {
    const multiplier = r.frequency === 'annual' ? 1/12 : r.frequency === 'weekly' ? 4.33 : 1;
    incomeMonthly += ILS((r.amount || 0) * multiplier, r.currency || 'ILS');
  }
  // Add rental income
  for (const r of reResult.recordset) {
    incomeMonthly += ILS((r.monthly_income || 0) - (r.monthly_expenses || 0), r.currency);
  }
  let expenseMonthly = 0;
  for (const r of expenseResult.recordset) {
    const multiplier = r.frequency === 'annual' ? 1/12 : r.frequency === 'weekly' ? 4.33 : 1;
    expenseMonthly += ILS((r.amount || 0) * multiplier, r.currency || 'ILS');
  }

  // Build snapshot text
  const lines = [];

  lines.push('PORTFOLIO SUMMARY');
  lines.push(`Net Worth: ₪${fmt(netWorthIls)} ($${fmt(netWorthUsd)} USD) | Total Assets: ₪${fmt(totalAssetsIls)} | Total Debt: ₪${fmt(debtIls)}`);
  lines.push(`Distribution: Investments ${dist(investmentsIls)}% | Real Estate ${dist(realEstateIls)}% | Crypto ${dist(cryptoIls)}% | Cash ${dist(cashIls)}% | Pension ${dist(pensionIls)}% | Alternative ${dist(altIls)}%`);

  lines.push('');
  const topInv = invResult.recordset.slice(0, 20);
  lines.push(`INVESTMENTS (${invResult.recordset.length} positions, top ${topInv.length} by value)`);
  if (topInv.length === 0) {
    lines.push('  (none)');
  } else {
    for (const r of topInv) {
      const val = r.quantity * r.current_price;
      const gain = r.quantity * (r.current_price - r.purchase_price);
      lines.push(`- ${r.symbol} | ${r.asset_type} | ${r.quantity} shares | Avg ₪${fmt(r.purchase_price)} | Current ₪${fmt(r.current_price)} | Value ₪${fmt(val)} | P&L ${fmtSign(gain)} (${pct(gain, r.quantity * r.purchase_price)}%)`);
    }
  }

  lines.push('');
  lines.push(`CRYPTO (${cryptoResult.recordset.length} holdings)`);
  if (cryptoResult.recordset.length === 0) {
    lines.push('  (none)');
  } else {
    for (const r of cryptoResult.recordset) {
      const val = r.quantity * r.current_price_usd;
      const gain = r.quantity * (r.current_price_usd - r.purchase_price_usd);
      lines.push(`- ${r.symbol} | ${r.quantity} coins | Avg $${fmt(r.purchase_price_usd)} | Current $${fmt(r.current_price_usd)} | Value $${fmt(val)} | P&L ${fmtSign(gain)} (${pct(gain, r.quantity * r.purchase_price_usd)}%)`);
    }
  }

  lines.push('');
  lines.push(`REAL ESTATE (${reResult.recordset.length} properties)`);
  if (reResult.recordset.length === 0) {
    lines.push('  (none)');
  } else {
    for (const r of reResult.recordset) {
      const netRental = (r.monthly_income || 0) - (r.monthly_expenses || 0);
      lines.push(`- "${r.name}" | ${r.property_type} | Purchase ₪${fmt(r.purchase_price)} | Current ₪${fmt(r.current_value)} | Net Rental ₪${fmt(netRental)}/mo`);
    }
  }

  lines.push('');
  lines.push('CASH & DEBT');
  const cashAssets = cashResult.recordset.filter(r => !DEBT_TYPES.has(r.holding_type));
  const cashDebts = cashResult.recordset.filter(r => DEBT_TYPES.has(r.holding_type));
  if (cashAssets.length === 0 && cashDebts.length === 0) {
    lines.push('  (none)');
  } else {
    for (const r of cashAssets) lines.push(`  Assets: "${r.name}" | ${r.holding_type} | ₪${fmt(r.balance)} | ${r.interest_rate || 0}%`);
    for (const r of cashDebts) lines.push(`  Debts:  "${r.name}" | ${r.holding_type} | ₪${fmt(r.balance)} | ${r.interest_rate || 0}%`);
  }

  lines.push('');
  lines.push(`PENSION (${pensionResult.recordset.length} funds)`);
  if (pensionResult.recordset.length === 0) {
    lines.push('  (none)');
  } else {
    for (const r of pensionResult.recordset) {
      lines.push(`- "${r.name}" | Current ₪${fmt(r.current_value)} | Employee ₪${fmt(r.employee_monthly || 0)}/mo | Employer ₪${fmt(r.employer_monthly || 0)}/mo`);
    }
  }

  lines.push('');
  lines.push(`ALTERNATIVE INVESTMENTS (${altResult.recordset.length} positions)`);
  if (altResult.recordset.length === 0) {
    lines.push('  (none)');
  } else {
    for (const r of altResult.recordset) {
      lines.push(`- "${r.name}" | ${r.investment_type} | Invested ₪${fmt(r.invested_amount)} | Current ₪${fmt(r.current_value)}`);
    }
  }

  lines.push('');
  lines.push('CASH FLOW (Monthly)');
  lines.push(`Income ₪${fmt(incomeMonthly)}/mo | Expenses ₪${fmt(expenseMonthly)}/mo | Net ₪${fmt(incomeMonthly - expenseMonthly)}/mo`);

  return lines.join('\n');
}

function buildSystemPrompt(snapshot) {
  const today = new Date().toISOString().split('T')[0];
  return `You are Ari, a personal AI financial advisor built into PlentyRise for Israeli users.
TODAY'S DATE: ${today}
You have access to the user's full live financial snapshot below.

--- USER FINANCIAL SNAPSHOT ---
${snapshot}
--- END SNAPSHOT ---

Advisory areas: net worth optimization, debt reduction (by interest rate priority),
investment diversification, cash flow improvement, emergency fund (3–6 months),
pension optimization (Kupat Gemel, Keren Hishtalmut tax-free after 6 yrs, Bituah Menahalim),
Israeli tax context (25% capital gains, Keren Hishtalmut benefits), real estate yield,
crypto risk management, long-term wealth building.

Rules:
- Respond in the same language the user writes (Hebrew or English)
- Use ₪ (ILS) as primary currency, USD in parentheses where helpful
- Be warm, direct, actionable — tied to the user's actual numbers
- Never guarantee future returns; never recommend specific named products/funds
- Keep responses to 3–5 paragraphs unless more detail is requested
- Flag missing data gaps proactively (no emergency fund, no pension, etc.)
- Remind user once per session you are an AI, not a licensed financial advisor`;
}

// POST /api/v1/ai/chat
router.post('/chat', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Consent check
    const consentResult = await query(
      'SELECT ai_data_access FROM users WHERE id = @id',
      { id: userId }
    );
    if (!consentResult.recordset[0]?.ai_data_access) {
      return res.status(403).json({ error: 'consent_required' });
    }

    const { message, sessionId: incomingSessionId } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'message is required' });
    }

    const sessionId = incomingSessionId || crypto.randomUUID();

    const [snapshot, history] = await Promise.all([
      aggregateFinancialData(userId),
      getHistory(userId, sessionId, 10),
    ]);

    const systemPrompt = buildSystemPrompt(snapshot);

    // Build messages array from history + new message
    const historyMessages = history.map(h => ({ role: h.role, content: h.content }));
    const messages = [...historyMessages, { role: 'user', content: message }];

    const claudeRes = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      },
      {
        headers: {
          'x-api-key': process.env.CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const reply = claudeRes.data.content[0].text;
    const usage = claudeRes.data.usage;

    // Save both turns
    await saveMessage(userId, sessionId, 'user', message);
    await saveMessage(userId, sessionId, 'assistant', reply);

    res.json({ reply, sessionId, usage });
  } catch (err) {
    console.error('[AI /chat error]', {
      message: err.message,
      status: err.response?.status,
      data: JSON.stringify(err.response?.data),
      stack: err.stack?.split('\n').slice(0,5).join(' | ')
    });
    if (err.response?.status) {
      return next(Object.assign(new Error('Claude API error: ' + (err.response.data?.error?.message || err.message)), { status: 502 }));
    }
    next(err);
  }
});

// GET /api/v1/ai/sessions
router.get('/sessions', authenticate, async (req, res, next) => {
  try {
    const sessions = await getUserSessions(req.user.id);
    res.json(sessions);
  } catch (err) { next(err); }
});

// GET /api/v1/ai/history/:sessionId
router.get('/history/:sessionId', authenticate, async (req, res, next) => {
  try {
    const history = await getHistory(req.user.id, req.params.sessionId, 50);
    res.json(history);
  } catch (err) { next(err); }
});

module.exports = router;
