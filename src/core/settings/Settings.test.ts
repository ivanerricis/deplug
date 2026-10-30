import { describe, expect, it, vi } from "vitest"
import { DEFAULT_SETTINGS, normalizeSettings, type AppSettings } from "./AppSettings"
import { loadSettings } from "./LoadSettings"

describe("normalizeSettings", () => {
  it("defaults welcomeSeen to false and validates its type", () => {
    expect(normalizeSettings({ version: 1 }).welcomeSeen).toBe(false)
    expect(normalizeSettings({ welcomeSeen: true }).welcomeSeen).toBe(true)
    expect(normalizeSettings({ welcomeSeen: "yes" }).welcomeSeen).toBe(false)
  })

  it("defaults the update settings to off / stable / never", () => {
    const s = normalizeSettings({ version: 1 })
    expect(s.checkUpdatesOnStartup).toBe(false)
    expect(s.updateChannel).toBe("stable")
    expect(s.lastUpdateCheck).toBe(0)
  })

  it("validates the update settings", () => {
    expect(normalizeSettings({ checkUpdatesOnStartup: true, updateChannel: "prerelease", lastUpdateCheck: 1700000000000.7 })).toMatchObject({
      checkUpdatesOnStartup: true,
      updateChannel: "prerelease",
      lastUpdateCheck: 1700000000000,
    })
    expect(normalizeSettings({ checkUpdatesOnStartup: "yes", updateChannel: "nightly", lastUpdateCheck: -5 })).toMatchObject({
      checkUpdatesOnStartup: false,
      updateChannel: "stable",
      lastUpdateCheck: 0,
    })
    expect(normalizeSettings({ lastUpdateCheck: "x" }).lastUpdateCheck).toBe(0)
  })

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
      runAsAdmin: "yes",
      searchRegistryLeftovers: "yes",
    })
    expect(s.runAsAdmin).toBe(true)
    expect(s.searchRegistryLeftovers).toBe(false)
    expect(s.language).toBe("system")
    expect(s.theme).toBe("system")
    expect(s.restorePointDefault).toBe(true)
    expect(s.scanOnStartup).toBe(false)
    expect(s.disabledSystemPaths).toEqual(["/x"])
  })

  it("keeps the registry search off unless it is explicitly on", () => {
    expect(DEFAULT_SETTINGS.searchRegistryLeftovers).toBe(false)
    expect(normalizeSettings({ version: 1, runAsAdmin: false }).searchRegistryLeftovers).toBe(false)
    expect(normalizeSettings({ searchRegistryLeftovers: true }).searchRegistryLeftovers).toBe(true)
  })

  it("defaults and validates the uninstall flow settings", () => {
    expect(DEFAULT_SETTINGS.deleteMethod).toBe("trash")
    expect(DEFAULT_SETTINGS.confirmUninstall).toBe(true)
    expect(normalizeSettings({ version: 1 }).deleteMethod).toBe("trash")
    expect(normalizeSettings({ deleteMethod: "permanent" }).deleteMethod).toBe("permanent")
    expect(normalizeSettings({ deleteMethod: "shred" }).deleteMethod).toBe("trash")
    expect(normalizeSettings({ confirmUninstall: false }).confirmUninstall).toBe(false)
    expect(normalizeSettings({ confirmUninstall: "no" }).confirmUninstall).toBe(true)
  })

  it("clamps the scan depth to 1-10", () => {
    expect(normalizeSettings({ customScanDepth: 0 }).customScanDepth).toBe(1)
    expect(normalizeSettings({ customScanDepth: 99 }).customScanDepth).toBe(10)
    expect(normalizeSettings({ customScanDepth: 4.6 }).customScanDepth).toBe(5)
    expect(normalizeSettings({ customScanDepth: "x" }).customScanDepth).toBe(6)
    expect(normalizeSettings({}).customScanDepth).toBe(6)
  })
})

describe("normalizeSettings (scan exclusions and view)", () => {
  it("cleans the exclusion list", () => {
    expect(normalizeSettings({ scanExclusions: [" Demo ", "demo", "", 4, "old_*"] }).scanExclusions).toEqual(["Demo", "old_*"])
    expect(normalizeSettings({ scanExclusions: "x" }).scanExclusions).toEqual([])
    expect(normalizeSettings({ scanExclusions: Array.from({ length: 70 }, (_, i) => `p${i}`) }).scanExclusions).toHaveLength(50)
  })

  it("keeps known columns in canonical order, allows none, defaults when absent", () => {
    expect(normalizeSettings({ visibleColumns: ["size", "bogus", "path", "size"] }).visibleColumns).toEqual(["path", "size"])
    expect(normalizeSettings({ visibleColumns: [] }).visibleColumns).toEqual([])
    expect(normalizeSettings({}).visibleColumns).toEqual(["path", "size", "modified", "arch"])
    expect(normalizeSettings({ visibleColumns: "path" }).visibleColumns).toEqual(["path", "size", "modified", "arch"])
  })

  it("falls back to defaults for invalid view values", () => {
    const s = normalizeSettings({
      density: "tiny",
      defaultTab: "VST9",
      defaultSort: { key: "color", dir: "up" },
      rememberView: "no",
      lastTab: 3,
      lastSort: "x",
    })
    expect(s.density).toBe("comfortable")
    expect(s.defaultTab).toBe("all")
    expect(s.defaultSort).toEqual({ key: "name", dir: "asc" })
    expect(s.rememberView).toBe(true)
    expect(s.lastTab).toBe("all")
    expect(s.lastSort).toEqual({ key: "name", dir: "asc" })
  })

  it("accepts CLAP as a tab", () => {
    const s = normalizeSettings({ defaultTab: "CLAP", lastTab: "CLAP" })
    expect([s.defaultTab, s.lastTab]).toEqual(["CLAP", "CLAP"])
  })

  it("accepts valid view values", () => {
    const s = normalizeSettings({
      density: "compact",
      defaultTab: "AU",
      defaultSort: { key: "size", dir: "desc" },
      rememberView: false,
      lastTab: "VST3",
      lastSort: { key: "modified", dir: "desc" },
    })
    expect([s.density, s.defaultTab, s.rememberView, s.lastTab]).toEqual(["compact", "AU", false, "VST3"])
    expect(s.defaultSort).toEqual({ key: "size", dir: "desc" })
    expect(s.lastSort).toEqual({ key: "modified", dir: "desc" })
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

describe("normalizeSettings (group by producer)", () => {
  it("defaults to grouping by format with the producers sorted by name", () => {
    const s = normalizeSettings({ version: 1 })
    expect(s.groupBy).toBe("format")
    expect(s.vendorSort).toEqual({ key: "name", dir: "asc" })
  })
  it("keeps valid values", () => {
    const s = normalizeSettings({ groupBy: "vendor", vendorSort: { key: "size", dir: "desc" } })
    expect(s.groupBy).toBe("vendor")
    expect(s.vendorSort).toEqual({ key: "size", dir: "desc" })
  })
  it("sanitizes invalid values", () => {
    expect(normalizeSettings({ groupBy: "color", vendorSort: { key: "path", dir: "up" } })).toMatchObject({
      groupBy: "format",
      vendorSort: { key: "name", dir: "asc" },
    })
    expect(normalizeSettings({ groupBy: 3, vendorSort: "x" })).toMatchObject({ groupBy: "format", vendorSort: { key: "name", dir: "asc" } })
  })
})

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
