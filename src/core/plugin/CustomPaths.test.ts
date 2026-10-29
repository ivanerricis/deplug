import { describe, expect, it, vi } from "vitest"
import { loadCustomPaths, saveCustomPaths } from "./CustomPaths"

function makeStorage(initial?: string) {
  const data = new Map<string, string>()
  if (initial !== undefined) data.set("customScanPaths", initial)
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    removeItem: (k: string) => void data.delete(k),
  }
}

function makeBackend(paths: unknown) {
  return {
    getSettings: vi.fn(async () => ({ customScanPaths: paths as string[] })),
    saveCustomPaths: vi.fn(async (_p: string[]) => {}),
  }
}

describe("loadCustomPaths", () => {
  it("migrates localStorage paths when backend is empty", async () => {
    const storage = makeStorage(JSON.stringify(["/a", 3, "/b"]))
    const backend = makeBackend([])
    expect(await loadCustomPaths({ backend, storage })).toEqual(["/a", "/b"])
    expect(backend.saveCustomPaths).toHaveBeenCalledWith(["/a", "/b"])
    expect(storage.data.has("customScanPaths")).toBe(false)
  })

  it("uses backend paths and leaves storage alone", async () => {
    const storage = makeStorage(JSON.stringify(["/old"]))
    const backend = makeBackend(["/x", 1])
    expect(await loadCustomPaths({ backend, storage })).toEqual(["/x"])
    expect(backend.saveCustomPaths).not.toHaveBeenCalled()
    expect(storage.data.has("customScanPaths")).toBe(true)
  })

  it("ignores invalid legacy data", async () => {
    for (const raw of ["not json", "{}", "[1,2]", '"str"']) {
      const backend = makeBackend([])
      expect(await loadCustomPaths({ backend, storage: makeStorage(raw) })).toEqual([])
      expect(backend.saveCustomPaths).not.toHaveBeenCalled()
    }
  })

  it("returns [] with no storage or empty storage", async () => {
    expect(await loadCustomPaths({ backend: makeBackend([]), storage: undefined })).toEqual([])
    expect(await loadCustomPaths({ backend: makeBackend([]), storage: makeStorage() })).toEqual([])
  })

  it("tolerates storage throwing", async () => {
    const storage = {
      getItem: () => { throw new Error("denied") },
      removeItem: () => { throw new Error("denied") },
    }
    expect(await loadCustomPaths({ backend: makeBackend([]), storage })).toEqual([])
    const removeThrows = {
      getItem: () => JSON.stringify(["/a"]),
      removeItem: () => { throw new Error("denied") },
    }
    const backend = makeBackend([])
    expect(await loadCustomPaths({ backend, storage: removeThrows })).toEqual(["/a"])
    expect(backend.saveCustomPaths).toHaveBeenCalledWith(["/a"])
  })

  it("does not remove the key if the backend save fails", async () => {
    const storage = makeStorage(JSON.stringify(["/a"]))
    const backend = makeBackend([])
    backend.saveCustomPaths.mockRejectedValueOnce("disk full")
    await expect(loadCustomPaths({ backend, storage })).rejects.toBe("disk full")
    expect(storage.data.has("customScanPaths")).toBe(true)
  })
})

describe("saveCustomPaths", () => {
  it("delegates to the backend", async () => {
    const backend = makeBackend([])
    await saveCustomPaths(["/z"], { backend })
    expect(backend.saveCustomPaths).toHaveBeenCalledWith(["/z"])
  })
})
