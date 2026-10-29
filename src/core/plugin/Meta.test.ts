import { describe, expect, it, vi } from "vitest"
import { fetchPluginMeta, knownArch, type PluginMeta } from "./Meta"

const m = (path: string): PluginMeta => ({ path, size: 1, modified: 2 })

describe("fetchPluginMeta", () => {
  it("fetches in batches and reports each one", async () => {
    const calls: string[][] = []
    const got: string[] = []
    await fetchPluginMeta(["a", "b", "c", "d", "e"], b => got.push(...b.map(x => x.path)), {
      batchSize: 2,
      invokeFn: async paths => { calls.push(paths); return paths.map(m) },
    })
    expect(calls).toEqual([["a", "b"], ["c", "d"], ["e"]])
    expect(got).toEqual(["a", "b", "c", "d", "e"])
  })

  it("survives a failing batch", async () => {
    const onBatch = vi.fn()
    let n = 0
    await fetchPluginMeta(["a", "b"], onBatch, {
      batchSize: 1,
      invokeFn: async paths => { if (n++ === 0) throw new Error("boom"); return paths.map(m) },
    })
    expect(onBatch).toHaveBeenCalledTimes(1)
  })

  it("stops when cancelled", async () => {
    const onBatch = vi.fn()
    await fetchPluginMeta(["a", "b"], onBatch, { batchSize: 1, cancelled: () => true, invokeFn: async p => p.map(m) })
    expect(onBatch).not.toHaveBeenCalled()
  })
})

describe("arch passthrough", () => {
  it("carries arch from the backend untouched", async () => {
    const got: PluginMeta[] = []
    await fetchPluginMeta(["a"], b => got.push(...b), {
      invokeFn: async paths => paths.map(path => ({ path, size: 1, modified: 2, arch: "x86" as const })),
    })
    expect(got[0].arch).toBe("x86")
  })
  it("knownArch treats unknown, null and missing as not known", () => {
    expect(knownArch({ path: "a", size: 1, modified: 1, arch: "unknown" })).toBeNull()
    expect(knownArch({ path: "a", size: 1, modified: 1, arch: null })).toBeNull()
    expect(knownArch({ path: "a", size: 1, modified: 1 })).toBeNull()
    expect(knownArch(undefined)).toBeNull()
    expect(knownArch({ path: "a", size: 1, modified: 1, arch: "arm64" })).toBe("arm64")
  })
})
