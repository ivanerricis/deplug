import { invoke } from "@tauri-apps/api/core"
import { normalizeExclusions } from "../plugin/Exclude"

export type LanguageSetting = "system" | "en" | "it"
export type ThemeSetting = "system" | "light" | "dark"
export type DeleteMethodSetting = "trash" | "permanent"
export type UpdateChannel = "stable" | "prerelease"

export type ColumnKey = "path" | "size" | "modified" | "arch"
export type DensitySetting = "comfortable" | "compact"
export type TabSetting = "all" | "VST2" | "VST3" | "AAX" | "AU" | "CLAP"
export type SortSetting = { key: "name" | "path" | "size" | "modified"; dir: "asc" | "desc" }

export const COLUMN_KEYS: readonly ColumnKey[] = ["path", "size", "modified", "arch"]
export const TAB_SETTINGS: readonly TabSetting[] = ["all", "VST2", "VST3", "AAX", "AU", "CLAP"]
export const SORT_KEYS: readonly SortSetting["key"][] = ["name", "path", "size", "modified"]

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
  /** How uninstalled plugins are deleted: moved to the trash (default) or deleted for good. */
  deleteMethod: DeleteMethodSetting
  /** Ask for confirmation before uninstalling (default on; always asked when the delete method is "permanent"). */
  confirmUninstall: boolean
  /** Opt-in: check for a newer release shortly after startup. */
  checkUpdatesOnStartup: boolean
  /** "stable" ignores GitHub pre-releases; "prerelease" also offers release candidates. */
  updateChannel: UpdateChannel
  /** Unix time in ms of the last automatic update check (0 = never). */
  lastUpdateCheck: number
  /** Name patterns (`*` wildcard) of plugins and folders the scan skips. */
  scanExclusions: string[]
  /** Optional list columns shown, in canonical order. Name is always shown. */
  visibleColumns: ColumnKey[]
  density: DensitySetting
  defaultTab: TabSetting
  defaultSort: SortSetting
  /** Restore the last used tab and sort at startup instead of the defaults. */
  rememberView: boolean
  lastTab: TabSetting
  lastSort: SortSetting
  /** The first-run welcome screen was dismissed (an existing settings file counts as seen, see portable-core). */
  welcomeSeen: boolean
}

export type AppInfo = {
  portable: boolean
  dataDir: string | null
  /** Stable code (WARN_NOT_WRITABLE | WARN_APP_TRANSLOCATION), see localizeBackendError. */
  portableWarning: string | null
  /** True when the process already runs with administrator rights (Windows only). */
  elevated: boolean
  /** CPU architecture and OS family from the backend, e.g. "x86_64 / windows". */
  osInfo?: string
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
  searchRegistryLeftovers: true,
  deleteMethod: "trash",
  confirmUninstall: true,
  checkUpdatesOnStartup: true,
  updateChannel: "stable",
  lastUpdateCheck: 0,
  scanExclusions: [],
  visibleColumns: [...COLUMN_KEYS],
  density: "comfortable",
  defaultTab: "all",
  defaultSort: { key: "name", dir: "asc" },
  rememberView: true,
  lastTab: "all",
  lastSort: { key: "name", dir: "asc" },
  welcomeSeen: false,
}

const onlyStrings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((p): p is string => typeof p === "string") : []

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback

function normalizeSort(value: unknown): SortSetting {
  const r = (value && typeof value === "object" ? value : {}) as Record<string, unknown>
  return { key: oneOf(r.key, SORT_KEYS, "name"), dir: oneOf(r.dir, ["asc", "desc"], "asc") }
}

function normalizeColumns(value: unknown): ColumnKey[] {
  if (!Array.isArray(value)) return [...COLUMN_KEYS]
  return COLUMN_KEYS.filter(c => value.includes(c))
}

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
    deleteMethod: oneOf(r.deleteMethod, ["trash", "permanent"], d.deleteMethod),
    confirmUninstall: typeof r.confirmUninstall === "boolean" ? r.confirmUninstall : d.confirmUninstall,
    checkUpdatesOnStartup: typeof r.checkUpdatesOnStartup === "boolean" ? r.checkUpdatesOnStartup : d.checkUpdatesOnStartup,
    updateChannel: oneOf(r.updateChannel, ["stable", "prerelease"], d.updateChannel),
    lastUpdateCheck:
      typeof r.lastUpdateCheck === "number" && Number.isFinite(r.lastUpdateCheck) && r.lastUpdateCheck > 0
        ? Math.floor(r.lastUpdateCheck)
        : d.lastUpdateCheck,
    scanExclusions: normalizeExclusions(r.scanExclusions),
    visibleColumns: normalizeColumns(r.visibleColumns),
    density: oneOf(r.density, ["comfortable", "compact"], d.density),
    defaultTab: oneOf(r.defaultTab, TAB_SETTINGS, d.defaultTab),
    defaultSort: normalizeSort(r.defaultSort),
    rememberView: typeof r.rememberView === "boolean" ? r.rememberView : d.rememberView,
    lastTab: oneOf(r.lastTab, TAB_SETTINGS, d.lastTab),
    lastSort: normalizeSort(r.lastSort),
    welcomeSeen: typeof r.welcomeSeen === "boolean" ? r.welcomeSeen : d.welcomeSeen,
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
