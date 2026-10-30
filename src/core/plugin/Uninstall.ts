import { invoke } from "@tauri-apps/api/core"
import { exists } from "@tauri-apps/plugin-fs"
import type { Plugin } from "./Plugin"

export interface UninstallBackend {
  createRestorePoint(description: string): Promise<void>
  trashPlugin(path: string): Promise<void>
  /** Deletes the plugin for good (no trash). Required when the delete method is "permanent". */
  deletePlugin?(path: string): Promise<void>
}

export const tauriUninstallBackend: UninstallBackend = {
  createRestorePoint: description => invoke<void>("create_restore_point", { description }),
  trashPlugin: path => invoke<void>("trash_plugin", { path }),
  deletePlugin: path => invoke<void>("delete_plugin_permanently", { path }),
}

export interface VendorUninstaller {
  displayName: string
  publisher: string | null
  kind: "exe" | "msi" | "pkg"
  commandPreview: string
  source: "registry" | "pkgutil"
}

export interface Leftover {
  path: string
  kind: "data"
  size: number | null
}

/** Backend for the single-plugin flow: the batch backend plus vendor uninstaller, leftovers and an existence check. */
export interface SingleUninstallBackend extends UninstallBackend {
  /** Returns one `<code>:<path>` entry per failure; an empty array means everything was trashed. */
  trashLeftovers(pluginPath: string, paths: string[]): Promise<string[]>
  /** Same as `trashLeftovers` but deletes for good. Required when the delete method is "permanent". */
  deleteLeftovers?(pluginPath: string, paths: string[]): Promise<string[]>
  runVendorUninstaller(path: string): Promise<void>
  pathExists(path: string): Promise<boolean>
}

export const tauriSingleBackend: SingleUninstallBackend = {
  ...tauriUninstallBackend,
  trashLeftovers: (pluginPath, paths) => invoke<string[]>("trash_leftovers", { pluginPath, paths }),
  deleteLeftovers: (pluginPath, paths) => invoke<string[]>("delete_leftovers", { pluginPath, paths }),
  runVendorUninstaller: path => invoke<void>("run_vendor_uninstaller", { path }),
  pathExists: path => exists(path),
}

export const findVendorUninstaller = (path: string) => invoke<VendorUninstaller | null>("find_vendor_uninstaller", { path })
export const findLeftovers = (path: string) => invoke<Leftover[]>("find_leftovers", { path })

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
  /** "still-present": the publisher's uninstaller finished successfully but the plugin is still on disk. */
  status: "removed" | "failed" | "still-present"
  /** How the plugin was handled; absent means moved to the trash. "delete" is a permanent deletion. */
  action?: "trash" | "vendor" | "delete"
  error?: string
}

/** Plugins whose publisher's uninstaller resolves to the same command, so it is offered (and run) once. */
export interface VendorGroup {
  key: string
  vendor: VendorUninstaller
  plugins: Plugin[]
}

/**
 * Groups plugins by the uninstall command they resolve to. Plugins without an uninstaller and kinds Deplug
 * cannot run (macOS "pkg") are left out. Groups and their plugins keep the order of the input.
 */
export function groupVendorUninstallers(entries: { plugin: Plugin; vendor: VendorUninstaller | null | undefined }[]): VendorGroup[] {
  const groups = new Map<string, VendorGroup>()
  for (const { plugin, vendor } of entries) {
    if (!vendor || vendor.kind === "pkg") continue
    const key = `${vendor.kind}\u0000${vendor.commandPreview.trim()}`
    const group = groups.get(key)
    if (group) group.plugins.push(plugin)
    else groups.set(key, { key, vendor, plugins: [plugin] })
  }
  return [...groups.values()]
}

export interface BatchResult {
  /** "cancelled" means the restore point failed and the user declined: nothing was touched. */
  status: "completed" | "cancelled"
  restorePoint: "created" | "skipped" | "failed"
  results: BatchItemResult[]
}

/** How plugins are removed when the publisher's uninstaller is not used. */
export type DeleteMethod = "trash" | "permanent"

export interface BatchOptions extends UninstallOptions {
  /** Defaults to "trash". "permanent" needs `backend.deletePlugin`. */
  deleteMethod?: DeleteMethod
  /**
   * Called before each plugin (current set) and once at the end (current null), with the results so far.
   * `active` lists every plugin being handled right now (a whole group while its uninstaller runs).
   */
  onProgress?: (completed: BatchItemResult[], current: Plugin | null, active: Plugin[]) => void
  /** Groups the user chose to remove with the publisher's uninstaller instead of the trash. */
  vendor?: {
    groups: VendorGroup[]
    backend: Pick<SingleUninstallBackend, "runVendorUninstaller" | "pathExists">
  }
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
  const vendorGroups = new Map<Plugin, VendorGroup>()
  for (const group of options.vendor?.groups ?? []) {
    for (const plugin of group.plugins) if (!vendorGroups.has(plugin)) vendorGroups.set(plugin, group)
  }
  const handled = new Set<Plugin>()
  for (const plugin of plugins) {
    if (handled.has(plugin)) continue
    const group = vendorGroups.get(plugin)
    if (group && options.vendor) {
      // One run per group, started at its first plugin; the others are settled from the same run.
      const members = group.plugins.filter(p => plugins.includes(p) && !handled.has(p))
      members.forEach(p => handled.add(p))
      onProgress?.([...results], plugin, members)
      results.push(...(await runVendorGroup(members, options.vendor.backend)))
      continue
    }
    onProgress?.([...results], plugin, [plugin])
    const permanent = options.deleteMethod === "permanent"
    const action = permanent ? { action: "delete" as const } : {}
    try {
      const path = buildPluginPath(plugin.installPath, plugin.name)
      if (permanent) {
        if (!backend.deletePlugin) throw new Error("ERR_INTERNAL:permanent delete is not available")
        await backend.deletePlugin(path)
      } else {
        await backend.trashPlugin(path)
      }
      results.push({ plugin, status: "removed", ...action })
    } catch (e) {
      results.push({ plugin, status: "failed", error: errorMessage(e), ...action })
    }
  }
  onProgress?.([...results], null, [])
  // Results follow the order of the selection, whatever order the groups ran in.
  results.sort((a, b) => plugins.indexOf(a.plugin) - plugins.indexOf(b.plugin))
  return { status: "completed", restorePoint: rp, results }
}

/**
 * Runs the publisher's uninstaller once (through its first plugin; the backend re-derives the command from that
 * path) and then checks every plugin of the group, like the single-plugin flow: gone => removed, otherwise warn.
 */
async function runVendorGroup(members: Plugin[], backend: NonNullable<BatchOptions["vendor"]>["backend"]): Promise<BatchItemResult[]> {
  try {
    await backend.runVendorUninstaller(buildPluginPath(members[0].installPath, members[0].name))
  } catch (e) {
    const error = errorMessage(e)
    return members.map(plugin => ({ plugin, status: "failed", action: "vendor", error }))
  }
  return Promise.all(
    members.map(async (plugin): Promise<BatchItemResult> => {
      // An unreadable filesystem answer is treated as "still there": better to warn than to claim success.
      const present = await backend.pathExists(buildPluginPath(plugin.installPath, plugin.name)).catch(() => true)
      return { plugin, status: present ? "still-present" : "removed", action: "vendor" }
    }),
  )
}

/** Sum of the known sizes of `plugins`, or null when none is known (a partial sum is still a useful lower bound). */
export function totalKnownSize(plugins: Plugin[], sizeOf: (plugin: Plugin) => number | null | undefined): number | null {
  let total = 0
  let known = false
  for (const plugin of plugins) {
    const size = sizeOf(plugin)
    if (typeof size === "number" && Number.isFinite(size) && size >= 0) {
      total += size
      known = true
    }
  }
  return known ? total : null
}

/** Space recovered by a run: the known sizes of the plugins that were actually removed, or null when unknown. */
export function freedBytes(results: BatchItemResult[], sizeOf: (plugin: Plugin) => number | null | undefined): number | null {
  return totalKnownSize(results.filter(r => r.status === "removed").map(r => r.plugin), sizeOf)
}

export async function uninstallPlugin(plugin: Plugin, options: UninstallOptions): Promise<UninstallResult> {
  const batch = await uninstallPlugins([plugin], options)
  if (batch.status === "cancelled") return { status: "cancelled", restorePoint: batch.restorePoint }
  const [item] = batch.results
  if (item.status === "removed") return { status: "removed", restorePoint: batch.restorePoint }
  return { status: "failed", restorePoint: batch.restorePoint, error: item.error }
}

export interface LeftoverFailure {
  path: string
  /** Backend code, normalized so that `localizeBackendError` can translate it (e.g. `ERR_LEFTOVER_TRASH_FAILED:<io>`). */
  error: string
}

/**
 * Parses one `trash_leftovers` failure entry: `ERR_LEFTOVER_INVALID:<path>` or `ERR_TRASH_FAILED(<io>):<path>`.
 * The path may itself contain colons (Windows drive letters), so only the first separator is used.
 */
export function parseLeftoverFailure(entry: string): LeftoverFailure {
  const m = /^(ERR_[A-Z_]+)(?:\(([^]*?)\))?:([^]*)$/.exec(entry)
  if (!m) return { path: entry, error: entry }
  const [, code, detail, path] = m
  if (code === "ERR_TRASH_FAILED") return { path, error: `ERR_LEFTOVER_TRASH_FAILED:${detail ?? ""}` }
  if (code === "ERR_DELETE_FAILED") return { path, error: `ERR_LEFTOVER_DELETE_FAILED:${detail ?? ""}` }
  return { path, error: code }
}

export type PluginOutcome =
  /** The plugin was moved to the trash. */
  | { action: "trash"; status: "removed" }
  | { action: "trash"; status: "failed"; error: string }
  /** The plugin was deleted for good (delete method "permanent", or a forced removal). */
  | { action: "delete"; status: "removed" }
  | { action: "delete"; status: "failed"; error: string }
  /** The vendor uninstaller finished successfully and the plugin is gone. */
  | { action: "vendor"; status: "removed" }
  /** The vendor uninstaller finished successfully but the plugin file or folder is still there. */
  | { action: "vendor"; status: "still-present" }
  | { action: "vendor"; status: "failed"; error: string }

export interface SingleUninstallOptions {
  restorePoint: boolean
  backend: SingleUninstallBackend
  confirmContinue: (errorMessage: string) => Promise<boolean>
  /** Leftover folders the user ticked; they are trashed first, while the plugin still exists. */
  leftovers: string[]
  /** How the plugin itself is removed. */
  method: "trash" | "vendor"
  /** How the plugin (method "trash") and the leftovers are deleted. Defaults to "trash". */
  deleteMethod?: DeleteMethod
  /** Called when a long step starts, so the dialog can say what it is waiting for. */
  onStep?: (step: "restorePoint" | "leftovers" | "plugin") => void
}

export interface SingleUninstallResult {
  /** "cancelled": the restore point failed and the user declined, nothing was touched. */
  status: "completed" | "cancelled"
  restorePoint: "created" | "skipped" | "failed"
  leftoversTrashed: number
  leftoverFailures: LeftoverFailure[]
  plugin: PluginOutcome | null
}

/** Order: restore point -> selected leftovers -> the plugin itself (trash or the publisher's uninstaller). */
export async function uninstallSingle(plugin: Plugin, options: SingleUninstallOptions): Promise<SingleUninstallResult> {
  const { restorePoint, backend, confirmContinue, leftovers, method, onStep } = options
  const permanent = options.deleteMethod === "permanent"
  const path = buildPluginPath(plugin.installPath, plugin.name)
  let rp: SingleUninstallResult["restorePoint"] = "skipped"

  if (restorePoint) {
    onStep?.("restorePoint")
    try {
      await backend.createRestorePoint(`Deplug: ${plugin.name}`)
      rp = "created"
    } catch (e) {
      rp = "failed"
      let proceed = false
      try {
        proceed = await confirmContinue(errorMessage(e))
      } catch {
        proceed = false
      }
      if (!proceed) return { status: "cancelled", restorePoint: rp, leftoversTrashed: 0, leftoverFailures: [], plugin: null }
    }
  }

  let leftoverFailures: LeftoverFailure[] = []
  if (leftovers.length > 0) {
    onStep?.("leftovers")
    try {
      const remove = permanent ? backend.deleteLeftovers : backend.trashLeftovers
      if (!remove) throw new Error("ERR_INTERNAL:permanent delete is not available")
      leftoverFailures = (await remove.call(backend, path, leftovers)).map(parseLeftoverFailure)
    } catch (e) {
      // The whole call was refused: every path counts as failed, the plugin step still runs.
      const error = errorMessage(e)
      leftoverFailures = leftovers.map(p => ({ path: p, error }))
    }
  }
  const leftoversTrashed = Math.max(0, leftovers.length - leftoverFailures.length)

  onStep?.("plugin")
  let outcome: PluginOutcome
  if (method === "trash" && permanent) {
    try {
      if (!backend.deletePlugin) throw new Error("ERR_INTERNAL:permanent delete is not available")
      await backend.deletePlugin(path)
      outcome = { action: "delete", status: "removed" }
    } catch (e) {
      outcome = { action: "delete", status: "failed", error: errorMessage(e) }
    }
  } else if (method === "trash") {
    try {
      await backend.trashPlugin(path)
      outcome = { action: "trash", status: "removed" }
    } catch (e) {
      outcome = { action: "trash", status: "failed", error: errorMessage(e) }
    }
  } else {
    try {
      await backend.runVendorUninstaller(path)
      // An unreadable filesystem answer is treated as "still there": better to warn than to claim success.
      const present = await backend.pathExists(path).catch(() => true)
      outcome = present ? { action: "vendor", status: "still-present" } : { action: "vendor", status: "removed" }
    } catch (e) {
      outcome = { action: "vendor", status: "failed", error: errorMessage(e) }
    }
  }
  return { status: "completed", restorePoint: rp, leftoversTrashed, leftoverFailures, plugin: outcome }
}
