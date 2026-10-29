import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react"
import { useSettings } from "@/core/settings/SettingsContext"
import { localizeBackendError } from "./errors"
import { makeT, resolveLanguage, type Language, type TFunction } from "./translate"

type I18nValue = {
  language: Language
  t: TFunction
  /** Localizes a backend error/warning code; unknown strings are returned as-is. */
  tError: (code: string) => string
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings()
  const language = resolveLanguage(settings.language)
  const value = useMemo<I18nValue>(() => {
    const t = makeT(language)
    return { language, t, tError: code => localizeBackendError(code, t) }
  }, [language])

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext)
  if (!value) throw new Error("useI18n must be used inside <I18nProvider>")
  return value
}
