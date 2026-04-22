/**
 * Tool definitions for the Investment Agent.
 * Format follows Anthropic tool_use specification.
 */
const AGENT_TOOLS = [
  {
    name: 'get_full_portfolio',
    description: 'Fetch all user assets from all modules (investments, crypto, real estate, cash, pension, alternatives). Returns total value in ILS and USD, plus a full asset list.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_asset_allocation',
    description: 'Get portfolio allocation breakdown by category (investments/crypto/real estate/cash/pension/alternatives), sector (Tech/Healthcare/Energy etc.), geography, and currency exposure.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_stock_data',
    description: 'Get current price, daily change, MA50, MA200, RSI, and volume for a stock or ETF ticker.',
    input_schema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Stock or ETF ticker symbol, e.g. AAPL, TEVA.TA, SPY',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_crypto_data',
    description: 'Get current price, market cap, 24h change, and dominance for a cryptocurrency.',
    input_schema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Crypto symbol, e.g. BTC, ETH, SOL',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_real_estate_summary',
    description: 'Get real estate portfolio summary including total value, LTV ratio, and average rental yield.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_pension_summary',
    description: 'Get pension funds summary including total value, track type, and monthly contributions.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_news_sentiment',
    description: 'Get recent news headlines and sentiment analysis for a specific stock ticker or crypto symbol.',
    input_schema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Stock ticker or crypto symbol to get news for, e.g. AAPL, BTC',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_financials',
    description: 'Get fundamental financial data for a stock: P/E ratio, EPS, revenue, profit margins, debt-to-equity.',
    input_schema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Stock ticker symbol, e.g. AAPL, MSFT',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_market_overview',
    description: 'Get current general market state: S&P500, NASDAQ, VIX (fear index), DXY (dollar index), and market trend summary.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_risk_metrics',
    description: 'Calculate portfolio risk metrics: Beta (market sensitivity), Sharpe Ratio (risk-adjusted return), volatility, and concentration risk.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];

module.exports = { AGENT_TOOLS };
