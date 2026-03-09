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
      <div className="mb-6 md:mb-8">
        <h1 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight">{tr('settings')}</h1>
      </div>

      <div className="max-w-2xl space-y-4 md:space-y-5">

        {/* Language */}
        <section className="rounded-2xl p-5 md:p-6 bg-white" style={{ border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
          <h2 className="font-semibold text-slate-800 mb-1">{tr('language')}</h2>
          <p className="text-slate-500 text-sm mb-4">{tr('language_sub')}</p>
          <div className="flex gap-3 flex-wrap">
            {[['en', '🇬🇧 English'], ['he', '🇮🇱 עברית']].map(([lang, label]) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition ${language === lang ? 'text-white' : 'text-slate-600 bg-slate-100 hover:bg-slate-200'}`}
                style={language === lang ? { background: 'linear-gradient(135deg, #3B82F6, #6366F1)' } : {}}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* Currency */}
        <section className="rounded-2xl p-5 md:p-6 bg-white" style={{ border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
          <h2 className="font-semibold text-slate-800 mb-1">{tr('default_currency')}</h2>
          <p className="text-slate-500 text-sm mb-4">{tr('default_currency_sub')}</p>
          <div className="flex gap-3 flex-wrap">
            {CURRENCIES.map(cur => (
              <button
                key={cur}
                onClick={() => setCurrency(cur)}
                className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition ${currency === cur ? 'text-white' : 'text-slate-600 bg-slate-100 hover:bg-slate-200'}`}
                style={currency === cur ? { background: 'linear-gradient(135deg, #3B82F6, #6366F1)' } : {}}
              >
                {cur}
              </button>
            ))}
          </div>
        </section>

        {/* Exchange Rates */}
        <section className="rounded-2xl p-5 md:p-6 bg-white" style={{ border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-4">
            <div>
              <h2 className="font-semibold text-slate-800 mb-1">{tr('exchange_rates')}</h2>
              <p className="text-slate-500 text-sm">{tr('exchange_rates_sub')}</p>
            </div>
            {rates?.updated_at && (
              <span className="text-xs text-slate-400 sm:text-right flex-shrink-0">
                {tr('last_updated')}:<br />
                {new Date(rates.updated_at).toLocaleString()}
              </span>
            )}
          </div>

          {loading ? (
            <div className="text-slate-400 text-sm animate-pulse">{tr('loading')}</div>
          ) : error ? (
            <div className="text-red-600 text-sm">{error}</div>
          ) : (
            <div className="rounded-xl overflow-hidden border border-slate-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-4 py-3 text-slate-500 font-medium text-xs uppercase tracking-wider">{tr('currency_pair')}</th>
                    <th className="text-right px-4 py-3 text-slate-500 font-medium text-xs uppercase tracking-wider">{tr('rate')}</th>
                    <th className="text-right px-4 py-3 hidden sm:table-cell" />
                  </tr>
                </thead>
                <tbody>
                  {rates?.pairs.map((p, i) => (
                    <tr key={i} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-800">{p.from}</span>
                        <span className="text-slate-400 mx-2">→</span>
                        <span className="font-semibold text-slate-800">{p.to}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-num font-semibold text-green-600">{p.rate.toFixed(4)}</td>
                      <td className="px-4 py-3 text-right text-slate-400 text-xs hidden sm:table-cell">
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
