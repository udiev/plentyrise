import { useState, useEffect } from "react"
import Layout from "../components/layout/Layout"
import { useAuth } from '../context/AuthContext'
import { getSummary } from '../api/assets'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

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
  const { user, logout } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSummary()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const chartData = data
    ? Object.entries(data.distribution)
        .filter(([k, v]) => k !== 'debt' && v > 0)
        .map(([k, v]) => ({ name: LABELS[k], value: v, color: COLORS[k] }))
    : []

  return (
    <Layout>

        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Portfolio Overview</h1>
          <p className="text-slate-500 text-sm mt-1">All values in USD</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-slate-500 animate-pulse">Loading portfolio...</div>
          </div>
        ) : (
          <>
            {/* Top stats */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              <StatCard
                label="Net Worth"
                value={fmt(data?.net_worth_usd)}
                sub="Total portfolio value"
                color="blue"
              />
              <StatCard
                label="Total Assets"
                value={fmt(data?.total_assets_usd)}
                sub="Across all categories"
                color="green"
              />
              <StatCard
                label="Historical P&L"
                value={fmt(data?.pnl?.historical)}
                sub={pct(data?.pnl?.historical_pct)}
                color={data?.pnl?.historical >= 0 ? 'green' : 'red'}
                pnl
              />
              <StatCard
                label="Daily P&L"
                value={fmt(data?.pnl?.daily)}
                sub="vs yesterday"
                color={data?.pnl?.daily >= 0 ? 'green' : 'red'}
                pnl
              />
            </div>

            {/* Middle row */}
            <div className="grid grid-cols-3 gap-6 mb-8">

              {/* Pie chart */}
              <div className="col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h2 className="text-sm font-semibold text-slate-400 mb-4 uppercase tracking-wider">Distribution</h2>
                {chartData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={chartData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                          {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: '#1E293B', border: 'none', borderRadius: 8, color: '#fff' }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2 mt-4">
                      {chartData.map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                            <span className="text-slate-400">{item.name}</span>
                          </div>
                          <span className="text-white">{fmt(item.value)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <EmptyState label="No assets yet" />
                )}
              </div>

              {/* Top movers */}
              <div className="col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h2 className="text-sm font-semibold text-slate-400 mb-4 uppercase tracking-wider">Top Movers Today</h2>
                {data?.top_movers?.length > 0 ? (
                  <div className="space-y-3">
                    {data.top_movers.map((m, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-sm">{m.symbol}</div>
                          <div className="text-slate-500 text-xs">{m.name}</div>
                        </div>
                        <div className={`text-sm font-mono font-semibold ${m.daily_change_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
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
              <div className="col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h2 className="text-sm font-semibold text-slate-400 mb-4 uppercase tracking-wider">Recent Activity</h2>
                {data?.recent_activity?.length > 0 ? (
                  <div className="space-y-3">
                    {data.recent_activity.map((item, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-xs text-slate-400">
                          {item.type === 'investment' ? '📈' : item.type === 'crypto' ? '₿' : '🏠'}
                        </div>
                        <div>
                          <div className="text-sm font-medium">{item.name}</div>
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
              <div className="bg-slate-900 border border-red-900/50 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Total Debt</h2>
                  <span className="text-red-400 font-mono font-semibold">{fmt(data.total_debt_usd)}</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2">
                  <div
                    className="bg-red-500 h-2 rounded-full"
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
  const colors = {
    blue: 'border-blue-500/30 bg-blue-500/5',
    green: 'border-green-500/30 bg-green-500/5',
    red: 'border-red-500/30 bg-red-500/5',
  }
  const textColors = { blue: 'text-blue-400', green: 'text-green-400', red: 'text-red-400' }

  return (
    <div className={`border rounded-2xl p-6 ${colors[color] || colors.blue}`}>
      <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-2xl font-bold font-mono ${pnl ? textColors[color] : 'text-white'}`}>{value}</p>
      <p className={`text-xs mt-1 ${pnl ? textColors[color] : 'text-slate-500'}`}>{sub}</p>
    </div>
  )
}

function EmptyState({ label }) {
  return (
    <div className="flex items-center justify-center h-32 text-slate-600 text-sm">{label}</div>
  )
}
