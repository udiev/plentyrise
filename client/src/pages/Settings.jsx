import { useState, useEffect } from 'react'
import Layout from '../components/layout/Layout'
import { useSettings } from '../context/SettingsContext'
import useT from '../i18n/useT'
import api from '../api/client'

const CURRENCIES = ['USD', 'ILS', 'EUR', 'GBP']

export default function Settings() {
  const { language, setLanguage, currency, setCurrency } = useSettings()
  const tr = useT()
  const [rates, setRates]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    api.get('/settings/exchange-rates')
      .then(r => setRates(r.data))
      .catch(() => setError('Could not load exchange rates'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">{tr('settings')}</h1>
      </div>

      <div className="max-w-2xl space-y-6">

        {/* Language */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="font-semibold mb-1">{tr('language')}</h2>
          <p className="text-slate-500 text-sm mb-4">{tr('language_sub')}</p>
          <div className="flex gap-3">
            <button
              onClick={() => setLanguage('en')}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold border transition ${
                language === 'en'
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
              }`}
            >
              🇬🇧 English
            </button>
            <button
              onClick={() => setLanguage('he')}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold border transition ${
                language === 'he'
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
              }`}
            >
              🇮🇱 עברית
            </button>
          </div>
        </section>

        {/* Currency */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="font-semibold mb-1">{tr('default_currency')}</h2>
          <p className="text-slate-500 text-sm mb-4">{tr('default_currency_sub')}</p>
          <div className="flex gap-3 flex-wrap">
            {CURRENCIES.map(cur => (
              <button
                key={cur}
                onClick={() => setCurrency(cur)}
                className={`px-5 py-2.5 rounded-xl text-sm font-semibold border transition ${
                  currency === cur
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                {cur}
              </button>
            ))}
          </div>
        </section>

        {/* Exchange Rates */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="font-semibold mb-1">{tr('exchange_rates')}</h2>
              <p className="text-slate-500 text-sm">{tr('exchange_rates_sub')}</p>
            </div>
            {rates?.updated_at && (
              <span className="text-xs text-slate-600 mt-1 text-right">
                {tr('last_updated')}:<br />
                {new Date(rates.updated_at).toLocaleString()}
              </span>
            )}
          </div>

          {loading ? (
            <div className="text-slate-500 text-sm animate-pulse">{tr('loading')}</div>
          ) : error ? (
            <div className="text-red-400 text-sm">{error}</div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-800/60">
                  <tr>
                    <th className="text-left px-4 py-3 text-slate-400 font-medium">{tr('currency_pair')}</th>
                    <th className="text-right px-4 py-3 text-slate-400 font-medium">{tr('rate')}</th>
                    <th className="text-right px-4 py-3 text-slate-400 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {rates?.pairs.map((p, i) => (
                    <tr key={i} className="border-t border-slate-800 hover:bg-slate-800/30 transition">
                      <td className="px-4 py-3">
                        <span className="font-semibold text-white">{p.from}</span>
                        <span className="text-slate-500 mx-2">→</span>
                        <span className="font-semibold text-white">{p.to}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-green-400">{p.rate.toFixed(4)}</td>
                      <td className="px-4 py-3 text-right text-slate-500 text-xs">
                        1 {p.from} = {p.rate.toFixed(4)} {p.to}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </div>
    </Layout>
  )
}
