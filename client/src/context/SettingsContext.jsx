import { createContext, useContext, useState, useEffect } from 'react'

const SettingsContext = createContext()

export function SettingsProvider({ children }) {
  const [language, setLanguageState] = useState(() => localStorage.getItem('pr_language') || 'en')
  const [currency, setCurrencyState] = useState(() => localStorage.getItem('pr_currency') || 'USD')

  const setLanguage = (lang) => {
    localStorage.setItem('pr_language', lang)
    setLanguageState(lang)
  }

  const setCurrency = (cur) => {
    localStorage.setItem('pr_currency', cur)
    setCurrencyState(cur)
  }

  // Apply RTL and lang attribute to document
  useEffect(() => {
    document.documentElement.dir  = language === 'he' ? 'rtl' : 'ltr'
    document.documentElement.lang = language
  }, [language])

  return (
    <SettingsContext.Provider value={{ language, setLanguage, currency, setCurrency }}>
      {children}
    </SettingsContext.Provider>
  )
}

export const useSettings = () => useContext(SettingsContext)
