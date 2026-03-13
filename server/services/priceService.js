const axios = require('axios')
const cron = require('node-cron')
const { query } = require('../db/sql')

const CRYPTO_ID_MAP = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin',
  ADA: 'cardano', XRP: 'ripple', DOGE: 'dogecoin', DOT: 'polkadot',
  MATIC: 'matic-network', AVAX: 'avalanche-2', LINK: 'chainlink',
  UNI: 'uniswap', ATOM: 'cosmos', LTC: 'litecoin', BCH: 'bitcoin-cash'
}

async function fetchStockPrice(symbol) {
  try {
    const { data } = await axios.get(
      `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        timeout: 10000
      }
    )
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice
    return price || null
  } catch (err) {
    console.error(`Yahoo error for ${symbol}:`, err.message)
    return null
  }
}

async function fetchCryptoPrices(coinIds) {
  if (!coinIds.length) return {}
  try {
    const { data } = await axios.get(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds.join(',')}&vs_currencies=usd`,
      { timeout: 10000 }
    )
    const prices = {}
    Object.entries(data).forEach(([id, val]) => { prices[id] = val.usd })
    return prices
  } catch (err) {
    console.error('CoinGecko error:', err.message)
    return {}
  }
}

async function refreshAllPrices() {
  console.log('🔄 Refreshing prices...')
  try {
    // Stocks — skip rows with auto_price_disabled = 1
    let invResult
    try {
      invResult = await query('SELECT DISTINCT symbol, currency FROM investments WHERE is_crypto_tracker = 0 AND ISNULL(auto_price_disabled, 0) = 0')
    } catch {
      invResult = await query('SELECT DISTINCT symbol, currency FROM investments WHERE is_crypto_tracker = 0')
    }
    const symbolRows = invResult.recordset

    let stockCount = 0
    for (const { symbol, currency } of symbolRows) {
      const rawPrice = await fetchStockPrice(symbol)
      if (rawPrice) {
        // TASE stocks (e.g. TEVA.TA) are quoted in agorot — convert to NIS
        const price = symbol.endsWith('.TA') ? rawPrice / 100 : rawPrice
        await query(
          'UPDATE investments SET current_price = @price, updated_at = GETUTCDATE() WHERE symbol = @symbol AND ISNULL(auto_price_disabled, 0) = 0',
          { price, symbol }
        )
        stockCount++
      }
      await new Promise(r => setTimeout(r, 300)) // rate limit
    }
    if (stockCount) console.log(`✅ Updated ${stockCount} stock prices`)

    // Crypto
    const cryptoResult = await query('SELECT DISTINCT symbol, coin_id FROM crypto_assets')
    const cryptos = cryptoResult.recordset

    if (cryptos.length) {
      const coinIds = cryptos.map(c => c.coin_id || CRYPTO_ID_MAP[c.symbol] || c.symbol.toLowerCase())
      const cryptoPrices = await fetchCryptoPrices(coinIds)
      for (const crypto of cryptos) {
        const coinId = crypto.coin_id || CRYPTO_ID_MAP[crypto.symbol] || crypto.symbol.toLowerCase()
        const price = cryptoPrices[coinId]
        if (price) await query(
          'UPDATE crypto_assets SET current_price_usd = @price, updated_at = GETUTCDATE() WHERE symbol = @symbol',
          { price, symbol: crypto.symbol }
        )
      }
      console.log(`✅ Updated ${Object.keys(cryptoPrices).length} crypto prices`)
    }
  } catch (err) {
    console.error('Price refresh error:', err.message)
  }
}

function startPriceScheduler() {
  cron.schedule('*/30 9-18 * * 1-5', refreshAllPrices)
  cron.schedule('0 * * * 0,6', refreshAllPrices)
  console.log('⏰ Price scheduler started')
  setTimeout(refreshAllPrices, 5000)
}

module.exports = { startPriceScheduler, refreshAllPrices, fetchStockPrice, fetchCryptoPrices }
