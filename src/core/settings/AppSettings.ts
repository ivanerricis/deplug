import { invoke } from "@tauri-apps/api/core"

export type LanguageSetting = "system" | "en" | "it"
export type ThemeSetting = "system" | "light" | "dark"

export type AppSettings = {
  version: number
  customScanPaths: string[]
  language: LanguageSetting
  theme: ThemeSetting
  restorePointDefault: boolean
  scanOnStartup: boolean
  customScanDepth: number
  disabledSystemPaths: string[]
  /** Windows only: relaunch elevated at startup. Takes effect on the next start. */
  runAsAdmin: boolean
  /** Windows only: also search the registry for leftover keys when uninstalling a plugin. */
  searchRegistryLeftovers: boolean
}

export type AppInfo = {
  portable: boolean
  dataDir: string | null
  /** Stable code (WARN_NOT_WRITABLE | WARN_APP_TRANSLOCATION), see localizeBackendError. */
  portableWarning: string | null
  /** True when the process already runs with administrator rights (Windows only). */
  elevated: boolean
}

export const MIN_SCAN_DEPTH = 1
export const MAX_SCAN_DEPTH = 10
export const DEFAULT_SCAN_DEPTH = 6

export const DEFAULT_SETTINGS: AppSettings = {
  version: 1,
  customScanPaths: [],
  language: "system",
  theme: "system",
  restorePointDefault: true,
  scanOnStartup: true,
  customScanDepth: DEFAULT_SCAN_DEPTH,
  disabledSystemPaths: [],
  runAsAdmin: true,
  searchRegistryLeftovers: false,
}

const onlyStrings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((p): p is string => typeof p === "string") : []

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback

export function clampDepth(value: unknown): number {
  const n = typeof value === "number" ? value : Number.NaN
  if (!Number.isFinite(n)) return DEFAULT_SCAN_DEPTH
  return Math.min(MAX_SCAN_DEPTH, Math.max(MIN_SCAN_DEPTH, Math.round(n)))
}

/** Turns whatever the backend (or an older version of it) returned into a complete, valid settings object. */
export function normalizeSettings(raw: unknown): AppSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  const d = DEFAULT_SETTINGS
  return {
    version: typeof r.version === "number" ? r.version : d.version,
    customScanPaths: onlyStrings(r.customScanPaths),
    language: oneOf(r.language, ["system", "en", "it"], d.language),
    theme: oneOf(r.theme, ["system", "light", "dark"], d.theme),
    restorePointDefault: typeof r.restorePointDefault === "boolean" ? r.restorePointDefault : d.restorePointDefault,
    scanOnStartup: typeof r.scanOnStartup === "boolean" ? r.scanOnStartup : d.scanOnStartup,
    customScanDepth: r.customScanDepth === undefined ? d.customScanDepth : clampDepth(r.customScanDepth),
    disabledSystemPaths: onlyStrings(r.disabledSystemPaths),
    runAsAdmin: typeof r.runAsAdmin === "boolean" ? r.runAsAdmin : d.runAsAdmin,
    searchRegistryLeftovers: typeof r.searchRegistryLeftovers === "boolean" ? r.searchRegistryLeftovers : d.searchRegistryLeftovers,
  }
}

export async function getSettings(): Promise<AppSettings> {
  return normalizeSettings(await invoke<unknown>("get_settings"))
}

export function saveSettings(settings: AppSettings): Promise<void> {
  return invoke<void>("save_settings", { settings })
}

export function getAppInfo(): Promise<AppInfo> {
  return invoke<AppInfo>("app_info")
}
