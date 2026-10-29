const UNITS = ["B", "KB", "MB", "GB", "TB"]

/** Human readable size such as "12.4 MB" (1024-based, like the OS file managers). Null gives an em dash. */
export function formatBytes(bytes: number | null | undefined, locale?: string): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "—"
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit++
  }
  if (unit === 0) return `${Math.round(value)} B`
  const digits = value >= 100 ? 0 : 1
  const num = new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)
  return `${num} ${UNITS[unit]}`
}

/** Localized short date from unix seconds; null gives an em dash. */
export function formatDate(seconds: number | null | undefined, locale?: string): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—"
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" }).format(new Date(seconds * 1000))
}

/**
 * Compact display form of a folder: the home directory becomes "~" and very long paths
 * keep their first and last segments with an ellipsis in the middle.
 */
export function shortenPath(path: string, home = "", maxLength = 56): string {
  let p = path
  if (home && (p === home || p.startsWith(home + "/") || p.startsWith(home + "\\"))) p = "~" + p.slice(home.length)
  if (p.length <= maxLength) return p
  const sep = p.includes("/") ? "/" : "\\"
  const parts = p.split(sep)
  if (parts.length <= 3) return p
  const head = parts[0] === "" ? sep + parts[1] : parts[0]
  const tail = parts.slice(-2).join(sep)
  const out = `${head}${sep}…${sep}${tail}`
  return out.length < p.length ? out : p
}
