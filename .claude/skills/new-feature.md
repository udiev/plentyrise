# Skill: New Feature

When asked to build a new feature, follow this order:

## Step 1 — Backend Route
1. Create `server/routes/<name>.js`
2. Add `router.use(authenticate)` at the top
3. Implement GET, POST, PUT, DELETE
4. Register in `server/index.js`
5. Test with curl before moving to frontend

## Step 2 — API Client
Add functions to `client/src/api/assets.js`:
```js
export const getX = () => api.get('/x').then(r => r.data)
export const addX = (data) => api.post('/x', data).then(r => r.data)
export const updateX = (id, data) => api.put(`/x/${id}`, data).then(r => r.data)
export const deleteX = (id) => api.delete(`/x/${id}`).then(r => r.data)
```

## Step 3 — Frontend Page
- Import `Layout` from `../components/layout/Layout`
- Stat cards at top
- Add form (collapsible, shown on button click)
- Table using `AssetTable` component
- Loading state with `animate-pulse`
- Empty state with dashed border

## Step 4 — Register Route
Add to `client/src/App.jsx`:
```jsx
import NewPage from './pages/NewPage'
<Route path="/new-page" element={<PrivateRoute><NewPage /></PrivateRoute>} />
```
Add to nav in `client/src/components/layout/Layout.jsx`

## Step 5 — Deploy
```bash
git add . && git commit -m "feat: add X module" && git push
```
Frontend auto-deploys. Deploy backend manually if server files changed.
