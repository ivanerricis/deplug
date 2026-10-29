import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { DEFAULT_SETTINGS, normalizeSettings, saveSettings, type AppSettings } from "./AppSettings"
import { loadSettings } from "./LoadSettings"
import { applyTheme } from "../theme"
import { errorMessage } from "../plugin/Uninstall"

type SettingsValue = {
  settings: AppSettings
  /** False until the first load from the backend has finished (defaults are served meanwhile). */
  loaded: boolean
  /** Applies a patch optimistically and persists the whole object; reverts and sets saveError on failure. */
  update: (patch: Partial<AppSettings>) => void
  saveError: string | null
  clearSaveError: () => void
}

const SettingsContext = createContext<SettingsValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const current = useRef(settings)
  const committed = useRef(settings)
  const queue = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    let cancelled = false
    loadSettings()
      .then(s => {
        if (cancelled) return
        current.current = committed.current = s
        setSettings(s)
      })
      .catch(e => {
        console.error(e)
        if (!cancelled) setSaveError(errorMessage(e))
      })
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => applyTheme(settings.theme), [settings.theme])

  const update = useCallback((patch: Partial<AppSettings>) => {
    const next = normalizeSettings({ ...current.current, ...patch })
    current.current = next
    setSettings(next)
    setSaveError(null)
    // Saves run one after the other so an older write can never land after a newer one.
    queue.current = queue.current.then(() =>
      saveSettings(next).then(
        () => {
          committed.current = next
        },
        e => {
          current.current = committed.current
          setSettings(committed.current)
          setSaveError(errorMessage(e))
        },
      ),
    )
  }, [])

  const clearSaveError = useCallback(() => setSaveError(null), [])

  const value = useMemo(
    () => ({ settings, loaded, update, saveError, clearSaveError }),
    [settings, loaded, update, saveError, clearSaveError],
  )
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsValue {
  const value = useContext(SettingsContext)
  if (!value) throw new Error("useSettings must be used inside <SettingsProvider>")
  return value
}
