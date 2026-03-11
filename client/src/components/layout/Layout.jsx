import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate, useLocation } from 'react-router-dom'
import useT from '../../i18n/useT'
import AiChat from '../ui/AiChat'

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const tr = useT()
  const [menuOpen, setMenuOpen] = useState(false)

  const nav = [
    { path: '/',            key: 'nav_dashboard'   },
    { path: '/investments', key: 'nav_investments' },
    { path: '/crypto',      key: 'nav_crypto'      },
    { path: '/real-estate', key: 'nav_real_estate' },
    { path: '/cash',        key: 'nav_cash'        },
    { path: '/pension',     key: 'nav_pension'     },
    { path: '/alternative-investments', key: 'nav_alternative' },
    { path: '/cashflow',    key: 'nav_cashflow'    },
    { path: '/settings',    key: 'nav_settings'    },
  ]

  const goTo = (path) => {
    navigate(path)
    setMenuOpen(false)
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-10 px-4 md:px-8 py-3.5 flex items-center justify-between bg-white"
        style={{ boxShadow: 'var(--header-shadow)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => goTo('/')}>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}
          >
            P
          </div>
          <span className="text-base font-bold tracking-tight text-slate-800">PlentyRise</span>
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 text-sm">
          {nav.map(item => (
            <button
              key={item.path}
              onClick={() => goTo(item.path)}
              className={`px-3 py-1.5 rounded-lg transition-all font-medium ${
                pathname === item.path
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {tr(item.key)}
            </button>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <span className="hidden sm:block text-slate-500 text-sm">{user?.full_name}</span>
          <button
            onClick={logout}
            className="hidden md:block text-slate-400 hover:text-slate-700 text-sm transition"
          >
            {tr('logout')}
          </button>
          {/* Hamburger */}
          <button
            onClick={() => setMenuOpen(true)}
            className="md:hidden flex flex-col gap-1.5 p-1 text-slate-500 hover:text-slate-800 transition"
            aria-label="Open menu"
          >
            <span className="block w-5 h-0.5 bg-current rounded" />
            <span className="block w-5 h-0.5 bg-current rounded" />
            <span className="block w-5 h-0.5 bg-current rounded" />
          </button>
        </div>
      </header>

      {/* ── Mobile Drawer ──────────────────────────────────────────────── */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setMenuOpen(false)} />
          <div
            className="fixed left-0 top-0 h-full w-72 z-50 flex flex-col bg-white"
            style={{ boxShadow: '4px 0 24px rgba(0,0,0,0.1)' }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}
                >
                  P
                </div>
                <span className="font-bold text-sm text-slate-800">PlentyRise</span>
              </div>
              <button onClick={() => setMenuOpen(false)} className="text-slate-400 hover:text-slate-700 text-lg leading-none transition">✕</button>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
              {nav.map(item => (
                <button
                  key={item.path}
                  onClick={() => goTo(item.path)}
                  className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    pathname === item.path
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {tr(item.key)}
                </button>
              ))}
            </nav>

            <div className="px-5 py-4 border-t border-slate-100">
              <p className="text-slate-600 text-sm mb-2">{user?.full_name}</p>
              <button onClick={() => { logout(); setMenuOpen(false) }} className="text-slate-400 hover:text-slate-700 text-sm transition">
                {tr('logout')}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Main content ───────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-8">
        {children}
      </main>

      <AiChat />
    </div>
  )
}
