import { invoke } from "@tauri-apps/api/core"

/** File metadata reported by the backend; null when it could not be read. */
export interface PluginMeta {
  path: string
  size: number | null
  /** Last modification time, unix seconds. */
  modified: number | null
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
