import type { Plugin } from "./Plugin"

export type SortKey = "name" | "path"
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

/** Returns a sorted copy; ties fall back to the other column so the order is deterministic. */
export function sortPlugins(plugins: Plugin[], sort: SortState): Plugin[] {
  const sign = sort.dir === "asc" ? 1 : -1
  const first = (p: Plugin) => (sort.key === "name" ? p.name : p.installPath)
  const second = (p: Plugin) => (sort.key === "name" ? p.installPath : p.name)
  return [...plugins].sort(
    (a, b) => sign * (naturalCompare(first(a), first(b)) || naturalCompare(second(a), second(b))),
  )
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
