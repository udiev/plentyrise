# Runbook: Backend Deployment

## Manual Deploy (current method)
```bash
cd ~/plentyrise/server
zip -r ../server.zip .
az webapp deploy \
  --name plentyrise-api-k \
  --resource-group plentyrise-rg \
  --src-path ../server.zip \
  --type zip
```

## Verify Deployment
```bash
# Check logs
az webapp log tail --name plentyrise-api-k --resource-group plentyrise-rg

# Expected on success:
# ✅ Azure SQL connected
# ✅ Cosmos DB connected
# 🚀 PlentyRise API running on port 8080
# ⏰ Price scheduler started

# Health check
curl https://plentyrise-api-k.azurewebsites.net/health
# Expected: {"status":"ok"}
```

## Environment Variables on Azure
Set via:
```bash
az webapp config appsettings set --name plentyrise-api-k --resource-group plentyrise-rg --settings KEY=VALUE
```

Current vars: NODE_ENV, PORT, SQL_SERVER, SQL_DATABASE, SQL_USER, SQL_PASSWORD,
COSMOS_CONNECTION_STRING, COSMOS_DATABASE, COSMOS_CONTAINER, JWT_SECRET, CLIENT_URL

## Restart App
```bash
az webapp restart --name plentyrise-api-k --resource-group plentyrise-rg
```
