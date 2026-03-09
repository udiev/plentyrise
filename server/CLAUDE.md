# Auth Module — Sharp Edge ⚠️

Be careful here. This module handles security.

## Rules
- NEVER log passwords, tokens, or user PII
- NEVER remove the `authenticate` middleware from protected routes
- NEVER change the JWT secret without updating Azure App Service env var
- Password hashing: bcrypt with saltRounds=12 — do not lower this
- JWT expiry: 7d — do not increase without considering security implications

## Files
- `server/middleware/auth.js` — JWT verification middleware
- `server/routes/auth.js` — register, login, /me endpoints

## Test before deploying any auth changes
```bash
# Register
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test1234!","full_name":"Test"}'

# Login
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"udi@plentyrise.com","password":"Test1234!"}'

# Protected route
curl http://localhost:3001/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```
