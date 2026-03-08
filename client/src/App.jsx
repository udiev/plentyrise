import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SettingsProvider } from './context/SettingsContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Investments from './pages/Investments'
import Crypto from './pages/Crypto'
import RealEstate from './pages/RealEstate'
import Cash from './pages/Cash'
import Pension from './pages/Pension'
import Settings from './pages/Settings'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen bg-[#0A0F1E] flex items-center justify-center">
      <div className="text-slate-500 animate-pulse">Loading...</div>
    </div>
  )
  return user ? children : <Navigate to="/login" />
}

export default function App() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/"            element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/investments" element={<PrivateRoute><Investments /></PrivateRoute>} />
            <Route path="/crypto"      element={<PrivateRoute><Crypto /></PrivateRoute>} />
            <Route path="/real-estate" element={<PrivateRoute><RealEstate /></PrivateRoute>} />
            <Route path="/cash"        element={<PrivateRoute><Cash /></PrivateRoute>} />
            <Route path="/pension"     element={<PrivateRoute><Pension /></PrivateRoute>} />
            <Route path="/settings"    element={<PrivateRoute><Settings /></PrivateRoute>} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </SettingsProvider>
  )
}
