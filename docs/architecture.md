# Architecture Overview

## System Diagram
```
Browser
  └── Azure Static Web Apps (React SPA)
        └── API calls → Azure App Service (Node.js/Express)
              ├── Azure SQL (portfolio data)
              └── Cosmos DB (AI chat history)
```

## Azure Resources
| Resource | Name | Region |
|---|---|---|
| App Service | plentyrise-api-k | westeurope |
| Static Web App | plentyrise-web | westeurope |
| SQL Server | plentyrise-sql-461043 | northeurope |
| SQL DB | plentyrise-db | northeurope |
| Cosmos DB | plentyrise-cosmos-461043 | northeurope |
| Key Vault | plentyrise-kv-prod | westeurope |
| Resource Group | plentyrise-rg | — |
| Subscription | a3bb470a-15fe-403a-8ccd-2203e02e8513 | — |

## Auth Flow
1. POST /api/v1/auth/login → returns JWT
2. Frontend stores JWT in localStorage
3. Axios interceptor adds `Authorization: Bearer <token>` to all requests
4. `middleware/auth.js` verifies JWT, attaches `req.user`

## Data Model (key tables)
- `users` — auth, profile, role
- `investments` — stocks, ETFs, bonds, mutual funds
- `crypto_assets` — crypto holdings
- `real_estate_properties` — property portfolio
- `cash_holdings` — savings, loans, mortgages, credit cards
- `pension_assets` — Israeli pension funds
- `exchange_rates` — currency conversion cache
- `vw_portfolio_summary` — SQL view aggregating all assets per user

## Price Refresh
- Stocks: Yahoo Finance query2 v8 endpoint (no API key needed)
- Crypto: CoinGecko free API
- Schedule: every 30 min weekdays 9-18, hourly weekends
- Manual trigger: POST /api/v1/assets/refresh-prices (JWT required)

## Frontend Routes
| Path | Page |
|---|---|
| /login | Login |
| / | Dashboard |
| /investments | Investments |
| /crypto | Crypto |
| /real-estate | Real Estate |
| /cash | Cash & Debt |
| /pension | Pension |
