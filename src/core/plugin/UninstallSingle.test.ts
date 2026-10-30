import { describe, expect, it, vi } from "vitest"
import { parseLeftoverFailure, parseRegistryFailure, pluginWasRemoved, removeRegistryKeys, uninstallSingle, type RegistryDeleteResult, type SingleUninstallBackend } from "./Uninstall"
import { localizeBackendError } from "@/i18n/errors"
import { makeT } from "@/i18n/translate"
import type { Plugin } from "./Plugin"

const plugin: Plugin = { name: "Foo.vst3", installPath: "C:/VST3", type: "VST3" }
const PATH = "C:/VST3/Foo.vst3"
const LEFT = ["C:/Users/me/AppData/Roaming/Foo", "C:/ProgramData/Foo"]

function makeBackend(opts: { rp?: unknown; trash?: unknown; vendor?: unknown; left?: string[] | { throws: unknown }; exists?: boolean } = {}) {
  const calls: string[] = []
  const backend = {
    createRestorePoint: vi.fn(async (_d: string) => {
      calls.push("rp")
      if (opts.rp !== undefined) throw opts.rp
    }),
    trashPlugin: vi.fn(async (_p: string) => {
      calls.push("trash")
      if (opts.trash !== undefined) throw opts.trash
    }),
    trashLeftovers: vi.fn(async (_p: string, _paths: string[]) => {
      calls.push("leftovers")
      if (opts.left && !Array.isArray(opts.left)) throw opts.left.throws
      return (opts.left as string[] | undefined) ?? []
    }),
    runVendorUninstaller: vi.fn(async (_p: string) => {
      calls.push("vendor")
      if (opts.vendor !== undefined) throw opts.vendor
    }),
    pathExists: vi.fn(async (_p: string) => opts.exists ?? false),
  } satisfies SingleUninstallBackend
  return { backend, calls }
}

const base = { restorePoint: false, confirmContinue: vi.fn(), leftovers: [] as string[], method: "trash" as const }

describe("uninstallSingle", () => {
  it("only trashes the plugin by default", async () => {
    const { backend, calls } = makeBackend()
    const r = await uninstallSingle(plugin, { ...base, backend })
    expect(calls).toEqual(["trash"])
    expect(r.plugin).toEqual({ action: "trash", status: "removed" })
    expect(backend.trashLeftovers).not.toHaveBeenCalled()
  })

  it("trashes leftovers before the plugin, after the restore point", async () => {
    const { backend, calls } = makeBackend()
    const r = await uninstallSingle(plugin, { ...base, backend, restorePoint: true, leftovers: LEFT })
    expect(calls).toEqual(["rp", "leftovers", "trash"])
    expect(backend.trashLeftovers).toHaveBeenCalledWith(PATH, LEFT)
    expect(r).toMatchObject({ status: "completed", restorePoint: "created", leftoversTrashed: 2, leftoverFailures: [] })
  })

  it("runs the vendor uninstaller instead of trashing and reports success", async () => {
    const { backend, calls } = makeBackend({ exists: false })
    const r = await uninstallSingle(plugin, { ...base, backend, leftovers: [LEFT[0]], method: "vendor" })
    expect(calls).toEqual(["leftovers", "vendor"])
    expect(backend.trashPlugin).not.toHaveBeenCalled()
    expect(r.plugin).toEqual({ action: "vendor", status: "removed" })
  })

  it("reports a plugin that is still present after a successful vendor run, without trashing it", async () => {
    const { backend } = makeBackend({ exists: true })
    const r = await uninstallSingle(plugin, { ...base, backend, method: "vendor" })
    expect(r.plugin).toEqual({ action: "vendor", status: "still-present" })
    expect(backend.trashPlugin).not.toHaveBeenCalled()
  })

  it("treats an unreadable existence check as still present", async () => {
    const { backend } = makeBackend()
    backend.pathExists.mockRejectedValueOnce(new Error("denied"))
    const r = await uninstallSingle(plugin, { ...base, backend, method: "vendor" })
    expect(r.plugin?.status).toBe("still-present")
  })

  it.each([
    "ERR_VENDOR_UNSUPPORTED",
    "ERR_VENDOR_NOT_FOUND",
    "ERR_VENDOR_LAUNCH:boom",
    "ERR_VENDOR_FAILED:5",
    "ERR_VENDOR_TIMEOUT",
    "ERR_VENDOR_BAD_COMMAND",
    "ERR_VENDOR_ELEVATION_REQUIRED",
  ])("reports vendor failure %s and keeps the plugin", async code => {
    const { backend } = makeBackend({ vendor: code })
    const r = await uninstallSingle(plugin, { ...base, backend, method: "vendor" })
    expect(r.plugin).toEqual({ action: "vendor", status: "failed", error: code })
    expect(backend.pathExists).not.toHaveBeenCalled()
    expect(backend.trashPlugin).not.toHaveBeenCalled()
    // Every vendor code has an English and an Italian message.
    for (const lang of ["en", "it"] as const) {
      expect(localizeBackendError(code, makeT(lang))).not.toBe(code)
    }
  })

  it("reports a plugin trash failure", async () => {
    const { backend } = makeBackend({ trash: "ERR_TRASH_FAILED:denied" })
    const r = await uninstallSingle(plugin, { ...base, backend })
    expect(r.plugin).toEqual({ action: "trash", status: "failed", error: "ERR_TRASH_FAILED:denied" })
  })

  it("keeps going after partial leftover failures", async () => {
    const { backend } = makeBackend({ left: [`ERR_TRASH_FAILED(busy):${LEFT[1]}`] })
    const r = await uninstallSingle(plugin, { ...base, backend, leftovers: LEFT })
    expect(r.leftoversTrashed).toBe(1)
    expect(r.leftoverFailures).toEqual([{ path: LEFT[1], error: "ERR_LEFTOVER_TRASH_FAILED:busy" }])
    expect(r.plugin).toEqual({ action: "trash", status: "removed" })
  })

  it("marks every leftover failed when the whole call is rejected, then still removes the plugin", async () => {
    const { backend } = makeBackend({ left: { throws: "ERR_INVALID_PATH" } })
    const r = await uninstallSingle(plugin, { ...base, backend, leftovers: LEFT })
    expect(r.leftoversTrashed).toBe(0)
    expect(r.leftoverFailures.map(f => f.error)).toEqual(["ERR_INVALID_PATH", "ERR_INVALID_PATH"])
    expect(r.plugin?.status).toBe("removed")
  })

  it("continues after a failed restore point when the user agrees", async () => {
    const { backend, calls } = makeBackend({ rp: "ERR_RESTORE_FAILED:x" })
    const confirmContinue = vi.fn(async () => true)
    const r = await uninstallSingle(plugin, { ...base, backend, restorePoint: true, confirmContinue, leftovers: [LEFT[0]] })
    expect(confirmContinue).toHaveBeenCalledWith("ERR_RESTORE_FAILED:x")
    expect(calls).toEqual(["rp", "leftovers", "trash"])
    expect(r.restorePoint).toBe("failed")
  })

  it("touches nothing when the restore point fails and the user declines", async () => {
    const { backend, calls } = makeBackend({ rp: "ERR_RESTORE_FAILED:x" })
    const r = await uninstallSingle(plugin, { ...base, backend, restorePoint: true, confirmContinue: async () => false, leftovers: LEFT, method: "vendor" })
    expect(r).toEqual({ status: "cancelled", restorePoint: "failed", leftoversTrashed: 0, leftoverFailures: [], plugin: null })
    expect(calls).toEqual(["rp"])
  })
})

describe("parseLeftoverFailure", () => {
  it("keeps colons of Windows paths in the path", () => {
    expect(parseLeftoverFailure("ERR_LEFTOVER_INVALID:C:\\Users\\me\\Foo")).toEqual({ path: "C:\\Users\\me\\Foo", error: "ERR_LEFTOVER_INVALID" })
    expect(parseLeftoverFailure("ERR_TRASH_FAILED(permission denied):C:\\Foo")).toEqual({
      path: "C:\\Foo",
      error: "ERR_LEFTOVER_TRASH_FAILED:permission denied",
    })
  })
  it("passes unknown entries through", () => {
    expect(parseLeftoverFailure("weird")).toEqual({ path: "weird", error: "weird" })
  })
})

describe("registry keys left behind", () => {
  const PATH_KEYS = [String.raw`HKCU\Software\Acme`, String.raw`HKLM\SOFTWARE\Acme`]

  it("removes the ticked keys and reports the backup folder", async () => {
    const remove = vi.fn(async (_p: string, keys: string[]): Promise<RegistryDeleteResult> => ({ deleted: keys.length, failures: [], backupDir: "C:/data/registry-backups/1-Foo" }))
    const r = await removeRegistryKeys(PATH, PATH_KEYS, remove)
    expect(remove).toHaveBeenCalledWith(PATH, PATH_KEYS)
    expect(r).toEqual({ deleted: 2, failures: [], backupDir: "C:/data/registry-backups/1-Foo" })
  })

  it("reports per-key failures", async () => {
    const remove = async (): Promise<RegistryDeleteResult> => ({
      deleted: 1,
      failures: [String.raw`ERR_REGISTRY_DELETE_FAILED(Access denied):HKLM\SOFTWARE\Acme`],
      backupDir: "C:/b",
    })
    const r = await removeRegistryKeys(PATH, PATH_KEYS, remove)
    expect(r.deleted).toBe(1)
    expect(r.failures).toEqual([{ key: String.raw`HKLM\SOFTWARE\Acme`, error: "ERR_REGISTRY_DELETE_FAILED:Access denied" }])
  })

  it("counts every key as failed when the call is refused, for instance when the backup fails", async () => {
    const remove = async (): Promise<RegistryDeleteResult> => {
      throw "ERR_REGISTRY_BACKUP_FAILED:disk full"
    }
    const r = await removeRegistryKeys(PATH, PATH_KEYS, remove)
    expect(r).toEqual({ deleted: 0, failures: PATH_KEYS.map(key => ({ key, error: "ERR_REGISTRY_BACKUP_FAILED:disk full" })), backupDir: null })
  })

  it("only searches after the plugin itself is gone", () => {
    expect(pluginWasRemoved({ action: "trash", status: "removed" })).toBe(true)
    expect(pluginWasRemoved({ action: "vendor", status: "removed" })).toBe(true)
    expect(pluginWasRemoved({ action: "vendor", status: "still-present" })).toBe(false)
    expect(pluginWasRemoved({ action: "trash", status: "failed", error: "x" })).toBe(false)
    expect(pluginWasRemoved(null)).toBe(false)
  })

  it("parses registry failure entries", () => {
    expect(parseRegistryFailure(String.raw`ERR_REGISTRY_INVALID:HKCU\Software\X`)).toEqual({ key: String.raw`HKCU\Software\X`, error: "ERR_REGISTRY_INVALID" })
    expect(parseRegistryFailure(String.raw`ERR_ELEVATION_CANCELLED:HKLM\SOFTWARE\X`)).toEqual({ key: String.raw`HKLM\SOFTWARE\X`, error: "ERR_ELEVATION_CANCELLED" })
    expect(parseRegistryFailure("junk")).toEqual({ key: "junk", error: "junk" })
  })

  it("localizes the registry error codes", () => {
    const t = makeT("en")
    for (const code of ["ERR_REGISTRY_INVALID", "ERR_REGISTRY_UNSUPPORTED", "ERR_REGISTRY_DISABLED", "ERR_REGISTRY_NO_CONTEXT", "ERR_REGISTRY_DELETE_FAILED:x", "ERR_REGISTRY_BACKUP_FAILED:y"]) {
      expect(localizeBackendError(code, t)).not.toBe(code)
    }
  })
})
