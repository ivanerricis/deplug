/**
 * In-app update flow (Tauri updater plugin) as a small state machine.
 * The plugin calls live behind `UpdaterBackend`, so the logic is testable with a fake.
 */

export type DownloadEvent =
  | { event: "Started"; data: { contentLength?: number } }
  | { event: "Progress"; data: { chunkLength: number } }
  | { event: "Finished" }

/** An update found by the plugin, ready to be downloaded and installed. */
export interface PendingUpdate {
  version: string
  downloadAndInstall(onEvent: (e: DownloadEvent) => void): Promise<void>
}

export interface UpdaterBackend {
  /** Resolves to null when the plugin sees no update. */
  check(): Promise<PendingUpdate | null>
  relaunch(): Promise<void>
}

export type SelfUpdateState =
  | { phase: "idle" }
  | { phase: "checking" }
  /** The plugin cannot update this install (e.g. no matching package): use the manual flow. */
  | { phase: "manual" }
  | { phase: "available"; version: string }
  /** `total` is unknown when the server sends no content length. */
  | { phase: "downloading"; downloaded: number; total: number | null }
  | { phase: "ready"; version: string }
  | { phase: "error"; message: string }

export type SelfUpdateAction =
  | { type: "check" }
  | { type: "found"; version: string }
  | { type: "manual" }
  | { type: "install" }
  | { type: "started"; total: number | null }
  | { type: "chunk"; length: number }
  | { type: "installed"; version: string }
  | { type: "failed"; message: string }

export const initialSelfUpdateState: SelfUpdateState = { phase: "idle" }

export function selfUpdateReducer(state: SelfUpdateState, action: SelfUpdateAction): SelfUpdateState {
  switch (action.type) {
    case "check":
      return { phase: "checking" }
    case "found":
      return { phase: "available", version: action.version }
    case "manual":
      return { phase: "manual" }
    case "install":
      return { phase: "downloading", downloaded: 0, total: null }
    case "started":
      return state.phase === "downloading" ? { ...state, total: action.total } : state
    case "chunk":
      return state.phase === "downloading" ? { ...state, downloaded: state.downloaded + action.length } : state
    case "installed":
      return { phase: "ready", version: action.version }
    case "failed":
      return { phase: "error", message: action.message }
  }
}

/** Download progress as 0-100, or null while the total size is unknown. */
export function downloadPercent(state: SelfUpdateState): number | null {
  if (state.phase !== "downloading" || !state.total) return null
  return Math.min(100, Math.round((state.downloaded / state.total) * 100))
}

/** Plugin errors that mean "this install cannot self-update", not "something broke". */
export function isUnsupportedError(message: string): boolean {
  return /not supported|unsupported|was not found in the response|fallback platforms/i.test(message)
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/** Asks the plugin for an update; the result is dispatched, the pending update returned. */
export async function runCheck(
  backend: UpdaterBackend,
  dispatch: (a: SelfUpdateAction) => void,
): Promise<PendingUpdate | null> {
  dispatch({ type: "check" })
  try {
    const update = await backend.check()
    if (!update) {
      dispatch({ type: "manual" })
      return null
    }
    dispatch({ type: "found", version: update.version })
    return update
  } catch (e) {
    const message = errorMessage(e)
    dispatch(isUnsupportedError(message) ? { type: "manual" } : { type: "failed", message })
    return null
  }
}

export async function runInstall(update: PendingUpdate, dispatch: (a: SelfUpdateAction) => void): Promise<void> {
  dispatch({ type: "install" })
  try {
    await update.downloadAndInstall(e => {
      if (e.event === "Started") dispatch({ type: "started", total: e.data.contentLength ?? null })
      else if (e.event === "Progress") dispatch({ type: "chunk", length: e.data.chunkLength })
    })
    dispatch({ type: "installed", version: update.version })
  } catch (e) {
    const message = errorMessage(e)
    dispatch(isUnsupportedError(message) ? { type: "manual" } : { type: "failed", message })
  }
}

/** The real backend; plugin modules are loaded lazily so plain-browser dev mode never touches them. */
export const tauriUpdaterBackend: UpdaterBackend = {
  async check() {
    const { check } = await import("@tauri-apps/plugin-updater")
    return check()
  },
  async relaunch() {
    const { relaunch } = await import("@tauri-apps/plugin-process")
    await relaunch()
  },
}
