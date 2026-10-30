import { describe, expect, it, vi } from "vitest"
import { groupVendorUninstallers, uninstallPlugins, type UninstallBackend, type VendorGroup, type VendorUninstaller } from "./Uninstall"
import type { Plugin } from "./Plugin"

const a: Plugin = { name: "A.vst3", installPath: "/vst3", type: "VST3" }
const b: Plugin = { name: "B.vst3", installPath: "/vst3", type: "VST3" }
const c: Plugin = { name: "C.so", installPath: "/vst", type: "VST2" }

function makeBackend(opts: { rp?: unknown; trash?: unknown } = {}) {
  return {
    createRestorePoint: vi.fn(async (_d: string) => {
      if (opts.rp !== undefined) throw opts.rp
    }),
    trashPlugin: vi.fn(async (_p: string) => {
      if (opts.trash !== undefined) throw opts.trash
    }),
  } satisfies UninstallBackend
}

describe("uninstallPlugins", () => {
  it("creates one restore point for the whole batch and trashes in order", async () => {
    const backend = makeBackend()
    const r = await uninstallPlugins([a, b, c], { restorePoint: true, backend, confirmContinue: vi.fn() })
    expect(backend.createRestorePoint).toHaveBeenCalledTimes(1)
    expect(backend.createRestorePoint).toHaveBeenCalledWith("Deplug: 3 plugins")
    expect(backend.trashPlugin.mock.calls.map(call => call[0])).toEqual(["/vst3/A.vst3", "/vst3/B.vst3", "/vst/C.so"])
    expect(r.status).toBe("completed")
    expect(r.restorePoint).toBe("created")
    expect(r.results.map(x => x.status)).toEqual(["removed", "removed", "removed"])
  })

  it("uses the plugin name as the restore point description for a single plugin", async () => {
    const backend = makeBackend()
    const r = await uninstallPlugins([a], { restorePoint: true, backend, confirmContinue: vi.fn() })
    expect(backend.createRestorePoint).toHaveBeenCalledWith("Deplug: A.vst3")
    expect(r.results).toEqual([{ plugin: a, status: "removed" }])
  })

  it("skips the restore point when disabled", async () => {
    const backend = makeBackend()
    const r = await uninstallPlugins([a, b], { restorePoint: false, backend, confirmContinue: vi.fn() })
    expect(backend.createRestorePoint).not.toHaveBeenCalled()
    expect(r.restorePoint).toBe("skipped")
  })

  it("touches nothing when the restore point fails and the user declines", async () => {
    const backend = makeBackend({ rp: "ERR_RESTORE_FREQUENCY" })
    const confirmContinue = vi.fn(async () => false)
    const r = await uninstallPlugins([a, b], { restorePoint: true, backend, confirmContinue })
    expect(confirmContinue).toHaveBeenCalledTimes(1)
    expect(r).toEqual({ status: "cancelled", restorePoint: "failed", results: [] })
    expect(backend.trashPlugin).not.toHaveBeenCalled()
  })

  it("goes on without a restore point when the user accepts", async () => {
    const backend = makeBackend({ rp: "boom" })
    const r = await uninstallPlugins([a, b], { restorePoint: true, backend, confirmContinue: async () => true })
    expect(r.status).toBe("completed")
    expect(r.restorePoint).toBe("failed")
    expect(backend.trashPlugin).toHaveBeenCalledTimes(2)
  })

  it("continues after individual failures and reports each one", async () => {
    const backend = {
      createRestorePoint: vi.fn(async () => {}),
      trashPlugin: vi.fn(async (p: string) => {
        if (p.endsWith("B.vst3")) throw "ERR_TRASH_FAILED:locked"
      }),
    } satisfies UninstallBackend
    const r = await uninstallPlugins([a, b, c], { restorePoint: true, backend, confirmContinue: vi.fn() })
    expect(backend.trashPlugin).toHaveBeenCalledTimes(3)
    expect(r.status).toBe("completed")
    expect(r.results).toEqual([
      { plugin: a, status: "removed" },
      { plugin: b, status: "failed", error: "ERR_TRASH_FAILED:locked" },
      { plugin: c, status: "removed" },
    ])
  })

  it("reports every plugin as failed when all fail", async () => {
    const backend = makeBackend({ trash: new Error("nope") })
    const r = await uninstallPlugins([a, b], { restorePoint: false, backend, confirmContinue: vi.fn() })
    expect(r.results.map(x => [x.status, x.error])).toEqual([["failed", "nope"], ["failed", "nope"]])
  })

  it("reports progress before each plugin and at the end", async () => {
    const backend = makeBackend()
    const events: [number, string | null][] = []
    await uninstallPlugins([a, b], {
      restorePoint: false,
      backend,
      confirmContinue: vi.fn(),
      onProgress: (done, current) => events.push([done.length, current?.name ?? null]),
    })
    expect(events).toEqual([[0, "A.vst3"], [1, "B.vst3"], [2, null]])
  })

  it("does nothing for an empty batch", async () => {
    const backend = makeBackend()
    const r = await uninstallPlugins([], { restorePoint: true, backend, confirmContinue: vi.fn() })
    expect(r).toEqual({ status: "completed", restorePoint: "skipped", results: [] })
    expect(backend.createRestorePoint).not.toHaveBeenCalled()
  })
})

const vendorOf = (commandPreview: string, over: Partial<VendorUninstaller> = {}): VendorUninstaller => ({
  displayName: "Voxengo SPAN",
  publisher: "Voxengo",
  kind: "exe",
  commandPreview,
  source: "registry",
  ...over,
})

describe("groupVendorUninstallers", () => {
  it("groups plugins that resolve to the same command and keeps input order", () => {
    const groups = groupVendorUninstallers([
      { plugin: a, vendor: vendorOf("C:\\Span\\unins000.exe") },
      { plugin: b, vendor: vendorOf("C:\\Other\\unins.exe", { displayName: "Other" }) },
      { plugin: c, vendor: vendorOf(" C:\\Span\\unins000.exe ") },
    ])
    expect(groups.map(g => g.plugins)).toEqual([[a, c], [b]])
    expect(groups[0].vendor.displayName).toBe("Voxengo SPAN")
  })

  it("skips plugins without an uninstaller and uninstallers that cannot be run", () => {
    expect(
      groupVendorUninstallers([
        { plugin: a, vendor: null },
        { plugin: b, vendor: undefined },
        { plugin: c, vendor: vendorOf("com.vendor.pkg", { kind: "pkg", source: "pkgutil" }) },
      ]),
    ).toEqual([])
  })

  it("does not merge different kinds with the same text", () => {
    const groups = groupVendorUninstallers([
      { plugin: a, vendor: vendorOf("X") },
      { plugin: b, vendor: vendorOf("X", { kind: "msi" }) },
    ])
    expect(groups).toHaveLength(2)
  })
})

describe("uninstallPlugins with the publisher's uninstaller", () => {
  const d: Plugin = { name: "D.vst3", installPath: "/vst3", type: "VST3" }
  const group = (plugins: Plugin[], key = "g"): VendorGroup => ({ key, vendor: vendorOf(key), plugins })

  function setup(opts: { vendor?: (p: string) => unknown; present?: (p: string) => boolean | Error } = {}) {
    const calls: string[] = []
    const backend = {
      createRestorePoint: vi.fn(async (_d: string) => {
        calls.push("rp")
      }),
      trashPlugin: vi.fn(async (p: string) => {
        calls.push(`trash:${p}`)
      }),
    } satisfies UninstallBackend
    const vendorBackend = {
      runVendorUninstaller: vi.fn(async (p: string) => {
        calls.push(`vendor:${p}`)
        const err = opts.vendor?.(p)
        if (err !== undefined) throw err
      }),
      pathExists: vi.fn(async (p: string) => {
        const r = opts.present?.(p) ?? false
        if (r instanceof Error) throw r
        return r
      }),
    }
    return { backend, vendorBackend, calls }
  }

  it("runs the uninstaller once per group, trashes the rest, and keeps selection order", async () => {
    const { backend, vendorBackend, calls } = setup()
    const progress: [string[], string | null, string[]][] = []
    const r = await uninstallPlugins([a, b, c, d], {
      restorePoint: true,
      backend,
      confirmContinue: vi.fn(),
      vendor: { groups: [group([a, c])], backend: vendorBackend },
      onProgress: (done, cur, active) => progress.push([done.map(x => x.plugin.name), cur?.name ?? null, active.map(x => x.name)]),
    })
    expect(calls).toEqual(["rp", "vendor:/vst3/A.vst3", "trash:/vst3/B.vst3", "trash:/vst3/D.vst3"])
    expect(backend.createRestorePoint).toHaveBeenCalledTimes(1)
    expect(vendorBackend.runVendorUninstaller).toHaveBeenCalledTimes(1)
    expect(r.results).toEqual([
      { plugin: a, status: "removed", action: "vendor" },
      { plugin: b, status: "removed" },
      { plugin: c, status: "removed", action: "vendor" },
      { plugin: d, status: "removed" },
    ])
    expect(progress).toEqual([
      [[], "A.vst3", ["A.vst3", "C.so"]],
      [["A.vst3", "C.so"], "B.vst3", ["B.vst3"]],
      [["A.vst3", "C.so", "B.vst3"], "D.vst3", ["D.vst3"]],
      [["A.vst3", "C.so", "B.vst3", "D.vst3"], null, []],
    ])
  })

  it("runs groups one after the other", async () => {
    const { backend, vendorBackend, calls } = setup()
    await uninstallPlugins([a, b, c], {
      restorePoint: false,
      backend,
      confirmContinue: vi.fn(),
      vendor: { groups: [group([a, c], "g1"), group([b], "g2")], backend: vendorBackend },
    })
    expect(calls).toEqual(["vendor:/vst3/A.vst3", "vendor:/vst3/B.vst3"])
    expect(backend.trashPlugin).not.toHaveBeenCalled()
  })

  it("reports a plugin still on disk after a successful run, and never trashes it", async () => {
    const { backend, vendorBackend } = setup({ present: p => p.endsWith("C.so") })
    const r = await uninstallPlugins([a, c], {
      restorePoint: false,
      backend,
      confirmContinue: vi.fn(),
      vendor: { groups: [group([a, c])], backend: vendorBackend },
    })
    expect(r.results.map(x => x.status)).toEqual(["removed", "still-present"])
    expect(backend.trashPlugin).not.toHaveBeenCalled()
  })

  it("treats an unreadable existence check as still present", async () => {
    const { backend, vendorBackend } = setup({ present: () => new Error("denied") })
    const r = await uninstallPlugins([a], {
      restorePoint: false,
      backend,
      confirmContinue: vi.fn(),
      vendor: { groups: [group([a])], backend: vendorBackend },
    })
    expect(r.results[0].status).toBe("still-present")
  })

  it("fails the whole group when the uninstaller fails, then goes on with the others", async () => {
    const { backend, vendorBackend } = setup({ vendor: () => "ERR_VENDOR_FAILED:5" })
    const r = await uninstallPlugins([a, b, c], {
      restorePoint: false,
      backend,
      confirmContinue: vi.fn(),
      vendor: { groups: [group([a, c])], backend: vendorBackend },
    })
    expect(vendorBackend.pathExists).not.toHaveBeenCalled()
    expect(r.results).toEqual([
      { plugin: a, status: "failed", action: "vendor", error: "ERR_VENDOR_FAILED:5" },
      { plugin: b, status: "removed" },
      { plugin: c, status: "failed", action: "vendor", error: "ERR_VENDOR_FAILED:5" },
    ])
  })

  it("does not run anything when the restore point fails and the user declines", async () => {
    const { backend, vendorBackend } = setup()
    backend.createRestorePoint.mockRejectedValueOnce("ERR_RESTORE_FAILED:x")
    const r = await uninstallPlugins([a], {
      restorePoint: true,
      backend,
      confirmContinue: async () => false,
      vendor: { groups: [group([a])], backend: vendorBackend },
    })
    expect(r.status).toBe("cancelled")
    expect(vendorBackend.runVendorUninstaller).not.toHaveBeenCalled()
  })

  it("only counts group members that are part of the batch", async () => {
    const { backend, vendorBackend } = setup()
    const r = await uninstallPlugins([a], {
      restorePoint: false,
      backend,
      confirmContinue: vi.fn(),
      vendor: { groups: [group([a, c])], backend: vendorBackend },
    })
    expect(r.results.map(x => x.plugin)).toEqual([a])
    expect(vendorBackend.pathExists).toHaveBeenCalledTimes(1)
  })
})
