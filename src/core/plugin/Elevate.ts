import { invoke } from "@tauri-apps/api/core"
import { buildPluginPath, errorMessage, type BatchItemResult } from "./Uninstall"

/** Backend call that moves several plugins to the Recycle Bin from an elevated process (one UAC prompt). */
export interface ElevatedBackend {
  /** Returns one `<code>:<path>` entry per failed path; an empty array means everything was moved. */
  trashPluginsElevated(paths: string[]): Promise<string[]>
  /** Same for a permanent deletion (no Recycle Bin). Needed to retry items removed with the "permanent" method. */
  deletePluginsElevated?(paths: string[]): Promise<string[]>
}

export const tauriElevatedBackend: ElevatedBackend = {
  trashPluginsElevated: paths => invoke<string[]>("trash_plugins_elevated", { paths }),
  deletePluginsElevated: paths => invoke<string[]>("delete_plugins_elevated", { paths }),
}

/** True for the stable access-denied code and for the raw text older builds returned. */
export function isAccessDeniedError(error: string | undefined): boolean {
  if (!error) return false
  return error.includes("ERR_TRASH_ACCESS_DENIED") || error.includes("ERR_DELETE_ACCESS_DENIED") || error.includes("Some operations were aborted")
}

/** Failed items that an elevated retry could fix. Never any off Windows or when the process is already elevated. */
export function elevationCandidates(items: BatchItemResult[], isWindows: boolean, alreadyElevated = false): BatchItemResult[] {
  if (!isWindows || alreadyElevated) return []
  return items.filter(i => i.status === "failed" && isAccessDeniedError(i.error))
}

/** Parses one failure entry `ERR_TRASH_FAILED(<message>):<path>`; the path may contain colons. */
export function parseElevatedFailure(entry: string): { path: string; error: string } {
  const m = /^(ERR_[A-Z_]+)(?:\(([^]*?)\))?:([^]*)$/.exec(entry)
  if (!m) return { path: entry, error: entry }
  const [, code, detail, path] = m
  return { path, error: code === "ERR_TRASH_FAILED" || code === "ERR_DELETE_FAILED" ? `${code}:${detail ?? ""}` : code }
}

export interface ElevatedRetryResult {
  items: BatchItemResult[]
  /** Set when the whole call failed (UAC cancelled, unsupported...): nothing changed and the retry stays available. */
  callError?: string
}

/**
 * Retries the access-denied items with one elevated call and merges the outcome:
 * moved => removed, failed paths keep their own error, a rejected call changes nothing.
 */
export async function retryElevated(items: BatchItemResult[], isWindows: boolean, backend: ElevatedBackend, alreadyElevated = false): Promise<ElevatedRetryResult> {
  const candidates = elevationCandidates(items, isWindows, alreadyElevated)
  if (candidates.length === 0) return { items }
  const pathOf = (i: BatchItemResult) => buildPluginPath(i.plugin.installPath, i.plugin.name)
  // Items removed with the "permanent" method are retried with the elevated delete, the others with the elevated trash.
  const groups = [
    { items: candidates.filter(i => i.action !== "delete"), call: backend.trashPluginsElevated.bind(backend), action: undefined },
    { items: candidates.filter(i => i.action === "delete"), call: backend.deletePluginsElevated?.bind(backend), action: "delete" as const },
  ]
  const replacements = new Map<BatchItemResult, BatchItemResult>()
  let callError: string | undefined
  for (const group of groups) {
    if (group.items.length === 0) continue
    let failures: string[]
    try {
      if (!group.call) throw new Error("ERR_ELEVATION_UNSUPPORTED")
      failures = await group.call(group.items.map(pathOf))
    } catch (e) {
      callError ??= errorMessage(e)
      continue
    }
    const failed = new Map(failures.map(parseElevatedFailure).map(f => [f.path, f.error]))
    const extra = group.action ? { action: group.action } : {}
    for (const item of group.items) {
      const error = failed.get(pathOf(item))
      replacements.set(item, error === undefined ? { plugin: item.plugin, status: "removed", ...extra } : { plugin: item.plugin, status: "failed", error, ...extra })
    }
  }
  if (replacements.size === 0) return { items, callError }
  return { items: items.map(item => replacements.get(item) ?? item), ...(callError !== undefined && { callError }) }
}

/** Message key for the restore point line of the results summary, or null when there is nothing to say. */
export function restoreOutcomeKey(
  outcome: "created" | "skipped" | "failed",
  requested: boolean,
): "uninstall.result.restorePointCreated" | "uninstall.result.restorePointSkipped" | "uninstall.result.restorePointFailed" | null {
  if (outcome === "created") return "uninstall.result.restorePointCreated"
  if (outcome === "failed") return "uninstall.result.restorePointFailed"
  return requested ? "uninstall.result.restorePointSkipped" : null
}
