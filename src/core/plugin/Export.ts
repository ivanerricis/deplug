import type { Plugin } from "./Plugin"
import { knownArch, type MetaMap } from "./Meta"
import { buildPluginPath } from "./Uninstall"

export type ExportFormat = "csv" | "txt"

/** Excel only reads UTF-8 reliably when the file starts with a byte order mark. */
const BOM = "\uFEFF"
const CSV_HEADER = ["format", "name", "path", "size", "modified", "architecture", "vendor"]

/** Quotes a CSV field when it holds a comma, a quote or a line break; quotes are doubled. */
export function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** Unix seconds to ISO 8601 (UTC); empty when unknown or out of range. */
function isoDate(seconds: number | null | undefined): string {
  if (seconds == null) return ""
  const d = new Date(seconds * 1000)
  return Number.isNaN(d.getTime()) ? "" : d.toISOString()
}

/** CSV with a UTF-8 BOM and CRLF rows: format, name, path, size (bytes), modified (ISO 8601), architecture, vendor. */
export function pluginsToCsv(plugins: Plugin[], meta?: MetaMap): string {
  const rows = plugins.map(p => {
    const path = buildPluginPath(p.installPath, p.name)
    const m = meta?.get(path)
    return [p.type, p.name, path, m?.size == null ? "" : String(m.size), isoDate(m?.modified), knownArch(m) ?? "", m?.vendor?.trim() ?? ""]
  })
  return BOM + [CSV_HEADER, ...rows].map(r => r.map(csvField).join(",")).join("\r\n") + "\r\n"
}

/** Plain text: the full path of one plugin per line. */
export function pluginsToText(plugins: Plugin[]): string {
  return plugins.map(p => buildPluginPath(p.installPath, p.name) + "\n").join("")
}

export function exportPlugins(format: ExportFormat, plugins: Plugin[], meta?: MetaMap): string {
  return format === "csv" ? pluginsToCsv(plugins, meta) : pluginsToText(plugins)
}

/** Default file name offered by the save dialog, e.g. deplug-plugins-2026-10-30.csv (local date). */
export function exportFileName(format: ExportFormat, now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `deplug-plugins-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.${format}`
}
