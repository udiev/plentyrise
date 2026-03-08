import { useAuth } from '../../context/AuthContext'
import { useNavigate, useLocation } from 'react-router-dom'

const nav = [
  { path: '/', label: 'Dashboard' },
  { path: '/investments', label: 'Investments' },
  { path: '/crypto', label: 'Crypto' },
  { path: '/real-estate', label: 'Real Estate' },
  { path: '/cash', label: 'Cash & Debt' },
  { path: '/pension', label: 'Pension' },
]

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <div className="min-h-screen bg-[#0A0F1E] text-white font-mono">
      <header className="border-b border-slate-800 px-8 py-4 flex items-center justify-between sticky top-0 bg-[#0A0F1E] z-10">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center text-sm font-bold">P</div>
          <span className="text-lg font-bold tracking-tight">PlentyRise</span>
        </div>
        <nav className="flex items-center gap-5 text-sm">
          {nav.map(item => (
            <span
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`cursor-pointer transition pb-1 ${pathname === item.path ? 'text-white border-b border-blue-500' : 'text-slate-400 hover:text-white'}`}
            >
              {item.label}
            </span>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <span className="text-slate-400 text-sm">{user?.full_name}</span>
          <button onClick={logout} className="text-slate-500 hover:text-white text-sm transition">Logout</button>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-8 py-8">{children}</main>
    </div>
  )
}
