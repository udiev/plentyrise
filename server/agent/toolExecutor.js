/**
 * Tool Executor — implements each agent tool by querying the DB and external APIs.
 * Gracefully degrades when external APIs are unavailable.
 */
const axios = require('axios');
const { query } = require('../db/sql');
const { fetchStockPrice, fetchCryptoPrices } = require('../services/priceService');

const DEBT_TYPES = new Set(['debt', 'loan', 'credit_card', 'mortgage', 'overdraft']);

const CRYPTO_ID_MAP = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin',
  ADA: 'cardano', XRP: 'ripple', DOGE: 'dogecoin', DOT: 'polkadot',
  MATIC: 'matic-network', AVAX: 'avalanche-2', LINK: 'chainlink',
  UNI: 'uniswap', ATOM: 'cosmos', LTC: 'litecoin', BCH: 'bitcoin-cash',
};

// Sector mapping heuristics for common tickers
const SECTOR_MAP = {
  AAPL: 'Technology', MSFT: 'Technology', GOOGL: 'Technology', AMZN: 'Consumer Cyclical',
  NVDA: 'Technology', META: 'Technology', TSLA: 'Consumer Cyclical', NFLX: 'Technology',
  JPM: 'Financial', BAC: 'Financial', GS: 'Financial', V: 'Financial', MA: 'Financial',
  JNJ: 'Healthcare', PFE: 'Healthcare', UNH: 'Healthcare', ABBV: 'Healthcare',
  XOM: 'Energy', CVX: 'Energy', COP: 'Energy',
  SPY: 'ETF-Broad', QQQ: 'ETF-Tech', IWM: 'ETF-Small', GLD: 'Commodity',
};

async function safeQuery(sql, params) {
  try { return await query(sql, params); }
  catch { return { recordset: [] }; }
}

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

/**
 * Fetch all user assets across all modules.
 */
async function getFullPortfolio(userId) {
  const fx = await getFxRates();
  const ilsPerUsd = 1 / (fx.ILS || 0.27);
  const toIls = (val, currency) => val * (fx[currency] || 1) * ilsPerUsd;

  const [invRes, cryptoRes, reRes, cashRes, pensionRes, altRes] = await Promise.all([
    safeQuery(`SELECT symbol, name, asset_type, sector, currency, quantity,
                 purchase_price, ISNULL(current_price, purchase_price) AS current_price
               FROM investments WHERE user_id = @userId`, { userId }),
    safeQuery(`SELECT symbol, name, coin_id, quantity, purchase_price_usd,
                 ISNULL(current_price_usd, purchase_price_usd) AS current_price_usd
               FROM crypto_assets WHERE user_id = @userId`, { userId }),
    safeQuery(`SELECT name, property_type, currency, purchase_price,
                 ISNULL(current_value, purchase_price) AS current_value,
                 monthly_income, monthly_expenses
               FROM real_estate_properties WHERE user_id = @userId`, { userId }),
    safeQuery(`SELECT name, holding_type, currency, balance, interest_rate
               FROM cash_holdings WHERE user_id = @userId`, { userId }),
    safeQuery(`SELECT name, pension_type, current_value, employee_monthly, employer_monthly, track
               FROM pension_assets WHERE user_id = @userId`, { userId }),
    safeQuery(`SELECT name, investment_type, currency,
                 ISNULL(amount_invested, 0) AS amount_invested,
                 ISNULL(current_value, amount_invested) AS current_value
               FROM alternative_investments WHERE user_id = @userId`, { userId }),
  ]);

  let investmentsIls = 0, cryptoIls = 0, realEstateIls = 0;
  let cashIls = 0, debtIls = 0, pensionIls = 0, altIls = 0;

  const investments = invRes.recordset.map(r => {
    const value = toIls(r.quantity * r.current_price, r.currency);
    const cost = toIls(r.quantity * r.purchase_price, r.currency);
    investmentsIls += value;
    return { ...r, value_ils: Math.round(value), cost_ils: Math.round(cost), pnl_ils: Math.round(value - cost) };
  });

  const cryptos = cryptoRes.recordset.map(r => {
    const value = r.quantity * r.current_price_usd * ilsPerUsd;
    cryptoIls += value;
    return { ...r, value_ils: Math.round(value), value_usd: Math.round(r.quantity * r.current_price_usd) };
  });

  const realEstate = reRes.recordset.map(r => {
    const value = toIls(r.current_value, r.currency);
    realEstateIls += value;
    return { ...r, value_ils: Math.round(value) };
  });

  const cashHoldings = [], debts = [];
  for (const r of cashRes.recordset) {
    const val = toIls(r.balance, r.currency);
    if (DEBT_TYPES.has(r.holding_type)) { debtIls += val; debts.push({ ...r, value_ils: Math.round(val) }); }
    else { cashIls += val; cashHoldings.push({ ...r, value_ils: Math.round(val) }); }
  }

  const pension = pensionRes.recordset.map(r => {
    pensionIls += (r.current_value || 0);
    return r;
  });

  const alternatives = altRes.recordset.map(r => {
    const value = toIls(r.current_value, r.currency);
    altIls += value;
    return { ...r, value_ils: Math.round(value) };
  });

  const totalAssetsIls = investmentsIls + cryptoIls + realEstateIls + cashIls + pensionIls + altIls;
  const netWorthIls = totalAssetsIls - debtIls;
  const ilsRate = fx.ILS || 0.27;

  return {
    summary: {
      net_worth_ils: Math.round(netWorthIls),
      net_worth_usd: Math.round(netWorthIls * ilsRate),
      total_assets_ils: Math.round(totalAssetsIls),
      total_debt_ils: Math.round(debtIls),
      breakdown_ils: {
        investments: Math.round(investmentsIls),
        crypto: Math.round(cryptoIls),
        real_estate: Math.round(realEstateIls),
        cash: Math.round(cashIls),
        pension: Math.round(pensionIls),
        alternative: Math.round(altIls),
      },
    },
    investments,
    cryptos,
    real_estate: realEstate,
    cash: cashHoldings,
    debts,
    pension,
    alternatives,
  };
}

/**
 * Compute allocation percentages by category, sector, currency.
 */
async function getAssetAllocation(userId) {
  const portfolio = await getFullPortfolio(userId);
  const total = portfolio.summary.total_assets_ils;
  if (total === 0) return { error: 'No assets found' };

  const pct = v => total > 0 ? parseFloat(((v / total) * 100).toFixed(1)) : 0;
  const { breakdown_ils } = portfolio.summary;

  // Sector breakdown from investments
  const sectorMap = {};
  for (const inv of portfolio.investments) {
    const sector = inv.sector || SECTOR_MAP[inv.symbol] || 'Other';
    sectorMap[sector] = (sectorMap[sector] || 0) + inv.value_ils;
  }
  // Crypto as its own sector
  if (portfolio.summary.breakdown_ils.crypto > 0) sectorMap['Crypto'] = (sectorMap['Crypto'] || 0) + breakdown_ils.crypto;

  // Currency exposure
  const currencyMap = {};
  for (const inv of portfolio.investments) {
    currencyMap[inv.currency || 'ILS'] = (currencyMap[inv.currency || 'ILS'] || 0) + inv.value_ils;
  }
  for (const re of portfolio.real_estate) {
    currencyMap[re.currency || 'ILS'] = (currencyMap[re.currency || 'ILS'] || 0) + re.value_ils;
  }
  currencyMap['USD'] = (currencyMap['USD'] || 0) + (portfolio.summary.breakdown_ils.crypto || 0);

  const categoryAllocation = {
    investments: pct(breakdown_ils.investments),
    crypto: pct(breakdown_ils.crypto),
    real_estate: pct(breakdown_ils.real_estate),
    cash: pct(breakdown_ils.cash),
    pension: pct(breakdown_ils.pension),
    alternative: pct(breakdown_ils.alternative),
  };

  const sectorAllocation = {};
  for (const [k, v] of Object.entries(sectorMap)) sectorAllocation[k] = pct(v);

  const currencyExposure = {};
  for (const [k, v] of Object.entries(currencyMap)) currencyExposure[k] = pct(v);

  // Identify concentration risks
  const warnings = [];
  for (const [sector, pctVal] of Object.entries(sectorAllocation)) {
    if (pctVal > 35) warnings.push(`Sector concentration: ${sector} at ${pctVal}% (limit: 35%)`);
  }
  for (const inv of portfolio.investments) {
    const assetPct = pct(inv.value_ils);
    if (assetPct > 20) warnings.push(`Single asset concentration: ${inv.symbol} at ${assetPct}% (limit: 20%)`);
  }

  return { category: categoryAllocation, sector: sectorAllocation, currency: currencyExposure, concentration_warnings: warnings };
}

/**
 * Fetch stock quote data including MA50/MA200 and RSI from Yahoo Finance.
 */
async function getStockData(symbol) {
  try {
    const [quoteRes, histRes] = await Promise.all([
      axios.get(`https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
        timeout: 10000,
      }),
      axios.get(`https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1y`, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
        timeout: 15000,
      }),
    ]);

    const meta = quoteRes.data?.chart?.result?.[0]?.meta || {};
    const histData = histRes.data?.chart?.result?.[0];
    const closes = histData?.indicators?.quote?.[0]?.close?.filter(v => v != null) || [];

    let ma50 = null, ma200 = null, rsi = null;
    if (closes.length >= 50) ma50 = parseFloat((closes.slice(-50).reduce((a, b) => a + b, 0) / 50).toFixed(2));
    if (closes.length >= 200) ma200 = parseFloat((closes.slice(-200).reduce((a, b) => a + b, 0) / 200).toFixed(2));

    // RSI-14
    if (closes.length >= 15) {
      const gains = [], losses = [];
      for (let i = closes.length - 14; i < closes.length; i++) {
        const diff = closes[i] - closes[i - 1];
        if (diff > 0) gains.push(diff); else losses.push(Math.abs(diff));
      }
      const avgGain = gains.reduce((a, b) => a + b, 0) / 14;
      const avgLoss = losses.reduce((a, b) => a + b, 0) / 14;
      rsi = avgLoss === 0 ? 100 : parseFloat((100 - 100 / (1 + avgGain / avgLoss)).toFixed(1));
    }

    const isAgorot = symbol.endsWith('.TA');
    const rawPrice = meta.regularMarketPrice || 0;
    const price = isAgorot ? rawPrice / 100 : rawPrice;

    return {
      symbol,
      price,
      currency: meta.currency || 'USD',
      daily_change_pct: meta.regularMarketChangePercent?.toFixed(2) || null,
      volume: meta.regularMarketVolume || null,
      ma50,
      ma200,
      rsi,
      fifty_two_week_high: isAgorot ? (meta.fiftyTwoWeekHigh || 0) / 100 : meta.fiftyTwoWeekHigh || null,
      fifty_two_week_low: isAgorot ? (meta.fiftyTwoWeekLow || 0) / 100 : meta.fiftyTwoWeekLow || null,
    };
  } catch (err) {
    console.error(`[agent:getStockData] ${symbol}:`, err.message);
    return { symbol, error: 'Failed to fetch stock data', details: err.message };
  }
}

/**
 * Fetch crypto data from CoinGecko.
 */
async function getCryptoData(symbol) {
  try {
    const coinId = CRYPTO_ID_MAP[symbol.toUpperCase()] || symbol.toLowerCase();
    const { data } = await axios.get(
      `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`,
      { timeout: 10000 }
    );
    return {
      symbol: symbol.toUpperCase(),
      coin_id: coinId,
      name: data.name,
      price_usd: data.market_data?.current_price?.usd,
      market_cap_usd: data.market_data?.market_cap?.usd,
      change_24h_pct: data.market_data?.price_change_percentage_24h?.toFixed(2),
      change_7d_pct: data.market_data?.price_change_percentage_7d?.toFixed(2),
      all_time_high_usd: data.market_data?.ath?.usd,
      ath_change_pct: data.market_data?.ath_change_percentage?.usd?.toFixed(1),
      dominance: data.market_cap_rank,
    };
  } catch (err) {
    console.error(`[agent:getCryptoData] ${symbol}:`, err.message);
    return { symbol, error: 'Failed to fetch crypto data', details: err.message };
  }
}

/**
 * Real estate summary from DB.
 */
async function getRealEstateSummary(userId) {
  const res = await safeQuery(
    `SELECT name, property_type, currency, purchase_price,
       ISNULL(current_value, purchase_price) AS current_value,
       monthly_income, monthly_expenses
     FROM real_estate_properties WHERE user_id = @userId`, { userId }
  );

  const properties = res.recordset;
  if (!properties.length) return { count: 0, properties: [], summary: 'No real estate assets' };

  let totalPurchase = 0, totalCurrent = 0, totalNetRental = 0;
  const detailed = properties.map(p => {
    const netRental = (p.monthly_income || 0) - (p.monthly_expenses || 0);
    totalPurchase += p.purchase_price || 0;
    totalCurrent += p.current_value || 0;
    totalNetRental += netRental;
    const annualRentalYield = totalCurrent > 0 ? ((netRental * 12 / p.current_value) * 100).toFixed(2) : 0;
    return { ...p, net_rental_monthly: netRental, annual_yield_pct: annualRentalYield };
  });

  const totalAppreciation = totalPurchase > 0 ? (((totalCurrent - totalPurchase) / totalPurchase) * 100).toFixed(1) : 0;
  const portfolioYield = totalCurrent > 0 ? ((totalNetRental * 12 / totalCurrent) * 100).toFixed(2) : 0;

  return {
    count: properties.length,
    total_purchase_value: Math.round(totalPurchase),
    total_current_value: Math.round(totalCurrent),
    total_appreciation_pct: totalAppreciation,
    total_net_rental_monthly: Math.round(totalNetRental),
    portfolio_yield_pct: portfolioYield,
    properties: detailed,
  };
}

/**
 * Pension summary from DB.
 */
async function getPensionSummary(userId) {
  const res = await safeQuery(
    `SELECT name, pension_type, current_value, employee_monthly, employer_monthly, track, managing_company
     FROM pension_assets WHERE user_id = @userId`, { userId }
  );

  const funds = res.recordset;
  if (!funds.length) return { count: 0, funds: [], summary: 'No pension assets' };

  const totalValue = funds.reduce((s, f) => s + (f.current_value || 0), 0);
  const totalMonthly = funds.reduce((s, f) => s + (f.employee_monthly || 0) + (f.employer_monthly || 0), 0);

  return {
    count: funds.length,
    total_value_ils: Math.round(totalValue),
    total_monthly_contribution: Math.round(totalMonthly),
    annual_contribution: Math.round(totalMonthly * 12),
    funds,
  };
}

/**
 * News and sentiment via Finnhub (falls back to empty if unavailable).
 */
async function getNewsSentiment(symbol) {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return { symbol, news: [], sentiment: 'unavailable', note: 'FINNHUB_API_KEY not configured' };

  try {
    const to = new Date().toISOString().split('T')[0];
    const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const [newsRes, sentimentRes] = await Promise.all([
      axios.get(`https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${apiKey}`, { timeout: 10000 }),
      axios.get(`https://finnhub.io/api/v1/news-sentiment?symbol=${symbol}&token=${apiKey}`, { timeout: 10000 }).catch(() => ({ data: null })),
    ]);

    const news = (newsRes.data || []).slice(0, 5).map(n => ({
      headline: n.headline,
      source: n.source,
      date: new Date(n.datetime * 1000).toISOString().split('T')[0],
      url: n.url,
    }));

    const sentiment = sentimentRes.data?.sentiment || null;

    return {
      symbol,
      news,
      sentiment: sentiment ? {
        bullish_pct: sentiment.bullishPercent,
        bearish_pct: sentiment.bearishPercent,
        score: sentimentRes.data?.companyNewsScore,
      } : 'unavailable',
    };
  } catch (err) {
    console.error(`[agent:getNewsSentiment] ${symbol}:`, err.message);
    return { symbol, news: [], sentiment: 'error', error: err.message };
  }
}

/**
 * Fundamental financials via Yahoo Finance quoteSummary.
 */
async function getFinancials(symbol) {
  try {
    const { data } = await axios.get(
      `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=financialData,defaultKeyStatistics`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
        timeout: 10000,
      }
    );

    const fd = data?.quoteSummary?.result?.[0]?.financialData || {};
    const ks = data?.quoteSummary?.result?.[0]?.defaultKeyStatistics || {};

    return {
      symbol,
      pe_ratio: ks.forwardPE?.raw?.toFixed(2) || ks.trailingPE?.raw?.toFixed(2) || null,
      eps_ttm: ks.trailingEps?.raw || null,
      revenue_ttm: fd.totalRevenue?.raw || null,
      profit_margin_pct: fd.profitMargins?.raw ? (fd.profitMargins.raw * 100).toFixed(1) : null,
      operating_margin_pct: fd.operatingMargins?.raw ? (fd.operatingMargins.raw * 100).toFixed(1) : null,
      debt_to_equity: fd.debtToEquity?.raw?.toFixed(2) || null,
      return_on_equity_pct: fd.returnOnEquity?.raw ? (fd.returnOnEquity.raw * 100).toFixed(1) : null,
      free_cash_flow: fd.freeCashflow?.raw || null,
      analyst_target_price: fd.targetMeanPrice?.raw || null,
      analyst_recommendation: fd.recommendationKey || null,
    };
  } catch (err) {
    console.error(`[agent:getFinancials] ${symbol}:`, err.message);
    return { symbol, error: 'Failed to fetch financials', details: err.message };
  }
}

/**
 * Market overview from Yahoo Finance indices.
 */
async function getMarketOverview() {
  const indices = ['^GSPC', '^IXIC', '^VIX', 'DX-Y.NYB'];
  const labels = { '^GSPC': 'S&P 500', '^IXIC': 'NASDAQ', '^VIX': 'VIX (Fear)', 'DX-Y.NYB': 'DXY (Dollar)' };

  const results = {};
  await Promise.all(
    indices.map(async (ticker) => {
      try {
        const { data } = await axios.get(
          `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`,
          { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }, timeout: 8000 }
        );
        const meta = data?.chart?.result?.[0]?.meta || {};
        results[labels[ticker]] = {
          price: meta.regularMarketPrice?.toFixed(2) || null,
          change_pct: meta.regularMarketChangePercent?.toFixed(2) || null,
        };
      } catch {
        results[labels[ticker]] = { price: null, change_pct: null, error: 'unavailable' };
      }
    })
  );

  // Derive simple market trend
  const sp500Change = parseFloat(results['S&P 500']?.change_pct || 0);
  const vix = parseFloat(results['VIX (Fear)']?.price || 0);
  let trend = 'neutral';
  if (sp500Change > 0.5 && vix < 20) trend = 'bullish';
  else if (sp500Change < -0.5 || vix > 30) trend = 'bearish';

  return { ...results, market_trend: trend, vix_interpretation: vix > 30 ? 'high fear' : vix < 15 ? 'low fear' : 'moderate' };
}

/**
 * Portfolio risk metrics: Beta, Sharpe, volatility.
 * Computed from investment positions and basic heuristics when history unavailable.
 */
async function getRiskMetrics(userId) {
  const portfolio = await getFullPortfolio(userId);
  const total = portfolio.summary.total_assets_ils;
  if (total === 0) return { error: 'No assets to compute risk metrics' };

  // Concentration risk
  const singleAssetConcentration = portfolio.investments.map(inv => ({
    symbol: inv.symbol,
    weight_pct: parseFloat(((inv.value_ils / total) * 100).toFixed(1)),
  })).sort((a, b) => b.weight_pct - a.weight_pct).slice(0, 5);

  // Category weights
  const { breakdown_ils } = portfolio.summary;
  const cryptoPct = (breakdown_ils.crypto / total) * 100;
  const equityPct = (breakdown_ils.investments / total) * 100;

  // Volatility heuristic: crypto is high vol (~80% annual), equities ~15%, RE ~5%, cash ~0%
  const estimatedVolatility = (
    cryptoPct * 0.80 +
    equityPct * 0.15 +
    (breakdown_ils.real_estate / total) * 100 * 0.05 +
    (breakdown_ils.cash / total) * 100 * 0.001
  ) / 100;

  // Simplified Sharpe: assume 4% risk-free (Israeli gov bond), estimate return = 7% base + premium for concentration
  const estimatedReturn = 0.07;
  const sharpeRatio = estimatedVolatility > 0
    ? parseFloat(((estimatedReturn - 0.04) / estimatedVolatility).toFixed(2))
    : null;

  // Liquidity score (0-10): higher is more liquid
  const liquidAssets = breakdown_ils.investments + breakdown_ils.crypto + breakdown_ils.cash;
  const liquidityScore = parseFloat(((liquidAssets / total) * 10).toFixed(1));

  const warnings = [];
  if (cryptoPct > 30) warnings.push(`High crypto exposure: ${cryptoPct.toFixed(1)}% — crypto is highly volatile`);
  if (equityPct > 70) warnings.push(`High equity concentration: ${equityPct.toFixed(1)}%`);
  if (breakdown_ils.cash / total < 0.03) warnings.push('Low cash reserves — consider maintaining 3-6 months expenses in liquid assets');
  if (breakdown_ils.pension / total < 0.10 && portfolio.pension.length > 0) warnings.push('Low pension allocation relative to total portfolio');

  return {
    estimated_annual_volatility_pct: parseFloat((estimatedVolatility * 100).toFixed(1)),
    estimated_sharpe_ratio: sharpeRatio,
    liquidity_score: liquidityScore,
    top_concentrated_assets: singleAssetConcentration,
    risk_warnings: warnings,
    note: 'Risk metrics are estimates based on asset class heuristics, not historical price regression',
  };
}

/**
 * Main dispatcher — routes tool name to implementation.
 * @param {string} toolName
 * @param {object} toolInput
 * @param {string|number} userId
 * @returns {Promise<object>}
 */
async function executeTool(toolName, toolInput, userId) {
  try {
    switch (toolName) {
      case 'get_full_portfolio':
        return await getFullPortfolio(userId);
      case 'get_asset_allocation':
        return await getAssetAllocation(userId);
      case 'get_stock_data':
        return await getStockData(toolInput.symbol);
      case 'get_crypto_data':
        return await getCryptoData(toolInput.symbol);
      case 'get_real_estate_summary':
        return await getRealEstateSummary(userId);
      case 'get_pension_summary':
        return await getPensionSummary(userId);
      case 'get_news_sentiment':
        return await getNewsSentiment(toolInput.symbol);
      case 'get_financials':
        return await getFinancials(toolInput.symbol);
      case 'get_market_overview':
        return await getMarketOverview();
      case 'get_risk_metrics':
        return await getRiskMetrics(userId);
      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  } catch (err) {
    console.error(`[toolExecutor] ${toolName} failed:`, err.message);
    return { error: `Tool execution failed: ${err.message}` };
  }
}

module.exports = { executeTool };
