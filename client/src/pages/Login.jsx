import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full px-4 py-3 rounded-xl text-sm focus:outline-none transition text-slate-800 placeholder-slate-400'
  const inputStyle = { background: '#F1F5F9', border: '1px solid rgba(0,0,0,0.1)' }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold text-white mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}
          >
            P
          </div>
          <h1 className="text-2xl font-bold text-slate-800">PlentyRise</h1>
          <p className="text-slate-500 text-sm mt-1">Personal Wealth Management</p>
        </div>

        <div className="rounded-2xl p-6 md:p-8 bg-white" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid rgba(0,0,0,0.06)' }}>
          {error && (
            <div className="px-4 py-3 rounded-xl mb-5 text-sm text-red-600 bg-red-50 border border-red-200">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} style={inputStyle} placeholder="you@example.com" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className={inputCls} style={inputStyle} placeholder="••••••••" required />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-sm text-white transition disabled:opacity-50 mt-2"
              style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
