import { describe, expect, it, vi } from "vitest"
import {
  freedBytes,
  parseLeftoverFailure,
  totalKnownSize,
  uninstallPlugins,
  uninstallSingle,
  type BatchItemResult,
  type SingleUninstallBackend,
  type UninstallBackend,
} from "./Uninstall"
import { canForceRemove, forceRemove, type ForceRemoveBackend } from "./ForceRemove"
import { elevationCandidates, isAccessDeniedError, parseElevatedFailure, retryElevated, type ElevatedBackend } from "./Elevate"
import { localizeBackendError } from "@/i18n/errors"
import { makeT } from "@/i18n/translate"
import type { Plugin } from "./Plugin"

const a: Plugin = { name: "A.vst3", installPath: "/vst3", type: "VST3" }
const b: Plugin = { name: "B.vst3", installPath: "/vst3", type: "VST3" }
const w: Plugin = { name: "W.vst3", installPath: "C:\\VST3", type: "VST3" }
const sizes = new Map<Plugin, number | null>([[a, 1000], [b, null], [w, 500]])
const sizeOf = (p: Plugin) => sizes.get(p)

describe("space freed", () => {
  it("sums known sizes and returns null when none is known", () => {
    expect(totalKnownSize([a, w], sizeOf)).toBe(1500)
    expect(totalKnownSize([a, b], sizeOf)).toBe(1000)
    expect(totalKnownSize([b], sizeOf)).toBeNull()
    expect(totalKnownSize([], sizeOf)).toBeNull()
    expect(totalKnownSize([a], () => Number.NaN)).toBeNull()
  })

  it("counts only the plugins that were removed", () => {
    const items: BatchItemResult[] = [
      { plugin: a, status: "removed" },
      { plugin: w, status: "failed", error: "x" },
      { plugin: b, status: "still-present", action: "vendor" },
    ]
    expect(freedBytes(items, sizeOf)).toBe(1000)
    expect(freedBytes(items.slice(1), sizeOf)).toBeNull()
  })
})

describe("permanent delete method", () => {
  const backend = (fail?: string) => ({
    createRestorePoint: vi.fn(async (_d: string) => {}),
    trashPlugin: vi.fn(async (_p: string) => {}),
    deletePlugin: vi.fn(async (_p: string) => {
      if (fail) throw fail
    }),
  }) satisfies UninstallBackend

  it("deletes instead of trashing and marks the items", async () => {
    const be = backend()
    const r = await uninstallPlugins([a, b], { restorePoint: false, backend: be, confirmContinue: vi.fn(), deleteMethod: "permanent" })
    expect(be.trashPlugin).not.toHaveBeenCalled()
    expect(be.deletePlugin.mock.calls.map(c => c[0])).toEqual(["/vst3/A.vst3", "/vst3/B.vst3"])
    expect(r.results.every(x => x.status === "removed" && x.action === "delete")).toBe(true)
  })

  it("keeps trashing by default", async () => {
    const be = backend()
    await uninstallPlugins([a], { restorePoint: false, backend: be, confirmContinue: vi.fn() })
    expect(be.trashPlugin).toHaveBeenCalledTimes(1)
    expect(be.deletePlugin).not.toHaveBeenCalled()
  })

  it("reports a failed deletion with its error", async () => {
    const be = backend("ERR_DELETE_FAILED:in use")
    const r = await uninstallPlugins([a], { restorePoint: false, backend: be, confirmContinue: vi.fn(), deleteMethod: "permanent" })
    expect(r.results[0]).toEqual({ plugin: a, status: "failed", action: "delete", error: "ERR_DELETE_FAILED:in use" })
  })

  it("fails safe (and never trashes) when the backend cannot delete", async () => {
    const be = { createRestorePoint: vi.fn(), trashPlugin: vi.fn(async (_p: string) => {}) } satisfies UninstallBackend
    const r = await uninstallPlugins([a], { restorePoint: false, backend: be, confirmContinue: vi.fn(), deleteMethod: "permanent" })
    expect(r.results[0].status).toBe("failed")
    expect(be.trashPlugin).not.toHaveBeenCalled()
  })

  it("single flow: leftovers and plugin follow the delete method", async () => {
    const be = {
      createRestorePoint: vi.fn(),
      trashPlugin: vi.fn(async (_p: string) => {}),
      deletePlugin: vi.fn(async (_p: string) => {}),
      trashLeftovers: vi.fn(async (_p: string, _l: string[]) => [] as string[]),
      deleteLeftovers: vi.fn(async (_p: string, _l: string[]) => ["ERR_DELETE_FAILED(busy):/x/Foo"]),
      runVendorUninstaller: vi.fn(),
      pathExists: vi.fn(async (_p: string) => false),
    } satisfies SingleUninstallBackend
    const r = await uninstallSingle(a, { restorePoint: false, backend: be, confirmContinue: vi.fn(), leftovers: ["/x/Foo", "/x/Bar"], method: "trash", deleteMethod: "permanent" })
    expect(be.trashLeftovers).not.toHaveBeenCalled()
    expect(be.trashPlugin).not.toHaveBeenCalled()
    expect(be.deleteLeftovers).toHaveBeenCalledWith("/vst3/A.vst3", ["/x/Foo", "/x/Bar"])
    expect(r.plugin).toEqual({ action: "delete", status: "removed" })
    expect(r.leftoversTrashed).toBe(1)
    expect(r.leftoverFailures).toEqual([{ path: "/x/Foo", error: "ERR_LEFTOVER_DELETE_FAILED:busy" }])
  })

  it("parses delete failures of leftovers", () => {
    expect(parseLeftoverFailure("ERR_DELETE_FAILED(denied):C:\\Users\\x\\Foo")).toEqual({
      path: "C:\\Users\\x\\Foo",
      error: "ERR_LEFTOVER_DELETE_FAILED:denied",
    })
  })

  it("localizes the delete error codes", () => {
    const t = makeT("en")
    expect(localizeBackendError("ERR_DELETE_FAILED:in use", t)).toContain("in use")
    expect(localizeBackendError("ERR_DELETE_ACCESS_DENIED", t)).toMatch(/administrator/)
    expect(localizeBackendError("ERR_LEFTOVER_DELETE_FAILED:x", makeT("it"))).toContain("x")
  })
})

describe("elevated retry of permanent deletions", () => {
  const denied = (p: Plugin, action?: "delete"): BatchItemResult => ({ plugin: p, status: "failed", error: action ? "ERR_DELETE_ACCESS_DENIED" : "ERR_TRASH_ACCESS_DENIED", action })
  const be = (del: (p: string[]) => Promise<string[]>) =>
    ({ trashPluginsElevated: vi.fn(async (_p: string[]) => [] as string[]), deletePluginsElevated: vi.fn(del) }) satisfies ElevatedBackend

  it("recognises the delete access-denied code", () => {
    expect(isAccessDeniedError("ERR_DELETE_ACCESS_DENIED")).toBe(true)
    expect(isAccessDeniedError("ERR_DELETE_FAILED:in use")).toBe(false)
    expect(parseElevatedFailure("ERR_DELETE_FAILED(In use):C:\\a.vst3")).toEqual({ path: "C:\\a.vst3", error: "ERR_DELETE_FAILED:In use" })
  })

  it("routes delete items to the elevated delete and trash items to the elevated trash", async () => {
    const backend = be(async () => [])
    const items = [denied(w, "delete"), denied({ ...w, name: "T.vst3" })]
    const r = await retryElevated(items, true, backend)
    expect(backend.deletePluginsElevated).toHaveBeenCalledWith(["C:\\VST3/W.vst3".replace("/", "\\")])
    expect(backend.trashPluginsElevated).toHaveBeenCalledTimes(1)
    expect(r.items.map(i => i.status)).toEqual(["removed", "removed"])
    expect(r.items[0].action).toBe("delete")
    expect(elevationCandidates(r.items, true)).toEqual([])
  })

  it("keeps the item and reports the call error when elevated delete is unavailable", async () => {
    const backend = { trashPluginsElevated: vi.fn(async (_p: string[]) => [] as string[]) } satisfies ElevatedBackend
    const items = [denied(w, "delete")]
    const r = await retryElevated(items, true, backend)
    expect(r.items).toBe(items)
    expect(r.callError).toBeDefined()
  })
})

describe("forced removal", () => {
  const backend = (del: (p: string) => Promise<void>, elevated?: (p: string[]) => Promise<string[]>) =>
    ({ deletePlugin: vi.fn(del), ...(elevated && { deletePluginsElevated: vi.fn(elevated) }) }) satisfies ForceRemoveBackend
  const failed = (error: string): BatchItemResult => ({ plugin: w, status: "failed", error })
  const WPATH = "C:\\VST3\\W.vst3"

  it("is offered for failures and leftovers but not for gone or invalid paths", () => {
    expect(canForceRemove(failed("ERR_TRASH_FAILED:in use"))).toBe(true)
    expect(canForceRemove(failed("ERR_DELETE_ACCESS_DENIED"))).toBe(true)
    expect(canForceRemove({ plugin: w, status: "still-present", action: "vendor" })).toBe(true)
    expect(canForceRemove(failed("ERR_NOT_FOUND"))).toBe(false)
    expect(canForceRemove(failed("ERR_INVALID_PATH"))).toBe(false)
    expect(canForceRemove({ plugin: w, status: "removed" })).toBe(false)
  })

  it("deletes the exact path with the permanent delete", async () => {
    const be = backend(async () => {})
    const r = await forceRemove(failed("x"), { isWindows: true, alreadyElevated: false, backend: be })
    expect(be.deletePlugin).toHaveBeenCalledWith(WPATH)
    expect(r).toEqual({ plugin: w, status: "removed", action: "delete" })
  })

  it("shows the error text when the file is in use", async () => {
    const be = backend(async () => { throw "ERR_DELETE_FAILED:The process cannot access the file (os error 32)" }, async () => [])
    const r = await forceRemove(failed("x"), { isWindows: true, alreadyElevated: false, backend: be })
    expect(r.status).toBe("failed")
    expect(r.error).toContain("os error 32")
    expect(be.deletePluginsElevated).not.toHaveBeenCalled()
  })

  it("retries elevated once on access denied (Windows, not elevated)", async () => {
    const be = backend(async () => { throw "ERR_DELETE_ACCESS_DENIED" }, async () => [])
    const r = await forceRemove(failed("x"), { isWindows: true, alreadyElevated: false, backend: be })
    expect(be.deletePluginsElevated).toHaveBeenCalledWith([WPATH])
    expect(r.status).toBe("removed")
  })

  it("keeps the elevated failure text", async () => {
    const be = backend(async () => { throw "ERR_DELETE_ACCESS_DENIED" }, async () => [`ERR_DELETE_FAILED(In use):${WPATH}`])
    const r = await forceRemove(failed("x"), { isWindows: true, alreadyElevated: false, backend: be })
    expect(r).toEqual({ plugin: w, status: "failed", action: "delete", error: "ERR_DELETE_FAILED:In use" })
  })

  it("reports a cancelled UAC prompt", async () => {
    const be = backend(async () => { throw "ERR_DELETE_ACCESS_DENIED" }, async () => { throw "ERR_ELEVATION_CANCELLED" })
    const r = await forceRemove(failed("x"), { isWindows: true, alreadyElevated: false, backend: be })
    expect(r.error).toBe("ERR_ELEVATION_CANCELLED")
  })

  it("never elevates off Windows or when already elevated", async () => {
    for (const opts of [{ isWindows: false, alreadyElevated: false }, { isWindows: true, alreadyElevated: true }]) {
      const be = backend(async () => { throw "ERR_DELETE_ACCESS_DENIED" }, async () => [])
      const r = await forceRemove(failed("x"), { ...opts, backend: be })
      expect(r.status).toBe("failed")
      expect(be.deletePluginsElevated).not.toHaveBeenCalled()
    }
  })
})
