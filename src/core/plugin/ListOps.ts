import type { Plugin } from "./Plugin"
import type { MetaMap } from "./Meta"
import { buildPluginPath } from "./Uninstall"

export type SortKey = "name" | "path" | "size" | "modified"
export type SortDir = "asc" | "desc"
export interface SortState {
  key: SortKey
  dir: SortDir
}

/** Stable identity of a plugin within a scan. */
export function pluginKey(p: Plugin): string {
  return `${p.type}\u0000${p.installPath}\u0000${p.name}`
}

/** Lowercases and removes diacritics so "Éclat" is found by "eclat" and "ÉCLAT". */
export function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().normalize("NFC")
}

/** Case-insensitive substring match over name and install path. An empty query matches everything. */
export function filterPlugins(plugins: Plugin[], query: string): Plugin[] {
  const q = fold(query.trim())
  if (q === "") return plugins
  return plugins.filter(p => fold(p.name).includes(q) || fold(p.installPath).includes(q))
}

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" })

/** Natural ordering: "Plug 2" < "Plug 10", accent and case insensitive, with a code point tie-break. */
export function naturalCompare(a: string, b: string): number {
  const c = collator.compare(a, b)
  if (c !== 0) return c
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * Returns a sorted copy; ties fall back to the other column so the order is deterministic.
 * Size and date sorts read `meta` (keyed by the plugin full path); plugins without a value always go last.
 */
export function sortPlugins(plugins: Plugin[], sort: SortState, meta?: MetaMap): Plugin[] {
  const sign = sort.dir === "asc" ? 1 : -1
  const byName = (a: Plugin, b: Plugin) => naturalCompare(a.name, b.name) || naturalCompare(a.installPath, b.installPath)
  if (sort.key === "size" || sort.key === "modified") {
    const field = sort.key
    const val = (p: Plugin) => meta?.get(buildPluginPath(p.installPath, p.name))?.[field] ?? null
    return [...plugins].sort((a, b) => {
      const va = val(a)
      const vb = val(b)
      if (va === null || vb === null) return va === vb ? byName(a, b) : va === null ? 1 : -1
      return sign * (va - vb) || byName(a, b)
    })
  }
  const byPath = (a: Plugin, b: Plugin) => naturalCompare(a.installPath, b.installPath) || naturalCompare(a.name, b.name)
  const cmp = sort.key === "name" ? byName : byPath
  return [...plugins].sort((a, b) => sign * cmp(a, b))
}

const KNOWN_EXTENSIONS = /\.(vst3|vst|dll|so|component|aaxplugin)$/i
const ARCH_SUFFIX = /(?:[ _]x64|[ _]\(x64\))$/i

/** Name without extension and 64-bit suffix, case-folded: the identity used to spot duplicates. */
export function normalizeBaseName(name: string): string {
  const base = name.normalize("NFC").trim().replace(KNOWN_EXTENSIONS, "").trim().replace(ARCH_SUFFIX, "")
  return base.replace(/\s+/g, " ").trim().toLowerCase()
}

/**
 * Maps the key of every plugin that has a twin to the list of its other copies
 * (other formats or other install folders). Plugins without twins are absent.
 */
export function findDuplicates(plugins: Plugin[]): Map<string, Plugin[]> {
  const groups = new Map<string, Plugin[]>()
  const seen = new Set<string>()
  for (const p of plugins) {
    const k = pluginKey(p)
    if (seen.has(k)) continue
    seen.add(k)
    const base = normalizeBaseName(p.name)
    if (base === "") continue
    const group = groups.get(base)
    if (group) group.push(p)
    else groups.set(base, [p])
  }
  const result = new Map<string, Plugin[]>()
  for (const group of groups.values()) {
    if (group.length < 2) continue
    for (const p of group) result.set(pluginKey(p), group.filter(o => o !== p))
  }
  return result
}

export interface FolderRun {
  folder: string
  /** Index of the first item of this run in the source list. */
  start: number
  length: number
}

/** Splits an ordered list into runs of consecutive plugins that live in the same folder. */
export function folderRuns(plugins: Plugin[]): FolderRun[] {
  const runs: FolderRun[] = []
  plugins.forEach((p, i) => {
    const folder = p.installPath
    const last = runs[runs.length - 1]
    if (last && last.folder === folder) last.length++
    else runs.push({ folder, start: i, length: 1 })
  })
  return runs
}

/**
 * Whether to print each folder once as a group header (few, long runs) instead of
 * repeating the folder under every name (many short runs).
 */
export function shouldGroupByFolder(runs: FolderRun[], count: number): boolean {
  return runs.length <= Math.max(1, Math.floor(count / 3))
}
