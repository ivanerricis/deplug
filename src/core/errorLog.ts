/** In-memory ring buffer of the errors the app showed to the user, for the diagnostics text. */

export interface ErrorEntry {
  /** ISO 8601 timestamp. */
  time: string
  /** Where it came from: "scan", "uninstall", "export", "update", ... */
  source: string
  message: string
}

export const ERROR_LOG_CAPACITY = 20
const MAX_MESSAGE_LENGTH = 300

const entries: ErrorEntry[] = []

/**
 * Replaces Windows (drive or UNC) and POSIX multi-segment paths so no folder or plugin name is kept.
 * A path may contain spaces, so it runs up to the next ": ", quote or the end of the text.
 */
export function redactPaths(message: string): string {
  return message
    .replace(/[A-Za-z]:[\\/][^"'<>|*?\n]*?(?=: |["']|\s*$)/g, "<path>")
    .replace(/\\\\[^"'<>|*?\n]*?(?=: |["']|\s*$)/g, "<path>")
    .replace(/(?<![\w<])\/[^\s"'<>|*?/]+\/[^"'<>|*?\n]*?(?=: |["']|\s*$)/g, "<path>")
}

/** Records an error; keeps only the newest ERROR_LOG_CAPACITY entries. */
export function pushError(source: string, error: unknown, now: Date = new Date()): void {
  const raw = error instanceof Error ? error.message : String(error)
  const message = redactPaths(raw).replace(/\s+/g, " ").trim().slice(0, MAX_MESSAGE_LENGTH)
  entries.push({ time: now.toISOString(), source, message })
  if (entries.length > ERROR_LOG_CAPACITY) entries.splice(0, entries.length - ERROR_LOG_CAPACITY)
}

/** Oldest first. */
export function getErrors(): ErrorEntry[] {
  return entries.map(e => ({ ...e }))
}

export function clearErrors(): void {
  entries.length = 0
}
