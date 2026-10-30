import { RELEASES_URL, REPO_URL } from "./appInfo"
import type { UpdateChannel } from "./settings/AppSettings"

export interface Version {
  major: number
  minor: number
  patch: number
  /** Pre-release identifiers, e.g. ["rc", "1"]; empty for a stable version. */
  pre: string[]
}

/** Parses "1.2.3", "v1.2.3" or "1.2.3-rc.1" (build metadata after "+" is ignored). */
export function parseVersion(input: string): Version | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(input.trim())
  if (!m) return null
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    pre: m[4] ? m[4].split(".") : [],
  }
}

function comparePre(a: string[], b: string[]): number {
  // A stable version is newer than any of its pre-releases.
  if (a.length === 0 && b.length === 0) return 0
  if (a.length === 0) return 1
  if (b.length === 0) return -1
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] === undefined) return -1
    if (b[i] === undefined) return 1
    const an = /^\d+$/.test(a[i])
    const bn = /^\d+$/.test(b[i])
    if (an && bn) {
      const d = Number(a[i]) - Number(b[i])
      if (d !== 0) return d < 0 ? -1 : 1
    } else if (an !== bn) {
      return an ? -1 : 1 // numeric identifiers sort before alphanumeric ones
    } else if (a[i] !== b[i]) {
      return a[i] < b[i] ? -1 : 1
    }
  }
  return 0
}

export function compareVersions(a: Version, b: Version): number {
  for (const key of ["major", "minor", "patch"] as const) {
    if (a[key] !== b[key]) return a[key] < b[key] ? -1 : 1
  }
  return comparePre(a.pre, b.pre)
}

export interface ReleaseInfo {
  tag_name: string
  html_url?: string
  draft?: boolean
  prerelease?: boolean
}

export type UpdateResult =
  | { status: "up-to-date"; current: string }
  | { status: "available"; current: string; latest: string; url: string; prerelease: boolean }
  | { status: "error"; reason: "unavailable" | "invalid-version" | "network" }

/**
 * Picks the newest published release that is newer than `current`.
 * The "stable" channel ignores pre-releases (GitHub flag or a version suffix); "prerelease" includes them.
 */
export function evaluateReleases(current: string, releases: ReleaseInfo[], channel: UpdateChannel = "stable"): UpdateResult {
  const cur = parseVersion(current)
  if (!cur) return { status: "error", reason: "invalid-version" }
  const includePre = channel === "prerelease"

  let best: { v: Version; r: ReleaseInfo } | null = null
  for (const r of releases) {
    if (r.draft) continue
    if (r.prerelease && !includePre) continue
    const v = parseVersion(r.tag_name)
    if (!v) continue
    if (v.pre.length > 0 && !includePre) continue
    if (!best || compareVersions(v, best.v) > 0) best = { v, r }
  }

  if (best && compareVersions(best.v, cur) > 0) {
    const tag = best.r.tag_name
    return {
      status: "available",
      current,
      latest: tag.replace(/^v/, ""),
      url: best.r.html_url ?? `${REPO_URL}/releases/tag/${tag}`,
      prerelease: best.v.pre.length > 0 || best.r.prerelease === true,
    }
  }
  return { status: "up-to-date", current }
}

const API_URL = `https://api.github.com/repos/${REPO_URL.replace("https://github.com/", "")}/releases?per_page=20`

export interface UpdateDeps {
  fetchImpl?: typeof fetch
  timeoutMs?: number
  channel?: UpdateChannel
}

/** Manual update check: asks the GitHub Releases API and compares with the running version. */
export async function checkForUpdate(current: string, deps: UpdateDeps = {}): Promise<UpdateResult> {
  const fetchImpl = deps.fetchImpl ?? fetch
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? 10_000)
  try {
    const res = await fetchImpl(API_URL, {
      headers: { Accept: "application/vnd.github+json" },
      signal: controller.signal,
    })
    // 404 also happens while the repository is private: nothing can be checked.
    if (!res.ok) return { status: "error", reason: "unavailable" }
    const data: unknown = await res.json()
    if (!Array.isArray(data)) return { status: "error", reason: "unavailable" }
    return evaluateReleases(current, data as ReleaseInfo[], deps.channel)
  } catch {
    return { status: "error", reason: "network" }
  } finally {
    clearTimeout(timer)
  }
}

export const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000

/** Whether the opt-in startup check is due: enabled, and none ran in the last 24 hours (a clock set back counts as due). */
export function startupCheckDue(
  settings: { checkUpdatesOnStartup: boolean; lastUpdateCheck: number },
  now: number,
): boolean {
  if (!settings.checkUpdatesOnStartup) return false
  const elapsed = now - settings.lastUpdateCheck
  return elapsed < 0 || elapsed >= UPDATE_CHECK_INTERVAL_MS
}

/** Page the user is sent to when no specific release URL is known. */
export const FALLBACK_RELEASES_URL = RELEASES_URL
