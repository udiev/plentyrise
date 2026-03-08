import { useSettings } from '../context/SettingsContext'
import t from './translations'

export default function useT() {
  const { language } = useSettings()
  return (key) => t[language]?.[key] ?? t.en[key] ?? key
}
