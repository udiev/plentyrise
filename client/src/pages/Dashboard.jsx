import { useState, useEffect } from "react"
import { useNavigate } from 'react-router-dom'
import Layout from "../components/layout/Layout"
import { useAuth } from '../context/AuthContext'
import { getSummary } from '../api/assets'
import api from '../api/client'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import useT from '../i18n/useT'

const COLORS = {
  real_estate: '#3B82F6',
  investments: '#10B981',
  crypto: '#F59E0B',
  cash: '#6366F1',
  pension: '#8B5CF6',
  debt: '#EF4444'
}

const LABELS = {
  real_estate: 'Real Estate',
  investments: 'Stocks & ETF',
  crypto: 'Crypto',
  cash: 'Cash',
  pension: 'Pension',
  debt: 'Debt'
}

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0)
}

function pct(n) {
  const sign = n >= 0 ? '+' : ''
  return `${sign}${(n || 0).toFixed(2)}%`
}

export default function Dashboard() {
  const tr = useT()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadData = () => {
    setLoading(true)
    getSummary()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [])

  const handleRefreshPrices = async () => {
    setRefreshing(true)
    try {
      await api.post('/assets/refresh-prices')
      await getSummary().then(setData)
    } catch (e) { console.error(e) }
    finally { setRefreshing(false) }
  }

  const chartData = data
    ? Object.entries(data.distribution)
        .filter(([k, v]) => k !== 'debt' && v > 0)
        .map(([k, v]) => ({ name: LABELS[k], value: v, color: COLORS[k] }))
    : []

  return (
    <Layout>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 md:mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight">{tr('portfolio_overview')}</h1>
          <p className="text-slate-500 text-sm mt-1">{tr('all_values_usd')}</p>
        </div>
        <button
          onClick={handleRefreshPrices}
          disabled={refreshing || loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-200 transition disabled:opacity-50 w-full sm:w-auto justify-center sm:justify-start border border-slate-200 bg-white"
        >
          <span className={refreshing ? 'animate-spin' : ''}>⟳</span>
          {refreshing ? tr('refreshing') : tr('refresh_prices')}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-400 animate-pulse">Loading portfolio...</div>
        </div>
      ) : (
        <>
          {/* Top stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
            <StatCard label="Net Worth"       value={fmt(data?.net_worth_usd)}      sub="Total portfolio value"    color="blue" />
            <StatCard label="Total Assets"    value={fmt(data?.total_assets_usd)}   sub="Across all categories"   color="green" />
            <StatCard label="Historical P&L"  value={fmt(data?.pnl?.historical)}    sub={pct(data?.pnl?.historical_pct)} color={data?.pnl?.historical >= 0 ? 'green' : 'red'} pnl />
            <StatCard label="Daily P&L"       value={fmt(data?.pnl?.daily)}         sub="vs yesterday"            color={data?.pnl?.daily >= 0 ? 'green' : 'red'} pnl />
          </div>

          {/* AI Agent banner */}
          <div
            onClick={() => navigate('/agent')}
            className="rounded-2xl p-4 md:p-5 mb-6 md:mb-8 cursor-pointer hover:opacity-95 transition-opacity flex items-center justify-between gap-4"
            style={{ background: 'linear-gradient(135deg, #4f46e5, #2563eb)', boxShadow: '0 4px 24px rgba(79,70,229,0.25)' }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">✦</div>
              <div className="min-w-0">
                <p className="text-white font-semibold text-sm">AI Investment Agent</p>
                <p className="text-indigo-200 text-xs mt-0.5 truncate">Get portfolio analysis, top recommendations & chat with your AI advisor</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 transition px-3 py-1.5 rounded-lg text-white text-xs font-medium flex-shrink-0">
              Open <span>→</span>
            </div>
          </div>

          {/* Middle row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">

            {/* Pie chart */}
            <div className="rounded-2xl p-5 md:p-6 bg-white" style={{ border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
              <h2 className="text-xs font-semibold text-slate-500 mb-4 uppercase tracking-wider">Distribution</h2>
              {chartData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={chartData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                        {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: '#fff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, color: '#0F172A' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-3">
                    {chartData.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.color }} />
                          <span className="text-slate-600">{item.name}</span>
                        </div>
                        <span className="font-num font-semibold text-slate-800">{fmt(item.value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyState label="No assets yet" />
              )}
            </div>

            {/* Top movers */}
            <div className="rounded-2xl p-5 md:p-6 bg-white" style={{ border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
              <h2 className="text-xs font-semibold text-slate-500 mb-4 uppercase tracking-wider">Top Movers Today</h2>
              {data?.top_movers?.length > 0 ? (
                <div className="space-y-3">
                  {data.top_movers.map((m, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-sm text-slate-800">{m.symbol}</div>
                        <div className="text-slate-500 text-xs">{m.name}</div>
                      </div>
                      <div className={`font-num text-sm font-semibold ${m.daily_change_pct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {pct(m.daily_change_pct)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState label="No price data yet" />
              )}
            </div>

            {/* Recent activity */}
            <div className="rounded-2xl p-5 md:p-6 bg-white" style={{ border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
              <h2 className="text-xs font-semibold text-slate-500 mb-4 uppercase tracking-wider">Recent Activity</h2>
              {data?.recent_activity?.length > 0 ? (
                <div className="space-y-3">
                  {data.recent_activity.map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-sm flex-shrink-0">
                        {item.type === 'investment' ? '📈' : item.type === 'crypto' ? '₿' : '🏠'}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-800">{item.name}</div>
                        <div className="text-slate-500 text-xs capitalize">{item.type}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState label="No assets added yet" />
              )}
            </div>
          </div>

          {/* Debt bar */}
          {data?.total_debt_usd > 0 && (
            <div className="rounded-2xl p-5 md:p-6 bg-white" style={{ border: '1px solid rgba(239,68,68,0.2)', boxShadow: 'var(--card-shadow)' }}>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Debt</h2>
                <span className="font-num text-red-600 font-semibold">{fmt(data.total_debt_usd)}</span>
              </div>
              <div className="w-full rounded-full h-1.5 bg-slate-100">
                <div
                  className="bg-red-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${Math.min((data.total_debt_usd / data.total_assets_usd) * 100, 100)}%` }}
                />
              </div>
              <p className="text-slate-500 text-xs mt-2">
                Debt-to-assets ratio: {((data.total_debt_usd / data.total_assets_usd) * 100).toFixed(1)}%
              </p>
            </div>
          )}
        </>
      )}
    </Layout>
  )
}

function StatCard({ label, value, sub, color, pnl }) {
  const accents = {
    blue:  { text: '#3B82F6', border: 'rgba(59,130,246,0.2)',  bg: 'rgba(59,130,246,0.04)' },
    green: { text: '#059669', border: 'rgba(5,150,105,0.2)',   bg: 'rgba(5,150,105,0.04)' },
    red:   { text: '#DC2626', border: 'rgba(220,38,38,0.2)',   bg: 'rgba(220,38,38,0.04)' },
  }
  const a = accents[color] || accents.blue

  return (
    <div
      className="rounded-2xl p-4 md:p-5 bg-white"
      style={{ border: `1px solid ${a.border}`, boxShadow: 'var(--card-shadow)', background: pnl ? a.bg : '#fff' }}
    >
      <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">{label}</p>
      <p className="text-xl md:text-2xl font-bold font-num" style={{ color: pnl ? a.text : '#0F172A' }}>
        {value}
      </p>
      <p className="text-xs mt-1" style={{ color: pnl ? a.text : '#94A3B8' }}>{sub}</p>
    </div>
  )
}

function EmptyState({ label }) {
  return (
    <div className="flex items-center justify-center h-32 text-slate-400 text-sm">{label}</div>
  )
}
