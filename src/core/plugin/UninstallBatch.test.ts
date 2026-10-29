import { describe, expect, it, vi } from "vitest"
import { uninstallPlugins, type UninstallBackend } from "./Uninstall"
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
