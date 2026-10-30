import type { ErrorEntry } from "./errorLog"
import type { TFunction } from "@/i18n/translate"
import type { AppSettings } from "./settings/AppSettings"

export interface DiagnosticsInput {
  t: TFunction
  /** Running app version, or null when unknown. */
  version: string | null
  /** Human OS name, e.g. "Windows". */
  osName: string
  /** Backend "arch / family" string, when the backend reports one. */
  osInfo?: string
  userAgent?: string
  portable: boolean
  /** Windows only: whether the session has administrator rights; undefined hides the line. */
  elevated?: boolean
  settings: Pick<
    AppSettings,
    | "language"
    | "theme"
    | "restorePointDefault"
    | "scanOnStartup"
    | "customScanDepth"
    | "runAsAdmin"
    | "checkUpdatesOnStartup"
    | "updateChannel"
  >
  /** Enabled built-in folders and user-added folders: only the counts are reported. */
  systemFolderCount: number
  customFolderCount: number
  /** Plugins per format, e.g. { VST3: 120 }. */
  formatCounts: Record<string, number>
  archCounts?: Partial<Record<"x64" | "x86" | "arm64" | "universal" | "mixed", number>>
  errors: ErrorEntry[]
}

const FORMATS = ["VST2", "VST3", "AAX", "AU"]
const ARCHS = ["x64", "x86", "arm64", "universal", "mixed"] as const

/** Builds the text behind "Copy diagnostics". It never contains plugin names or paths, only counts. */
export function buildDiagnostics(i: DiagnosticsInput): string {
  const { t, settings: s } = i
  const on = (v: boolean) => (v ? t("diagnostics.on") : t("diagnostics.off"))
  const formats = FORMATS.filter(f => (i.formatCounts[f] ?? 0) > 0).map(f => `${f} ${i.formatCounts[f]}`)
  const total = FORMATS.reduce((n, f) => n + (i.formatCounts[f] ?? 0), 0)
  const archs = ARCHS.filter(a => (i.archCounts?.[a] ?? 0) > 0).map(a => `${t(`arch.${a}`)} ${i.archCounts?.[a]}`)
  const osParts = [i.osName, i.osInfo].filter(Boolean).join(" ")

  const lines = [
    "Deplug",
    `${t("diagnostics.version")}: ${i.version ?? t("settings.about.unknown")}`,
    `${t("diagnostics.os")}: ${osParts}`,
    ...(i.userAgent ? [`${t("diagnostics.userAgent")}: ${i.userAgent}`] : []),
    `${t("diagnostics.mode")}: ${i.portable ? t("settings.about.modePortable") : t("settings.about.modeNormal")}`,
    ...(i.elevated === undefined ? [] : [`${t("diagnostics.admin")}: ${i.elevated ? t("settings.about.yes") : t("settings.about.no")}`]),
    `${t("diagnostics.settings")}:`,
    `  ${t("diagnostics.language")}: ${s.language}`,
    `  ${t("diagnostics.theme")}: ${s.theme}`,
    `  ${t("diagnostics.restoreDefault")}: ${on(s.restorePointDefault)}`,
    `  ${t("diagnostics.scanOnStartup")}: ${on(s.scanOnStartup)}`,
    `  ${t("diagnostics.scanDepth")}: ${s.customScanDepth}`,
    ...(i.elevated === undefined ? [] : [`  ${t("diagnostics.runAsAdmin")}: ${on(s.runAsAdmin)}`]),
    `  ${t("diagnostics.updateCheck")}: ${on(s.checkUpdatesOnStartup)}`,
    `  ${t("diagnostics.updateChannel")}: ${s.updateChannel}`,
    `${t("diagnostics.scanFolders")}: ${t("diagnostics.folderCounts", { system: i.systemFolderCount, custom: i.customFolderCount })}`,
    `${t("diagnostics.plugins")}: ${total}${formats.length ? ` (${formats.join(", ")})` : ""}`,
    ...(archs.length ? [`${t("diagnostics.architectures")}: ${archs.join(", ")}`] : []),
    `${t("diagnostics.recentErrors")}: ${i.errors.length === 0 ? t("diagnostics.none") : ""}`,
    ...i.errors.map(e => `  - ${e.time} [${e.source}] ${e.message}`),
  ]
  return lines.join("\n")
}
