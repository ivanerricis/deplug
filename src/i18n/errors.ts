import type { MessageKey, TFunction } from "./translate"

const SIMPLE: Record<string, MessageKey> = {
  ERR_INVALID_PATH: "error.invalidPath",
  ERR_NOT_FOUND: "error.notFound",
  ERR_TRASH_ACCESS_DENIED: "error.trashAccessDenied",
  ERR_DELETE_ACCESS_DENIED: "error.deleteAccessDenied",
  ERR_ELEVATION_CANCELLED: "error.elevationCancelled",
  ERR_ELEVATION_UNSUPPORTED: "error.elevationUnsupported",
  ERR_RESTORE_UNSUPPORTED: "error.restoreUnsupported",
  ERR_RESTORE_UAC_CANCELLED: "error.restoreUacCancelled",
  ERR_RESTORE_PROTECTION_DISABLED: "error.restoreProtectionDisabled",
  ERR_RESTORE_FREQUENCY: "error.restoreFrequency",
  ERR_LEFTOVER_INVALID: "error.leftoverInvalid",
  ERR_VENDOR_UNSUPPORTED: "error.vendorUnsupported",
  ERR_VENDOR_NOT_FOUND: "error.vendorNotFound",
  ERR_VENDOR_TIMEOUT: "error.vendorTimeout",
  ERR_VENDOR_BAD_COMMAND: "error.vendorBadCommand",
  ERR_VENDOR_ELEVATION_REQUIRED: "error.vendorElevationRequired",
  WARN_NOT_WRITABLE: "warn.notWritable",
  WARN_APP_TRANSLOCATION: "warn.appTranslocation",
}

/** Codes that carry a detail after a colon, e.g. `ERR_TRASH_FAILED:permission denied` or `ERR_INTERNAL:<detail>`. */
const WITH_DETAIL: Record<string, MessageKey> = {
  ERR_TRASH_FAILED: "error.trashFailed",
  ERR_DELETE_FAILED: "error.deleteFailed",
  ERR_LEFTOVER_DELETE_FAILED: "error.leftoverDeleteFailed",
  ERR_RESTORE_FAILED: "error.restoreFailed",
  ERR_INTERNAL: "error.internal",
  ERR_LEFTOVER_TRASH_FAILED: "error.leftoverTrashFailed",
  ERR_VENDOR_LAUNCH: "error.vendorLaunch",
  ERR_VENDOR_FAILED: "error.vendorFailed",
}

/** Maps a stable backend error/warning code to a localized message. Unknown strings are returned unchanged. */
export function localizeBackendError(code: string, t: TFunction): string {
  const trimmed = code.trim()
  // Older builds returned the raw `trash` crate text for a Recycle Bin move denied by Windows.
  if (trimmed.includes("Some operations were aborted")) return t("error.trashAccessDenied")
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
