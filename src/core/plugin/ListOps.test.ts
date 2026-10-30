import { describe, expect, it } from "vitest"
import { countByArch, filterByArch, filterDamaged, filterPlugins, findDuplicates, folderRuns, naturalCompare, shouldGroupByFolder, normalizeBaseName, pluginKey, sortPlugins } from "./ListOps"
import type { Plugin } from "./Plugin"
import type { MetaMap, PluginArch } from "./Meta"
import { buildPluginPath } from "./Uninstall"

const p = (name: string, installPath = "/vst3", type: Plugin["type"] = "VST3"): Plugin => ({ name, installPath, type })

describe("filterPlugins", () => {
  const list = [p("Serum.vst3", "/a/Xfer"), p("Éclat.vst3", "/b"), p("Surge XT.vst3", "/c/Surge")]
  it("returns everything for an empty or blank query", () => {
    expect(filterPlugins(list, "")).toBe(list)
    expect(filterPlugins(list, "   ")).toBe(list)
  })
  it("matches name case-insensitively as a substring", () => {
    expect(filterPlugins(list, "SURGE").map(x => x.name)).toEqual(["Surge XT.vst3"])
    expect(filterPlugins(list, "rum").map(x => x.name)).toEqual(["Serum.vst3"])
  })
  it("matches the path too", () => {
    expect(filterPlugins(list, "xfer").map(x => x.name)).toEqual(["Serum.vst3"])
  })
  it("handles unicode and accents", () => {
    expect(filterPlugins(list, "eclat").map(x => x.name)).toEqual(["Éclat.vst3"])
    expect(filterPlugins(list, "ÉCLAT").map(x => x.name)).toEqual(["Éclat.vst3"])
    expect(filterPlugins([p("Ωmega.vst3")], "ωMEGA")).toHaveLength(1)
  })
  it("returns nothing when there is no match", () => {
    expect(filterPlugins(list, "zzz")).toEqual([])
  })
})

describe("naturalCompare / sortPlugins", () => {
  it("orders numbers naturally", () => {
    expect(["Plug 10", "Plug 2", "Plug 1"].sort(naturalCompare)).toEqual(["Plug 1", "Plug 2", "Plug 10"])
  })
  it("ignores case and accents but is deterministic", () => {
    expect(naturalCompare("alpha", "Beta")).toBeLessThan(0)
    expect(naturalCompare("eclat", "Éclat")).not.toBe(0)
    expect(naturalCompare("Éclat", "Zed")).toBeLessThan(0)
  })
  it("sorts by name ascending and descending without mutating the input", () => {
    const list = [p("b.vst3"), p("A10.vst3"), p("A2.vst3")]
    const copy = [...list]
    expect(sortPlugins(list, { key: "name", dir: "asc" }).map(x => x.name)).toEqual(["A2.vst3", "A10.vst3", "b.vst3"])
    expect(sortPlugins(list, { key: "name", dir: "desc" }).map(x => x.name)).toEqual(["b.vst3", "A10.vst3", "A2.vst3"])
    expect(list).toEqual(copy)
  })
  it("sorts by path with the name as tie-break", () => {
    const list = [p("Z.vst3", "/b"), p("B.vst3", "/a"), p("A.vst3", "/a")]
    expect(sortPlugins(list, { key: "path", dir: "asc" }).map(x => x.name)).toEqual(["A.vst3", "B.vst3", "Z.vst3"])
    expect(sortPlugins(list, { key: "path", dir: "desc" }).map(x => x.name)).toEqual(["Z.vst3", "B.vst3", "A.vst3"])
  })
})

describe("normalizeBaseName", () => {
  it("strips extension, case and x64 suffixes", () => {
    expect(normalizeBaseName("Serum.vst3")).toBe("serum")
    expect(normalizeBaseName("SERUM.dll")).toBe("serum")
    expect(normalizeBaseName("Serum x64.dll")).toBe("serum")
    expect(normalizeBaseName("Serum_x64.dll")).toBe("serum")
    expect(normalizeBaseName("Serum (x64).vst3")).toBe("serum")
    expect(normalizeBaseName("Serum X64.dll")).toBe("serum")
  })
  it("keeps meaningful parts", () => {
    expect(normalizeBaseName("Serum 2.vst3")).toBe("serum 2")
    expect(normalizeBaseName("Surge XT.vst3")).toBe("surge xt")
    expect(normalizeBaseName("Kontakt 7.5.component")).toBe("kontakt 7.5")
    expect(normalizeBaseName("Foo64.dll")).toBe("foo64")
  })
})

describe("findDuplicates", () => {
  it("groups the same name across formats", () => {
    const a = p("Serum.dll", "C:/VST", "VST2")
    const b = p("Serum.vst3", "C:/VST3")
    const d = findDuplicates([a, b, p("Vital.vst3")])
    expect([...d.keys()].sort()).toEqual([pluginKey(a), pluginKey(b)].sort())
    expect(d.get(pluginKey(a))).toEqual([b])
    expect(d.get(pluginKey(b))).toEqual([a])
  })
  it("groups the same VST3 in two folders", () => {
    const a = p("Vital.vst3", "/usr/lib/vst3")
    const b = p("Vital.vst3", "/home/u/.vst3")
    const d = findDuplicates([a, b])
    expect(d.get(pluginKey(a))).toEqual([b])
  })
  it("ignores the x64 suffix and case", () => {
    const a = p("Dexed x64.dll", "/a", "VST2")
    const b = p("dexed.vst3", "/b")
    expect(findDuplicates([a, b]).size).toBe(2)
  })
  it("does not group different plugins", () => {
    expect(findDuplicates([p("Serum.vst3"), p("Vital.vst3"), p("Helm.vst3")]).size).toBe(0)
  })
  it("does not group similar but different names", () => {
    expect(findDuplicates([p("Serum.vst3"), p("Serum 2.vst3"), p("Surge.vst3"), p("Surge XT.vst3")]).size).toBe(0)
  })
  it("lists all other copies of a three-way group", () => {
    const a = p("X.vst3", "/1")
    const b = p("X.vst3", "/2")
    const c = p("X.dll", "/3", "VST2")
    expect(findDuplicates([a, b, c]).get(pluginKey(a))).toEqual([b, c])
  })
  it("does not treat the same entry listed twice as a duplicate", () => {
    expect(findDuplicates([p("A.vst3"), p("A.vst3")]).size).toBe(0)
  })
})

describe("folderRuns / shouldGroupByFolder", () => {
  const list = [p("A", "/x"), p("B", "/x"), p("C", "/x"), p("D", "/y"), p("E", "/y"), p("F", "/y")]
  it("groups consecutive plugins of the same folder", () => {
    expect(folderRuns(list)).toEqual([
      { folder: "/x", start: 0, length: 3 },
      { folder: "/y", start: 3, length: 3 },
    ])
    expect(shouldGroupByFolder(folderRuns(list), list.length)).toBe(true)
  })
  it("falls back to per-row paths when folders alternate", () => {
    const mixed = [p("A", "/x"), p("B", "/y"), p("C", "/x"), p("D", "/y")]
    expect(folderRuns(mixed)).toHaveLength(4)
    expect(shouldGroupByFolder(folderRuns(mixed), mixed.length)).toBe(false)
  })
  it("always groups a single folder", () => {
    expect(shouldGroupByFolder(folderRuns([p("A", "/x")]), 1)).toBe(true)
  })
})

describe("sortPlugins by size and date", () => {
  const a = p("A.vst3", "/x")
  const b = p("B.vst3", "/x")
  const c = p("C.vst3", "/x")
  const d = p("D.vst3", "/x")
  const meta = new Map([
    ["/x/A.vst3", { path: "/x/A.vst3", size: 300, modified: 10 }],
    ["/x/B.vst3", { path: "/x/B.vst3", size: 100, modified: 30 }],
    ["/x/C.vst3", { path: "/x/C.vst3", size: 200, modified: 20 }],
  ])
  const names = (list: Plugin[]) => list.map(x => x.name)
  it("sorts by size with unknown values last in both directions", () => {
    expect(names(sortPlugins([a, b, c, d], { key: "size", dir: "asc" }, meta))).toEqual(["B.vst3", "C.vst3", "A.vst3", "D.vst3"])
    expect(names(sortPlugins([a, b, c, d], { key: "size", dir: "desc" }, meta))).toEqual(["A.vst3", "C.vst3", "B.vst3", "D.vst3"])
  })
  it("sorts by modified date", () => {
    expect(names(sortPlugins([a, b, c, d], { key: "modified", dir: "desc" }, meta))).toEqual(["B.vst3", "C.vst3", "A.vst3", "D.vst3"])
  })
  it("falls back to name order without metadata", () => {
    expect(names(sortPlugins([c, a, b], { key: "size", dir: "asc" }))).toEqual(["A.vst3", "B.vst3", "C.vst3"])
  })
})

describe("filterByArch", () => {
  const list = [p("A.vst3", "/a"), p("B.vst3", "/b"), p("C.vst3", "/c"), p("D.vst3", "/d"), p("E.vst3", "/e"), p("F.vst3", "/f")]
  const archs: PluginArch[] = ["x64", "x86", "arm64", "universal", "mixed", "unknown"]
  const meta: MetaMap = new Map(
    list.map((x, i) => [buildPluginPath(x.installPath, x.name), { path: buildPluginPath(x.installPath, x.name), size: 1, modified: 1, arch: archs[i] }]),
  )
  const names = (l: Plugin[]) => l.map(x => x.name[0])

  it("returns the same list for all", () => {
    expect(filterByArch(list, "all", meta)).toBe(list)
  })
  it("matches 64-bit, including universal and mixed bundles", () => {
    expect(names(filterByArch(list, "x64", meta))).toEqual(["A", "D", "E"])
  })
  it("matches 32-bit only for x86 and mixed", () => {
    expect(names(filterByArch(list, "x86", meta))).toEqual(["B", "E"])
  })
  it("matches ARM64 including universal", () => {
    expect(names(filterByArch(list, "arm64", meta))).toEqual(["C", "D", "E"])
  })
  it("hides plugins without metadata under a specific filter", () => {
    expect(filterByArch(list, "x64")).toEqual([])
  })
  it("composes with search and duplicates", () => {
    const dup = [p("Twin.dll", "/x86", "VST2"), p("Twin.vst3", "/x64", "VST3"), p("Solo.vst3", "/s")]
    const m: MetaMap = new Map(
      dup.map((x, i) => {
        const path = buildPluginPath(x.installPath, x.name)
        return [path, { path, size: 1, modified: 1, arch: (["x86", "x64", "x86"] as PluginArch[])[i] }]
      }),
    )
    const dups = findDuplicates(dup)
    const result = filterByArch(filterPlugins(dup, "twin").filter(x => dups.has(pluginKey(x))), "x86", m)
    expect(result.map(x => x.name)).toEqual(["Twin.dll"])
  })
  it("counts per filter", () => {
    expect(countByArch(list, meta)).toEqual({ all: 6, x64: 3, x86: 2, arm64: 3 })
  })
})

describe("filterDamaged", () => {
  const list = [p("A.vst3", "/a"), p("B.vst3", "/b"), p("C.vst3", "/c"), p("D.vst3", "/d")]
  const health = ["ok", "empty", "missing-binary", undefined] as const
  const meta: MetaMap = new Map(
    list.map((x, i) => [buildPluginPath(x.installPath, x.name), { path: buildPluginPath(x.installPath, x.name), size: 1, modified: 1, health: health[i] }]),
  )
  it("keeps empty and missing-binary plugins", () => {
    expect(filterDamaged(list, meta).map(x => x.name)).toEqual(["B.vst3", "C.vst3"])
  })
  it("returns nothing without metadata", () => {
    expect(filterDamaged(list)).toEqual([])
  })
})
