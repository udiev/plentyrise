# Skill: Debugging

## Frontend Issues
1. Check browser console (F12) for errors first
2. Check Network tab — is the API call being made? What status code?
3. Check that VITE_API_URL is set correctly in `.env.production`
4. For routing 404s — check `client/public/staticwebapp.config.json` exists

## Backend Issues
```bash
# Live logs
az webapp log tail --name plentyrise-api-k --resource-group plentyrise-rg

# Health check
curl https://plentyrise-api-k.azurewebsites.net/health

# Check what's deployed
# Go to: https://plentyrise-api-k.scm.azurewebsites.net/DebugConsole
# Run: ls /home/site/wwwroot
```

## Common Issues & Fixes
| Problem | Cause | Fix |
|---|---|---|
| 404 on page refresh | SPA routing | Check staticwebapp.config.json |
| CORS error | CLIENT_URL mismatch | Update Azure App Service env var |
| 401 on API calls | JWT expired or missing | Check Authorization header |
| Module not found | File not in zip | Check ls server/ before zipping |
| App Error on Azure | Crash on startup | Check logs immediately |
| $0 on dashboard | Assets not in vw_portfolio_summary | Check SQL view |

## Database Debugging
```sql
-- Check what's in the portfolio view
SELECT * FROM vw_portfolio_summary WHERE user_id = 'YOUR_USER_ID'

-- Check investments
SELECT * FROM investments WHERE user_id = 'YOUR_USER_ID'
```
