import type { Plugin } from "./Plugin"
import type { MetaMap } from "./Meta"
import { naturalCompare } from "./ListOps"
import { buildPluginPath, totalKnownSize } from "./Uninstall"

/** Key of the group that holds plugins whose producer is not known. */
export const UNKNOWN_VENDOR_KEY = "__unknown"

export type VendorSortKey = "name" | "count" | "size"
export interface VendorSort {
  key: VendorSortKey
  dir: "asc" | "desc"
}

export interface VendorGroup {
  /** Normalized producer name, or UNKNOWN_VENDOR_KEY. */
  key: string
  /** Display name: the most frequent original spelling (the "Unknown" label for the unknown group). */
  name: string
  plugins: Plugin[]
  /** Sum of the known plugin sizes in bytes (0 when none is known). */
  totalSize: number
}

/** Trailing words that only describe the kind of company; removed from the end of a name only. */
const SUFFIX_WORDS = new Set(["inc", "llc", "ltd", "limited", "gmbh", "ag", "srl", "sarl", "co", "corp", "corporation", "bv", "ab", "oy", "software", "audio", "plugins"])

/**
 * Comparison key for a producer name: case, accents, punctuation and trailing company words
 * ("Inc.", "GmbH", "Software", "Audio", ...) do not matter, so "FabFilter", "FABFILTER" and
 * "FabFilter Software Instruments" end up in one group. Returns "" for a blank name.
 */
export function normalizeVendorKey(name: string): string {
  const words = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    // "s.r.l." -> "srl": a period that follows a single letter belongs to an abbreviation.
    .replace(/(?<![a-z0-9])([a-z])\./g, "$1")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
  // "Software Instruments" is the only two-word tail worth removing; "Instruments" alone is a real name part.
  const n = words.length
  if (n > 2 && words[n - 2] === "software" && words[n - 1] === "instruments") words.length = n - 2
  while (words.length > 1 && SUFFIX_WORDS.has(words[words.length - 1])) words.pop()
  return words.join(" ")
}

/** Producer reported by the backend, trimmed and with inner whitespace collapsed; "" when absent. */
function vendorOf(plugin: Plugin, meta: MetaMap): string {
  const v = meta.get(buildPluginPath(plugin.installPath, plugin.name))?.vendor
  return typeof v === "string" ? v.trim().replace(/\s+/g, " ") : ""
}

/** Most frequent spelling; ties go to the alphabetically first one. */
function pickSpelling(counts: Map<string, number>): string {
  let best = ""
  let bestCount = 0
  for (const [spelling, count] of counts) {
    if (count > bestCount || (count === bestCount && naturalCompare(spelling, best) < 0)) {
      best = spelling
      bestCount = count
    }
  }
  return best
}

/**
 * Groups plugins by producer. Plugins keep their input order inside a group. Plugins without a
 * (usable) producer go to the "Unknown" group, which is always last whatever the sort.
 */
export function groupByVendor(
  plugins: Plugin[],
  meta: MetaMap,
  sort: VendorSort = { key: "name", dir: "asc" },
  unknownLabel = "Unknown",
): VendorGroup[] {
  const known = new Map<string, { plugins: Plugin[]; spellings: Map<string, number> }>()
  const unknown: Plugin[] = []
  for (const plugin of plugins) {
    const original = vendorOf(plugin, meta)
    const key = original === "" ? "" : normalizeVendorKey(original)
    if (key === "") {
      unknown.push(plugin)
      continue
    }
    let group = known.get(key)
    if (!group) known.set(key, (group = { plugins: [], spellings: new Map() }))
    group.plugins.push(plugin)
    group.spellings.set(original, (group.spellings.get(original) ?? 0) + 1)
  }

  const sizeOf = (list: Plugin[]) => totalKnownSize(list, p => meta.get(buildPluginPath(p.installPath, p.name))?.size) ?? 0
  const groups: VendorGroup[] = [...known].map(([key, g]) => ({
    key,
    name: pickSpelling(g.spellings),
    plugins: g.plugins,
    totalSize: sizeOf(g.plugins),
  }))

  const sign = sort.dir === "asc" ? 1 : -1
  const byName = (a: VendorGroup, b: VendorGroup) => naturalCompare(a.name, b.name)
  groups.sort((a, b) => {
    const primary = sort.key === "count" ? a.plugins.length - b.plugins.length : sort.key === "size" ? a.totalSize - b.totalSize : byName(a, b)
    // Ties always fall back to the name, ascending, so the order is stable and predictable.
    return sign * primary || byName(a, b)
  })

  if (unknown.length > 0) groups.push({ key: UNKNOWN_VENDOR_KEY, name: unknownLabel, plugins: unknown, totalSize: sizeOf(unknown) })
  return groups
}
