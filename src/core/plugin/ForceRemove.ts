import { invoke } from "@tauri-apps/api/core"
import { isAccessDeniedError, parseElevatedFailure, tauriElevatedBackend, type ElevatedBackend } from "./Elevate"
import { buildPluginPath, errorMessage, type BatchItemResult } from "./Uninstall"

/** Backend calls used by a forced removal: a permanent delete, and its elevated variant for access-denied files. */
export interface ForceRemoveBackend {
  deletePlugin(path: string): Promise<void>
  deletePluginsElevated?: ElevatedBackend["deletePluginsElevated"]
}

export const tauriForceBackend: ForceRemoveBackend = {
  deletePlugin: path => invoke<void>("delete_plugin_permanently", { path }),
  deletePluginsElevated: tauriElevatedBackend.deletePluginsElevated,
}

/** Errors for which deleting again cannot help: the plugin is already gone or the path is not one Deplug may touch. */
const NOT_FORCEABLE = ["ERR_NOT_FOUND", "ERR_INVALID_PATH"]

/** True when a "Force removal" makes sense: the removal failed, or the publisher's uninstaller left the plugin behind. */
export function canForceRemove(item: BatchItemResult): boolean {
  if (item.status === "still-present") return true
  if (item.status !== "failed") return false
  return !NOT_FORCEABLE.some(code => item.error?.includes(code))
}

export interface ForceRemoveOptions {
  isWindows: boolean
  /** The process already runs as administrator, so an elevated retry would change nothing. */
  alreadyElevated: boolean
  backend: ForceRemoveBackend
}

/**
 * Deletes the plugin of `item` for good. On Windows an access-denied answer is retried once from an elevated
 * process (one UAC prompt). The result keeps the error text (for example "file in use") when it still fails.
 */
export async function forceRemove(item: BatchItemResult, options: ForceRemoveOptions): Promise<BatchItemResult> {
  const { isWindows, alreadyElevated, backend } = options
  const path = buildPluginPath(item.plugin.installPath, item.plugin.name)
  const ok: BatchItemResult = { plugin: item.plugin, status: "removed", action: "delete" }
  const fail = (error: string): BatchItemResult => ({ plugin: item.plugin, status: "failed", action: "delete", error })
  try {
    await backend.deletePlugin(path)
    return ok
  } catch (e) {
    const error = errorMessage(e)
    if (!isWindows || alreadyElevated || !backend.deletePluginsElevated || !isAccessDeniedError(error)) return fail(error)
  }
  try {
    const failures = await backend.deletePluginsElevated([path])
    const failed = failures.map(parseElevatedFailure).find(f => f.path === path)
    return failed ? fail(failed.error) : ok
  } catch (e) {
    return fail(errorMessage(e))
  }
}
