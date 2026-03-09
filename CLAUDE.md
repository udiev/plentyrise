# PlentyRise

Personal wealth management platform for Israeli users.

## Repo Map
```
client/          React 18 + Vite + Tailwind — Azure Static Web Apps
server/          Node.js + Express — Azure App Service (plentyrise-api-k)
  routes/        auth, assets, investments, crypto, real-estate, cash, pension
  services/      priceService.js (Yahoo Finance + CoinGecko)
  db/            sql.js (Azure SQL), cosmos.js (Cosmos DB)
  middleware/    auth.js (JWT)
.github/
  workflows/     deploy-frontend.yml, deploy-backend.yml
docs/            Architecture, ADRs, runbooks
```

## Commands
```bash
# Run locally
cd server && node index.js        # API on :3001
cd client && npm run dev          # UI on :5173

# Deploy frontend
git push                          # GitHub Actions auto-deploys

# Deploy backend
cd server
zip -r ../server.zip .
az webapp deploy --name plentyrise-api-k --resource-group plentyrise-rg --src-path ../server.zip --type zip
```

## Rules
- Tailwind only — no CSS files, no styled-components
- async/await only — no .then() chains
- Every Express route must have try/catch → next(err)
- Never commit .env, node_modules, server.zip
- JWT secret and DB credentials live in Azure App Service env vars only
- All monetary values stored as DECIMAL(18,4) in SQL
