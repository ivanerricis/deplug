import type { MessageKey, TFunction } from "./translate"

const SIMPLE: Record<string, MessageKey> = {
  ERR_INVALID_PATH: "error.invalidPath",
  ERR_NOT_FOUND: "error.notFound",
  ERR_RESTORE_UNSUPPORTED: "error.restoreUnsupported",
  ERR_RESTORE_UAC_CANCELLED: "error.restoreUacCancelled",
  ERR_RESTORE_PROTECTION_DISABLED: "error.restoreProtectionDisabled",
  ERR_RESTORE_FREQUENCY: "error.restoreFrequency",
  WARN_NOT_WRITABLE: "warn.notWritable",
  WARN_APP_TRANSLOCATION: "warn.appTranslocation",
}

/** Codes that carry a detail after a colon, e.g. `ERR_TRASH_FAILED:permission denied` or `ERR_INTERNAL:<detail>`. */
const WITH_DETAIL: Record<string, MessageKey> = {
  ERR_TRASH_FAILED: "error.trashFailed",
  ERR_RESTORE_FAILED: "error.restoreFailed",
  ERR_INTERNAL: "error.internal",
}

/** Maps a stable backend error/warning code to a localized message. Unknown strings are returned unchanged. */
export function localizeBackendError(code: string, t: TFunction): string {
  const trimmed = code.trim()
  if (Object.prototype.hasOwnProperty.call(SIMPLE, trimmed)) return t(SIMPLE[trimmed])
  const colon = trimmed.indexOf(":")
  if (colon > 0) {
    const head = trimmed.slice(0, colon)
    if (Object.prototype.hasOwnProperty.call(WITH_DETAIL, head)) {
      return t(WITH_DETAIL[head], { detail: trimmed.slice(colon + 1).trim() })
    }
  }
  return code
}
