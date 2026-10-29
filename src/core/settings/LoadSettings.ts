import { getSettings, saveSettings, type AppSettings } from "./AppSettings"

const LEGACY_KEY = "customScanPaths"

export type LoadSettingsBackend = {
  getSettings: () => Promise<AppSettings>
  saveSettings: (settings: AppSettings) => Promise<void>
}

export type LegacyStorage = {
  getItem: (key: string) => string | null
  removeItem: (key: string) => void
}

export type LoadSettingsDeps = {
  backend: LoadSettingsBackend
  storage: LegacyStorage | undefined
}

const defaultDeps = (): LoadSettingsDeps => ({
  backend: { getSettings, saveSettings },
  storage: typeof localStorage === "undefined" ? undefined : localStorage,
})

function readLegacy(storage: LegacyStorage | undefined): string[] {
  try {
    const raw = storage?.getItem(LEGACY_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === "string") : []
  } catch {
    return []
  }
}

/**
 * Loads the settings from the backend. Custom scan folders that an older
 * version kept in localStorage are moved into the backend settings once.
 */
export async function loadSettings(deps: LoadSettingsDeps = defaultDeps()): Promise<AppSettings> {
  const { backend, storage } = deps
  const settings = await backend.getSettings()
  if (settings.customScanPaths.length > 0) return settings

  const legacy = readLegacy(storage)
  if (legacy.length === 0) return settings

  const migrated = { ...settings, customScanPaths: legacy }
  await backend.saveSettings(migrated)
  try {
    storage?.removeItem(LEGACY_KEY)
  } catch {
    // ignore: the backend already has the data
  }
  return migrated
}
