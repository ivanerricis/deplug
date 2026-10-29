import { invoke } from "@tauri-apps/api/core"
import type { Plugin } from "./Plugin"

export interface UninstallBackend {
  createRestorePoint(description: string): Promise<void>
  trashPlugin(path: string): Promise<void>
}

export const tauriUninstallBackend: UninstallBackend = {
  createRestorePoint: description => invoke<void>("create_restore_point", { description }),
  trashPlugin: path => invoke<void>("trash_plugin", { path }),
}

export interface UninstallOptions {
  restorePoint: boolean
  backend: UninstallBackend
  /** Called when the restore point fails; resolve true to go on without it. */
  confirmContinue: (errorMessage: string) => Promise<boolean>
}

export interface UninstallResult {
  status: "removed" | "cancelled" | "failed"
  restorePoint: "created" | "skipped" | "failed"
  error?: string
}

export function errorMessage(e: unknown): string {
  if (typeof e === "string") return e
  if (e instanceof Error) return e.message
  if (e && typeof e === "object" && "message" in e && typeof e.message === "string") return e.message
  return String(e)
}

/** Joins installPath and name keeping the separator style of installPath, without duplicate separators. */
export function buildPluginPath(installPath: string, name: string): string {
  const sep = installPath.includes("\\") && !installPath.includes("/") ? "\\" : "/"
  const base = installPath.replace(/[\\/]+$/, "")
  const leaf = name.replace(/^[\\/]+/, "")
  if (base === "" && /^[\\/]/.test(installPath)) return sep + leaf // root directory
  return `${base}${sep}${leaf}`
}

export async function uninstallPlugin(plugin: Plugin, options: UninstallOptions): Promise<UninstallResult> {
  const { restorePoint, backend, confirmContinue } = options
  let rp: UninstallResult["restorePoint"] = "skipped"

  if (restorePoint) {
    try {
      await backend.createRestorePoint(`Plugin Uninstaller: ${plugin.name}`)
      rp = "created"
    } catch (e) {
      rp = "failed"
      let proceed = false
      try {
        proceed = await confirmContinue(errorMessage(e))
      } catch {
        proceed = false
      }
      if (!proceed) return { status: "cancelled", restorePoint: rp }
    }
  }

  try {
    await backend.trashPlugin(buildPluginPath(plugin.installPath, plugin.name))
    return { status: "removed", restorePoint: rp }
  } catch (e) {
    return { status: "failed", restorePoint: rp, error: errorMessage(e) }
  }
}
