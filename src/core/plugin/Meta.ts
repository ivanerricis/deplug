import { invoke } from "@tauri-apps/api/core"

/** CPU architecture of a plugin binary, as detected by the backend. */
export type PluginArch = "x86" | "x64" | "arm64" | "universal" | "mixed" | "unknown"

/** Integrity of a plugin: a zero-byte file / empty folder, or a bundle whose binary is absent or zero size. */
export type PluginHealth = "ok" | "empty" | "missing-binary"

/** File metadata reported by the backend; null when it could not be read. */
export interface PluginMeta {
  path: string
  size: number | null
  /** Last modification time, unix seconds. */
  modified: number | null
  /** Detected architecture; null/undefined when the backend could not tell (or is older). */
  arch?: PluginArch | null
  /** Detected integrity; null/undefined when unknown (or the backend is older). */
  health?: PluginHealth | null
  /** Producer name from the plugin's metadata or the installed-program entry; null/undefined when unknown. */
  vendor?: string | null
}

export type MetaMap = ReadonlyMap<string, PluginMeta>
export type MetaInvoke = (paths: string[]) => Promise<PluginMeta[]>

const defaultInvoke: MetaInvoke = paths => invoke<PluginMeta[]>("plugin_meta", { paths })

/**
 * Fetches metadata in small batches so the list can fill in progressively.
 * Failures are swallowed: a missing value just renders as a dash.
 */
export async function fetchPluginMeta(
  paths: string[],
  onBatch: (batch: PluginMeta[]) => void,
  options: { batchSize?: number; cancelled?: () => boolean; invokeFn?: MetaInvoke } = {},
): Promise<void> {
  const { batchSize = 60, cancelled = () => false, invokeFn = defaultInvoke } = options
  for (let i = 0; i < paths.length; i += batchSize) {
    if (cancelled()) return
    try {
      const batch = await invokeFn(paths.slice(i, i + batchSize))
      if (cancelled()) return
      if (Array.isArray(batch)) onBatch(batch)
    } catch {
      // Metadata is optional; keep going with the next batch.
    }
  }
}

/** The architecture when it is a definite answer, otherwise null ("unknown" counts as not known). */
export function knownArch(meta: PluginMeta | undefined): Exclude<PluginArch, "unknown"> | null {
  const a = meta?.arch
  return a && a !== "unknown" ? a : null
}

/** True when the backend reported the plugin as empty or as a bundle without its binary. */
export function isDamaged(meta: PluginMeta | undefined): boolean {
  return meta?.health === "empty" || meta?.health === "missing-binary"
}
