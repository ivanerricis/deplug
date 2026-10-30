import { describe, expect, it } from "vitest"
import {
  downloadPercent,
  initialSelfUpdateState,
  isUnsupportedError,
  runCheck,
  runInstall,
  selfUpdateReducer,
  type DownloadEvent,
  type PendingUpdate,
  type SelfUpdateAction,
  type SelfUpdateState,
  type UpdaterBackend,
} from "./selfUpdate"

function recorder() {
  let state: SelfUpdateState = initialSelfUpdateState
  const states: SelfUpdateState[] = []
  const dispatch = (a: SelfUpdateAction) => {
    state = selfUpdateReducer(state, a)
    states.push(state)
  }
  return { dispatch, states, get state() { return state } }
}

const fakeUpdate = (events: DownloadEvent[], fail?: Error): PendingUpdate => ({
  version: "1.2.3",
  async downloadAndInstall(onEvent) {
    events.forEach(onEvent)
    if (fail) throw fail
  },
})

const backend = (check: UpdaterBackend["check"]): UpdaterBackend => ({ check, relaunch: async () => {} })

describe("runCheck", () => {
  it("goes idle -> checking -> available", async () => {
    const r = recorder()
    const u = fakeUpdate([])
    expect(await runCheck(backend(async () => u), r.dispatch)).toBe(u)
    expect(r.states.map(s => s.phase)).toEqual(["checking", "available"])
    expect(r.state).toEqual({ phase: "available", version: "1.2.3" })
  })
  it("falls back to manual when the plugin sees no update", async () => {
    const r = recorder()
    expect(await runCheck(backend(async () => null), r.dispatch)).toBeNull()
    expect(r.state.phase).toBe("manual")
  })
  it("falls back to manual for unsupported installs", async () => {
    const r = recorder()
    await runCheck(backend(async () => { throw new Error("Unsupported OS") }), r.dispatch)
    expect(r.state.phase).toBe("manual")
  })
  it("reports other errors", async () => {
    const r = recorder()
    await runCheck(backend(async () => { throw "boom" }), r.dispatch)
    expect(r.state).toEqual({ phase: "error", message: "boom" })
  })
})

describe("runInstall", () => {
  it("tracks download progress then becomes ready", async () => {
    const r = recorder()
    await runInstall(
      fakeUpdate([
        { event: "Started", data: { contentLength: 200 } },
        { event: "Progress", data: { chunkLength: 50 } },
        { event: "Progress", data: { chunkLength: 50 } },
        { event: "Finished" },
      ]),
      r.dispatch,
    )
    const downloading = r.states.filter(s => s.phase === "downloading")
    expect(downloading.map(downloadPercent)).toEqual([null, 0, 25, 50])
    expect(r.state).toEqual({ phase: "ready", version: "1.2.3" })
  })
  it("has no percentage without a content length", async () => {
    const r = recorder()
    await runInstall(fakeUpdate([{ event: "Started", data: {} }, { event: "Progress", data: { chunkLength: 5 } }]), r.dispatch)
    expect(r.states.some(s => s.phase === "downloading" && downloadPercent(s) !== null)).toBe(false)
  })
  it("ends in error when the install fails", async () => {
    const r = recorder()
    await runInstall(fakeUpdate([], new Error("signature mismatch")), r.dispatch)
    expect(r.state).toEqual({ phase: "error", message: "signature mismatch" })
  })
})

describe("isUnsupportedError", () => {
  it("recognises unsupported installs only", () => {
    expect(isUnsupportedError("the platform `linux-x86_64-deb` was not found in the response `platforms` object")).toBe(true)
    expect(isUnsupportedError("Could not fetch a valid release JSON from the remote")).toBe(false)
  })
})
