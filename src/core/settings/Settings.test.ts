import { describe, expect, it, vi } from "vitest"
import { DEFAULT_SETTINGS, normalizeSettings, type AppSettings } from "./AppSettings"
import { loadSettings } from "./LoadSettings"

describe("normalizeSettings", () => {
  it("fills defaults for missing or garbage input", () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings("x")).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings({ version: 1, customScanPaths: ["/a"] }).customScanPaths).toEqual(["/a"])
  })

  it("rejects invalid enum values and wrong types", () => {
    const s = normalizeSettings({
      language: "fr",
      theme: 3,
      restorePointDefault: "yes",
      scanOnStartup: false,
      disabledSystemPaths: ["/x", 4],
    })
    expect(s.language).toBe("system")
    expect(s.theme).toBe("system")
    expect(s.restorePointDefault).toBe(true)
    expect(s.scanOnStartup).toBe(false)
    expect(s.disabledSystemPaths).toEqual(["/x"])
  })

  it("clamps the scan depth to 1-10", () => {
    expect(normalizeSettings({ customScanDepth: 0 }).customScanDepth).toBe(1)
    expect(normalizeSettings({ customScanDepth: 99 }).customScanDepth).toBe(10)
    expect(normalizeSettings({ customScanDepth: 4.6 }).customScanDepth).toBe(5)
    expect(normalizeSettings({ customScanDepth: "x" }).customScanDepth).toBe(6)
    expect(normalizeSettings({}).customScanDepth).toBe(6)
  })
})

function makeStorage(initial?: string) {
  const data = new Map<string, string>()
  if (initial !== undefined) data.set("customScanPaths", initial)
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    removeItem: (k: string) => void data.delete(k),
  }
}

function makeBackend(paths: string[]) {
  const settings: AppSettings = { ...DEFAULT_SETTINGS, customScanPaths: paths }
  return {
    getSettings: vi.fn(async () => settings),
    saveSettings: vi.fn(async (_s: AppSettings) => {}),
  }
}

describe("loadSettings (legacy migration)", () => {
  it("migrates localStorage paths when the backend has none", async () => {
    const storage = makeStorage(JSON.stringify(["/a", 3, "/b"]))
    const backend = makeBackend([])
    const s = await loadSettings({ backend, storage })
    expect(s.customScanPaths).toEqual(["/a", "/b"])
    expect(backend.saveSettings).toHaveBeenCalledWith(expect.objectContaining({ customScanPaths: ["/a", "/b"] }))
    expect(storage.data.has("customScanPaths")).toBe(false)
  })

  it("uses backend paths and leaves storage alone", async () => {
    const storage = makeStorage(JSON.stringify(["/old"]))
    const backend = makeBackend(["/x"])
    expect((await loadSettings({ backend, storage })).customScanPaths).toEqual(["/x"])
    expect(backend.saveSettings).not.toHaveBeenCalled()
    expect(storage.data.has("customScanPaths")).toBe(true)
  })

  it("ignores invalid legacy data", async () => {
    for (const raw of ["not json", "{}", "[1,2]", '"str"']) {
      const backend = makeBackend([])
      expect((await loadSettings({ backend, storage: makeStorage(raw) })).customScanPaths).toEqual([])
      expect(backend.saveSettings).not.toHaveBeenCalled()
    }
  })

  it("works with no storage and tolerates storage throwing", async () => {
    expect((await loadSettings({ backend: makeBackend([]), storage: undefined })).customScanPaths).toEqual([])
    const throwing = {
      getItem: () => { throw new Error("denied") },
      removeItem: () => { throw new Error("denied") },
    }
    expect((await loadSettings({ backend: makeBackend([]), storage: throwing })).customScanPaths).toEqual([])
    const removeThrows = { getItem: () => JSON.stringify(["/a"]), removeItem: () => { throw new Error("denied") } }
    const backend = makeBackend([])
    expect((await loadSettings({ backend, storage: removeThrows })).customScanPaths).toEqual(["/a"])
  })

  it("keeps the legacy key if the backend save fails", async () => {
    const storage = makeStorage(JSON.stringify(["/a"]))
    const backend = makeBackend([])
    backend.saveSettings.mockRejectedValueOnce("disk full")
    await expect(loadSettings({ backend, storage })).rejects.toBe("disk full")
    expect(storage.data.has("customScanPaths")).toBe(true)
  })
})
