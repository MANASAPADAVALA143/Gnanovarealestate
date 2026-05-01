import React, { createContext, useContext, useEffect, useState } from 'react'
import enJson from '../locales/en.json'

type SupportedLang = 'en' | 'es' | 'ar' | 'fr'

type Messages = Record<string, string>

type I18nContextValue = {
  lang: SupportedLang
  t: (key: string) => string
  setLang: (lang: SupportedLang) => void
  direction: 'ltr' | 'rtl'
}

const I18N_STORAGE_KEY = 'gnanova_lang'

const I18nContext = createContext<I18nContextValue | undefined>(undefined)

// Only en.json is shipped; other locales fall back to English until translated files exist.
const enMessages = enJson as Messages

const messagesMap: Record<SupportedLang, Messages> = {
  en: enMessages,
  es: enMessages,
  ar: enMessages,
  fr: enMessages,
}

function detectBrowserLanguage(): SupportedLang {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'en'

  const stored = window.localStorage.getItem(I18N_STORAGE_KEY) as SupportedLang | null
  if (stored && ['en', 'es', 'ar', 'fr'].includes(stored)) return stored

  const lang = navigator.language.toLowerCase()
  if (lang.startsWith('es')) return 'es'
  if (lang.startsWith('ar')) return 'ar'
  if (lang.startsWith('fr')) return 'fr'
  return 'en'
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<SupportedLang>('en')

  useEffect(() => {
    const detected = detectBrowserLanguage()
    setLangState(detected)
  }, [])

  const setLang = (newLang: SupportedLang) => {
    setLangState(newLang)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(I18N_STORAGE_KEY, newLang)
      document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr'
    }
  }

  const messages = messagesMap[lang] || messagesMap.en

  const t = (key: string): string => {
    return messages[key] || messages[key.replace(/^[^.]+\./, '')] || key
  }

  const direction: 'ltr' | 'rtl' = lang === 'ar' ? 'rtl' : 'ltr'

  const value: I18nContextValue = {
    lang,
    t,
    setLang,
    direction,
  }

  return (
    <I18nContext.Provider value={value}>
      <div dir={direction}>{children}</div>
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    throw new Error('useI18n must be used within an I18nProvider')
  }
  return ctx
}

export const SUPPORTED_LANGUAGES: { code: SupportedLang; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'es', label: 'ES' },
  { code: 'ar', label: 'AR' },
  { code: 'fr', label: 'FR' },
]
