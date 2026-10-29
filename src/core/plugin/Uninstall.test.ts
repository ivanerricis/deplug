import { describe, expect, it, vi } from "vitest"
import { buildPluginPath, uninstallPlugin, type UninstallBackend } from "./Uninstall"
import type { Plugin } from "./Plugin"

const plugin: Plugin = { name: "Foo.vst3", installPath: "C:/VST3", type: "VST3" }

function makeBackend(opts: { rp?: unknown; trash?: unknown } = {}) {
  const backend = {
    createRestorePoint: vi.fn(async (_d: string) => {
      if (opts.rp !== undefined) throw opts.rp
    }),
    trashPlugin: vi.fn(async (_p: string) => {
      if (opts.trash !== undefined) throw opts.trash
    }),
  } satisfies UninstallBackend
  return backend
}

describe("buildPluginPath", () => {
  it("avoids double separators", () => {
    expect(buildPluginPath("/usr/lib/vst3/", "A.vst3")).toBe("/usr/lib/vst3/A.vst3")
    expect(buildPluginPath("/usr/lib/vst3//", "/A.vst3")).toBe("/usr/lib/vst3/A.vst3")
  })
  it("keeps backslash style", () => {
    expect(buildPluginPath("C:\\VST3\\", "A.vst3")).toBe("C:\\VST3\\A.vst3")
  })
  it("handles root", () => {
    expect(buildPluginPath("/", "A.vst")).toBe("/A.vst")
  })
})

describe("uninstallPlugin", () => {
  it("trashes without restore point when disabled", async () => {
    const backend = makeBackend()
    const confirmContinue = vi.fn()
    const r = await uninstallPlugin(plugin, { restorePoint: false, backend, confirmContinue })
    expect(r).toEqual({ status: "removed", restorePoint: "skipped" })
    expect(backend.createRestorePoint).not.toHaveBeenCalled()
    expect(backend.trashPlugin).toHaveBeenCalledWith("C:/VST3/Foo.vst3")
  })

  it("creates restore point then trashes", async () => {
    const backend = makeBackend()
    const r = await uninstallPlugin(plugin, { restorePoint: true, backend, confirmContinue: vi.fn() })
    expect(r).toEqual({ status: "removed", restorePoint: "created" })
    expect(backend.createRestorePoint).toHaveBeenCalledWith("Deplug: Foo.vst3")
  })

  it("continues when restore point fails and user confirms", async () => {
    const backend = makeBackend({ rp: "Errore RP" })
    const confirmContinue = vi.fn(async () => true)
    const r = await uninstallPlugin(plugin, { restorePoint: true, backend, confirmContinue })
    expect(confirmContinue).toHaveBeenCalledWith("Errore RP")
    expect(r).toEqual({ status: "removed", restorePoint: "failed" })
    expect(backend.trashPlugin).toHaveBeenCalled()
  })

  it("aborts without touching files when user declines", async () => {
    const backend = makeBackend({ rp: "Errore RP" })
    const r = await uninstallPlugin(plugin, { restorePoint: true, backend, confirmContinue: async () => false })
    expect(r).toEqual({ status: "cancelled", restorePoint: "failed" })
    expect(backend.trashPlugin).not.toHaveBeenCalled()
  })

  it("reports trash failure", async () => {
    const backend = makeBackend({ trash: "Permesso negato" })
    const r = await uninstallPlugin(plugin, { restorePoint: true, backend, confirmContinue: vi.fn() })
    expect(r).toEqual({ status: "failed", restorePoint: "created", error: "Permesso negato" })
  })

  it("reports trash failure after skipped restore point failure", async () => {
    const backend = makeBackend({ rp: new Error("boom"), trash: new Error("nope") })
    const confirmContinue = vi.fn(async () => true)
    const r = await uninstallPlugin(plugin, { restorePoint: true, backend, confirmContinue })
    expect(confirmContinue).toHaveBeenCalledWith("boom")
    expect(r).toEqual({ status: "failed", restorePoint: "failed", error: "nope" })
  })
})
