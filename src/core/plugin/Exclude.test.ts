import { describe, expect, it } from "vitest"
import { createExcludeMatcher, normalizeExclusions } from "./Exclude"

describe("createExcludeMatcher", () => {
  it("matches whole names case-insensitively", () => {
    const m = createExcludeMatcher(["Backup"])
    expect(m("backup")).toBe(true)
    expect(m("BACKUP")).toBe(true)
    expect(m("Backups")).toBe(false)
    expect(m("My Backup")).toBe(false)
  })

  it("supports * wildcards", () => {
    const m = createExcludeMatcher(["*Demo*", "old_*"])
    expect(m("Reverb Demo.vst3")).toBe(true)
    expect(m("demo")).toBe(true)
    expect(m("Old_Stuff")).toBe(true)
    expect(m("gold_plugin")).toBe(false)
    expect(m("Reverb.vst3")).toBe(false)
  })

  it("treats other characters literally, including regex syntax", () => {
    const m = createExcludeMatcher(["a.b", "x+(y)", "[z]"])
    expect(m("a.b")).toBe(true)
    expect(m("axb")).toBe(false)
    expect(m("x+(y)")).toBe(true)
    expect(m("[z]")).toBe(true)
    expect(m("z")).toBe(false)
  })

  it("never matches with no patterns and ignores paths", () => {
    expect(createExcludeMatcher([])("anything")).toBe(false)
    expect(createExcludeMatcher(undefined)("anything")).toBe(false)
    expect(createExcludeMatcher(["Backup"])("C:/Backup/Plugin.vst3")).toBe(false)
  })
})

describe("normalizeExclusions", () => {
  it("trims, drops empties, duplicates, long and non-string entries", () => {
    expect(normalizeExclusions([" Demo ", "demo", "", "  ", 3, "x".repeat(101), "old_*"])).toEqual(["Demo", "old_*"])
    expect(normalizeExclusions("x")).toEqual([])
  })

  it("caps at 50 entries", () => {
    const many = Array.from({ length: 80 }, (_, i) => `p${i}`)
    const out = normalizeExclusions(many)
    expect(out).toHaveLength(50)
    expect(out[49]).toBe("p49")
  })
})
