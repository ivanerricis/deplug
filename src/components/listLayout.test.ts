import { describe, expect, it } from "vitest"
import { listColumns, rowGrid, rowPadding } from "./listLayout"

describe("rowGrid", () => {
  const count = (s: string, re: RegExp) => (s.match(re) ?? []).length
  it("adapts the template to the shown columns", () => {
    const both = rowGrid({ size: true, modified: true })
    expect(both).toContain("min-[900px]:grid-cols-[2.25rem_minmax(0,1fr)_5rem_7rem_5.5rem]")
    const sizeOnly = rowGrid({ size: true, modified: false })
    expect(sizeOnly).toContain("4.75rem")
    expect(sizeOnly).not.toContain("7rem")
    const modOnly = rowGrid({ size: false, modified: true })
    expect(modOnly).toContain("min-[900px]:grid-cols-[2.25rem_minmax(0,1fr)_7rem_5.5rem]")
    expect(modOnly).not.toContain("4.75rem")
    const none = rowGrid({ size: false, modified: false })
    expect(none).toBe("grid grid-cols-[2.25rem_minmax(0,1fr)_5.5rem]")
    expect(count(none, /min-\[900px\]/g)).toBe(0)
  })
})

describe("listColumns and density", () => {
  it("maps the visible list to flags", () => {
    expect(listColumns(["size", "arch"])).toEqual({ path: false, size: true, modified: false, arch: true })
    expect(listColumns([])).toEqual({ path: false, size: false, modified: false, arch: false })
  })
  it("compact rows are tighter", () => {
    expect(rowPadding("compact")).not.toBe(rowPadding("comfortable"))
  })
})
