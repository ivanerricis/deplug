import { describe, expect, it, vi } from "vitest"
import { elevationCandidates, restoreOutcomeKey, isAccessDeniedError, parseElevatedFailure, retryElevated, type ElevatedBackend } from "./Elevate"
import type { BatchItemResult } from "./Uninstall"
import type { Plugin } from "./Plugin"
import { localizeBackendError } from "@/i18n/errors"
import { makeT } from "@/i18n/translate"

const mk = (name: string): Plugin => ({ name, installPath: "C:\\Program Files\\Common Files\\VST3", type: "VST3" })
const P = ["A.vst3", "B.vst3", "C.vst3", "D.vst3"].map(mk)
const path = (p: Plugin) => `${p.installPath}\\${p.name}`
const denied = (p: Plugin): BatchItemResult => ({ plugin: p, status: "failed", error: "ERR_TRASH_ACCESS_DENIED" })
const allDenied = P.map(denied)
const backend = (impl: (paths: string[]) => Promise<string[]>) => ({ trashPluginsElevated: vi.fn(impl) }) satisfies ElevatedBackend

describe("elevation", () => {
  it("recognises access-denied errors, including the legacy raw text", () => {
    expect(isAccessDeniedError("ERR_TRASH_ACCESS_DENIED")).toBe(true)
    expect(isAccessDeniedError('ERR_TRASH_FAILED:Error ... "Some operations were aborted"')).toBe(true)
    expect(isAccessDeniedError("ERR_TRASH_FAILED:busy")).toBe(false)
    expect(isAccessDeniedError(undefined)).toBe(false)
  })

  it("offers every plugin when the whole batch was denied", () => {
    expect(elevationCandidates(allDenied, true)).toHaveLength(4)
  })

  it("offers only the denied plugins in a partial failure", () => {
    const items: BatchItemResult[] = [{ plugin: P[0], status: "removed" }, denied(P[1]), { plugin: P[2], status: "failed", error: "ERR_TRASH_FAILED:busy" }]
    expect(elevationCandidates(items, true).map(i => i.plugin.name)).toEqual(["B.vst3"])
  })

  it("offers nothing for non access-denied errors", async () => {
    const items: BatchItemResult[] = [{ plugin: P[0], status: "failed", error: "ERR_TRASH_FAILED:busy" }]
    const b = backend(async () => [])
    expect(elevationCandidates(items, true)).toEqual([])
    expect((await retryElevated(items, true, b)).items).toBe(items)
    expect(b.trashPluginsElevated).not.toHaveBeenCalled()
  })

  it("never shows the button off Windows", async () => {
    const b = backend(async () => [])
    expect(elevationCandidates(allDenied, false)).toEqual([])
    await retryElevated(allDenied, false, b)
    expect(b.trashPluginsElevated).not.toHaveBeenCalled()
  })

  it("offers nothing when the process is already elevated", async () => {
    const b = backend(async () => [])
    expect(elevationCandidates(allDenied, true, true)).toEqual([])
    expect((await retryElevated(allDenied, true, b, true)).items).toBe(allDenied)
    expect(b.trashPluginsElevated).not.toHaveBeenCalled()
  })

  it("retries once with the full paths and marks everything removed on success", async () => {
    const b = backend(async () => [])
    const r = await retryElevated(allDenied, true, b)
    expect(b.trashPluginsElevated).toHaveBeenCalledTimes(1)
    expect(b.trashPluginsElevated).toHaveBeenCalledWith(P.map(path))
    expect(r.callError).toBeUndefined()
    expect(r.items.map(i => i.status)).toEqual(["removed", "removed", "removed", "removed"])
    expect(elevationCandidates(r.items, true)).toEqual([])
  })

  it("keeps per-path failures on a partial retry", async () => {
    const b = backend(async () => [`ERR_TRASH_FAILED(File in use):${path(P[2])}`])
    const r = await retryElevated(allDenied, true, b)
    expect(r.items.map(i => i.status)).toEqual(["removed", "removed", "failed", "removed"])
    expect(r.items[2].error).toBe("ERR_TRASH_FAILED:File in use")
    expect(elevationCandidates(r.items, true)).toEqual([])
  })

  it("leaves everything as it was when the UAC prompt is cancelled", async () => {
    const b = backend(async () => { throw "ERR_ELEVATION_CANCELLED" })
    const r = await retryElevated(allDenied, true, b)
    expect(r.items).toBe(allDenied)
    expect(r.callError).toBe("ERR_ELEVATION_CANCELLED")
    expect(elevationCandidates(r.items, true)).toHaveLength(4)
    expect(localizeBackendError(r.callError!, makeT("en"))).toMatch(/cancelled/)
  })

  it("parses failure entries with drive-letter colons", () => {
    expect(parseElevatedFailure("ERR_TRASH_FAILED(boom):C:\\a.dll")).toEqual({ path: "C:\\a.dll", error: "ERR_TRASH_FAILED:boom" })
    expect(parseElevatedFailure("ERR_INVALID_PATH:C:\\a.dll")).toEqual({ path: "C:\\a.dll", error: "ERR_INVALID_PATH" })
  })

  it("localizes the new codes and the legacy text", () => {
    const en = makeT("en")
    const it_ = makeT("it")
    expect(localizeBackendError("ERR_TRASH_ACCESS_DENIED", en)).toBe("Windows denied the operation: administrator permission is needed.")
    expect(localizeBackendError("ERR_TRASH_ACCESS_DENIED", it_)).toBe("Windows ha negato l'operazione: servono i permessi di amministratore.")
    expect(localizeBackendError('ERR_TRASH_FAILED:Error during a `trash` operation: Unknown { description: "Some operations were aborted" }', en)).toBe(
      "Windows denied the operation: administrator permission is needed.",
    )
    expect(localizeBackendError("ERR_ELEVATION_UNSUPPORTED", en)).not.toBe("ERR_ELEVATION_UNSUPPORTED")
  })

  it("describes the restore point outcome", () => {
    expect(restoreOutcomeKey("created", true)).toBe("uninstall.result.restorePointCreated")
    expect(restoreOutcomeKey("failed", true)).toBe("uninstall.result.restorePointFailed")
    expect(restoreOutcomeKey("skipped", true)).toBe("uninstall.result.restorePointSkipped")
    expect(restoreOutcomeKey("skipped", false)).toBeNull()
  })
})
