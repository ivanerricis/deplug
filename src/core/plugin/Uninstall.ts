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

export interface BatchItemResult {
  plugin: Plugin
  status: "removed" | "failed"
  error?: string
}

export interface BatchResult {
  /** "cancelled" means the restore point failed and the user declined: nothing was touched. */
  status: "completed" | "cancelled"
  restorePoint: "created" | "skipped" | "failed"
  results: BatchItemResult[]
}

export interface BatchOptions extends UninstallOptions {
  /** Called before each plugin (current set) and once at the end (current null), with the results so far. */
  onProgress?: (completed: BatchItemResult[], current: Plugin | null) => void
}

/** One restore point for the whole batch, then each plugin is trashed in turn; a failure never stops the rest. */
export async function uninstallPlugins(plugins: Plugin[], options: BatchOptions): Promise<BatchResult> {
  const { restorePoint, backend, confirmContinue, onProgress } = options
  let rp: BatchResult["restorePoint"] = "skipped"

  if (restorePoint && plugins.length > 0) {
    const description = plugins.length === 1 ? `Deplug: ${plugins[0].name}` : `Deplug: ${plugins.length} plugins`
    try {
      await backend.createRestorePoint(description)
      rp = "created"
    } catch (e) {
      rp = "failed"
      let proceed = false
      try {
        proceed = await confirmContinue(errorMessage(e))
      } catch {
        proceed = false
      }
      if (!proceed) return { status: "cancelled", restorePoint: rp, results: [] }
    }
  }

  const results: BatchItemResult[] = []
  for (const plugin of plugins) {
    onProgress?.([...results], plugin)
    try {
      await backend.trashPlugin(buildPluginPath(plugin.installPath, plugin.name))
      results.push({ plugin, status: "removed" })
    } catch (e) {
      results.push({ plugin, status: "failed", error: errorMessage(e) })
    }
  }
  onProgress?.([...results], null)
  return { status: "completed", restorePoint: rp, results }
}

export async function uninstallPlugin(plugin: Plugin, options: UninstallOptions): Promise<UninstallResult> {
  const batch = await uninstallPlugins([plugin], options)
  if (batch.status === "cancelled") return { status: "cancelled", restorePoint: batch.restorePoint }
  const [item] = batch.results
  if (item.status === "removed") return { status: "removed", restorePoint: batch.restorePoint }
  return { status: "failed", restorePoint: batch.restorePoint, error: item.error }
}
