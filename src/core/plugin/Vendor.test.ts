import { describe, expect, it } from "vitest"
import { groupByVendor, normalizeVendorKey, UNKNOWN_VENDOR_KEY } from "./Vendor"
import type { Plugin } from "./Plugin"
import type { MetaMap, PluginMeta } from "./Meta"

const plugin = (name: string, type: Plugin["type"] = "VST3"): Plugin => ({ name, installPath: "/p", type })
const metaOf = (entries: [Plugin, Partial<PluginMeta>][]): MetaMap =>
  new Map(entries.map(([p, m]) => [`/p/${p.name}`, { path: `/p/${p.name}`, size: null, modified: null, ...m }]))

describe("normalizeVendorKey", () => {
  it("ignores case, accents, spacing and punctuation", () => {
    expect(normalizeVendorKey("FabFilter")).toBe("fabfilter")
    expect(normalizeVendorKey("FABFILTER")).toBe("fabfilter")
    expect(normalizeVendorKey("  Fab   Filter  ")).toBe("fab filter")
    expect(normalizeVendorKey("Ünïcode-Audio")).toBe("unicode")
    expect(normalizeVendorKey("Tone2 / Audio")).toBe("tone2")
  })
  it("merges the spellings of one producer", () => {
    const key = normalizeVendorKey("FabFilter")
    expect(normalizeVendorKey("FabFilter Software Instruments")).toBe(key)
    expect(normalizeVendorKey("FabFilter Software")).toBe(key)
    expect(normalizeVendorKey("fabfilter, Inc.")).toBe(key)
  })
  it("strips company suffixes at the end only", () => {
    for (const suffix of ["Inc.", "Inc", "LLC", "Ltd.", "Ltd", "GmbH", "AG", "S.r.l.", "srl", "Co.", "Corp.", "B.V.", "BV", "AB", "Oy"]) {
      expect(normalizeVendorKey(`Acme ${suffix}`)).toBe("acme")
    }
    expect(normalizeVendorKey("Acme Co., Ltd.")).toBe("acme")
    expect(normalizeVendorKey("Acme Audio Plugins")).toBe("acme")
    expect(normalizeVendorKey("Audio Damage")).toBe("audio damage")
    expect(normalizeVendorKey("Software Acme")).toBe("software acme")
    expect(normalizeVendorKey("Native Instruments")).toBe("native instruments")
  })
  it("never reduces a name to nothing", () => {
    expect(normalizeVendorKey("Audio")).toBe("audio")
    expect(normalizeVendorKey("Software Audio")).toBe("software")
    expect(normalizeVendorKey("")).toBe("")
    expect(normalizeVendorKey("   ")).toBe("")
    expect(normalizeVendorKey("...")).toBe("")
  })
  it("keeps distinct producers apart", () => {
    expect(normalizeVendorKey("Waves")).not.toBe(normalizeVendorKey("Wave Arts"))
    expect(normalizeVendorKey("Arturia")).not.toBe(normalizeVendorKey("Arturo"))
  })
})

describe("groupByVendor", () => {
  const a = plugin("A.vst3")
  const b = plugin("B.dll", "VST2")
  const c = plugin("C.vst3")
  const d = plugin("D.vst3")
  const e = plugin("E.vst3")

  it("merges spellings, uses the most frequent as the name and puts Unknown last", () => {
    const meta = metaOf([
      [a, { vendor: "FabFilter" }],
      [b, { vendor: "FabFilter Software Instruments" }],
      [c, { vendor: "FABFILTER" }],
      [d, { vendor: "Acme" }],
    ])
    const groups = groupByVendor([a, b, c, d, e], meta)
    expect(groups.map(g => g.key)).toEqual(["acme", "fabfilter", UNKNOWN_VENDOR_KEY])
    expect(groups[1].plugins).toEqual([a, b, c])
    expect(groups[2].plugins).toEqual([e])
    // Three different spellings once each: the alphabetical first wins.
    expect(groups[1].name).toBe("FABFILTER")
  })
  it("picks the most frequent spelling over the alphabetical one", () => {
    const meta = metaOf([
      [a, { vendor: "Zed Audio" }],
      [b, { vendor: "Zed Audio" }],
      [c, { vendor: "ZED" }],
    ])
    expect(groupByVendor([a, b, c], meta)[0].name).toBe("Zed Audio")
  })
  it("treats missing, null, blank and punctuation-only producers as Unknown", () => {
    const meta = metaOf([
      [a, { vendor: null }],
      [b, { vendor: "   " }],
      [c, { vendor: "..." }],
    ])
    const groups = groupByVendor([a, b, c, d], meta, undefined, "Sconosciuto")
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ key: UNKNOWN_VENDOR_KEY, name: "Sconosciuto" })
    expect(groups[0].plugins).toHaveLength(4)
  })
  it("returns no groups for no plugins, and works without any metadata", () => {
    expect(groupByVendor([], new Map())).toEqual([])
    expect(groupByVendor([a], new Map())[0].key).toBe(UNKNOWN_VENDOR_KEY)
  })
  it("sums the known sizes", () => {
    const meta = metaOf([
      [a, { vendor: "Acme", size: 100 }],
      [b, { vendor: "Acme", size: 50 }],
      [c, { vendor: "Acme", size: null }],
      [d, { size: 7 }],
      [e, {}],
    ])
    const groups = groupByVendor([a, b, c, d, e], meta)
    expect(groups.find(g => g.key === "acme")?.totalSize).toBe(150)
    expect(groups.find(g => g.key === UNKNOWN_VENDOR_KEY)?.totalSize).toBe(7)
  })

  describe("sorting", () => {
    const meta = metaOf([
      [a, { vendor: "Beta", size: 10 }],
      [b, { vendor: "Alpha", size: 5 }],
      [c, { vendor: "Alpha", size: 5 }],
      [d, { vendor: "Gamma", size: 100 }],
      [e, {}],
    ])
    const keys = (sort: Parameters<typeof groupByVendor>[2]) => groupByVendor([a, b, c, d, e], meta, sort).map(g => g.key)

    it("by name, both directions, Unknown always last", () => {
      expect(keys({ key: "name", dir: "asc" })).toEqual(["alpha", "beta", "gamma", UNKNOWN_VENDOR_KEY])
      expect(keys({ key: "name", dir: "desc" })).toEqual(["gamma", "beta", "alpha", UNKNOWN_VENDOR_KEY])
    })
    it("by plugin count, ties by name ascending", () => {
      expect(keys({ key: "count", dir: "desc" })).toEqual(["alpha", "beta", "gamma", UNKNOWN_VENDOR_KEY])
      expect(keys({ key: "count", dir: "asc" })).toEqual(["beta", "gamma", "alpha", UNKNOWN_VENDOR_KEY])
    })
    it("by total size", () => {
      expect(keys({ key: "size", dir: "desc" })).toEqual(["gamma", "alpha", "beta", UNKNOWN_VENDOR_KEY])
      expect(keys({ key: "size", dir: "asc" })).toEqual(["alpha", "beta", "gamma", UNKNOWN_VENDOR_KEY])
    })
    it("sorts names naturally and ignoring case", () => {
      const m = metaOf([
        [a, { vendor: "Studio 10" }],
        [b, { vendor: "studio 2" }],
      ])
      expect(groupByVendor([a, b], m).map(g => g.name)).toEqual(["studio 2", "Studio 10"])
    })
  })
})
