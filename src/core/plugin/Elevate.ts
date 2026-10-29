import { invoke } from "@tauri-apps/api/core"
import { buildPluginPath, errorMessage, type BatchItemResult } from "./Uninstall"

/** Backend call that moves several plugins to the Recycle Bin from an elevated process (one UAC prompt). */
export interface ElevatedBackend {
  /** Returns one `<code>:<path>` entry per failed path; an empty array means everything was moved. */
  trashPluginsElevated(paths: string[]): Promise<string[]>
}

export const tauriElevatedBackend: ElevatedBackend = {
  trashPluginsElevated: paths => invoke<string[]>("trash_plugins_elevated", { paths }),
}

/** True for the stable access-denied code and for the raw text older builds returned. */
export function isAccessDeniedError(error: string | undefined): boolean {
  if (!error) return false
  return error.includes("ERR_TRASH_ACCESS_DENIED") || error.includes("Some operations were aborted")
}

/** Failed items that an elevated retry could fix. Never any off Windows. */
export function elevationCandidates(items: BatchItemResult[], isWindows: boolean): BatchItemResult[] {
  if (!isWindows) return []
  return items.filter(i => i.status === "failed" && isAccessDeniedError(i.error))
}

/** Parses one failure entry `ERR_TRASH_FAILED(<message>):<path>`; the path may contain colons. */
export function parseElevatedFailure(entry: string): { path: string; error: string } {
  const m = /^(ERR_[A-Z_]+)(?:\(([^]*?)\))?:([^]*)$/.exec(entry)
  if (!m) return { path: entry, error: entry }
  const [, code, detail, path] = m
  return { path, error: code === "ERR_TRASH_FAILED" ? `ERR_TRASH_FAILED:${detail ?? ""}` : code }
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
export async function retryElevated(items: BatchItemResult[], isWindows: boolean, backend: ElevatedBackend): Promise<ElevatedRetryResult> {
  const candidates = elevationCandidates(items, isWindows)
  if (candidates.length === 0) return { items }
  const pathOf = (i: BatchItemResult) => buildPluginPath(i.plugin.installPath, i.plugin.name)
  let failures: string[]
  try {
    failures = await backend.trashPluginsElevated(candidates.map(pathOf))
  } catch (e) {
    return { items, callError: errorMessage(e) }
  }
  const failed = new Map(failures.map(parseElevatedFailure).map(f => [f.path, f.error]))
  const retried = new Set(candidates)
  return {
    items: items.map(item => {
      if (!retried.has(item)) return item
      const error = failed.get(pathOf(item))
      return error === undefined ? { plugin: item.plugin, status: "removed" } : { plugin: item.plugin, status: "failed", error }
    }),
  }
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
