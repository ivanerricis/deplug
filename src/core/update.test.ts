import { describe, expect, it } from "vitest"
import { checkForUpdate, compareVersions, evaluateReleases, parseVersion, startupCheckDue, UPDATE_CHECK_INTERVAL_MS } from "./update"

const v = (s: string) => parseVersion(s)!

describe("parseVersion", () => {
  it("parses stable, v-prefixed and pre-release versions", () => {
    expect(v("1.2.3")).toEqual({ major: 1, minor: 2, patch: 3, pre: [] })
    expect(v("v0.1.0-rc.1")).toEqual({ major: 0, minor: 1, patch: 0, pre: ["rc", "1"] })
    expect(v("2.0.0+build.5").pre).toEqual([])
  })
  it("rejects garbage", () => {
    expect(parseVersion("latest")).toBeNull()
    expect(parseVersion("1.2")).toBeNull()
    expect(parseVersion("")).toBeNull()
  })
})

describe("compareVersions", () => {
  it("orders numerically, not lexically", () => {
    expect(compareVersions(v("0.10.0"), v("0.9.9"))).toBe(1)
    expect(compareVersions(v("1.0.0"), v("1.0.0"))).toBe(0)
  })
  it("ranks a stable version above its pre-releases", () => {
    expect(compareVersions(v("0.1.0"), v("0.1.0-rc.1"))).toBe(1)
    expect(compareVersions(v("0.1.0-rc.2"), v("0.1.0-rc.10"))).toBe(-1)
    expect(compareVersions(v("0.1.0-rc.1"), v("0.1.0-beta.9"))).toBe(1)
  })
})

describe("evaluateReleases", () => {
  const releases = [
    { tag_name: "v0.2.0-rc.1", prerelease: true },
    { tag_name: "v0.1.1" },
    { tag_name: "v0.1.0" },
    { tag_name: "v0.3.0", draft: true },
  ]
  it("offers the newest published stable release", () => {
    const r = evaluateReleases("0.1.0", releases)
    expect(r).toMatchObject({ status: "available", latest: "0.1.1" })
    expect((r as { url: string }).url).toContain("/releases/tag/v0.1.1")
  })
  it("ignores drafts and, for stable users, pre-releases", () => {
    expect(evaluateReleases("0.1.1", releases).status).toBe("up-to-date")
  })
  it("includes pre-releases on the prerelease channel and flags them", () => {
    expect(evaluateReleases("0.1.0", releases, "prerelease")).toMatchObject({ status: "available", latest: "0.2.0-rc.1", prerelease: true })
    expect(evaluateReleases("0.1.0", releases)).toMatchObject({ latest: "0.1.1", prerelease: false })
  })
  it("ignores releases flagged as pre-release on the stable channel, even with a stable-looking tag", () => {
    expect(evaluateReleases("0.1.0", [{ tag_name: "v0.5.0", prerelease: true }], "stable").status).toBe("up-to-date")
    expect(evaluateReleases("0.1.0", [{ tag_name: "v0.5.0", prerelease: true }], "prerelease")).toMatchObject({ latest: "0.5.0", prerelease: true })
  })
  it("does not offer a pre-release to a stable-channel user running a pre-release", () => {
    expect(evaluateReleases("0.1.0-rc.1", releases).status).toBe("available")
    expect(evaluateReleases("0.1.0-rc.1", releases)).toMatchObject({ latest: "0.1.1" })
    expect(evaluateReleases("0.2.0-rc.1", releases).status).toBe("up-to-date")
  })
  it("prefers a newer stable over an older pre-release on the prerelease channel", () => {
    expect(evaluateReleases("0.1.0", [{ tag_name: "v0.2.0-rc.1", prerelease: true }, { tag_name: "v0.2.0" }], "prerelease")).toMatchObject({ latest: "0.2.0", prerelease: false })
  })
  it("reports an invalid running version and handles empty lists", () => {
    expect(evaluateReleases("dev", releases)).toEqual({ status: "error", reason: "invalid-version" })
    expect(evaluateReleases("0.1.0", []).status).toBe("up-to-date")
  })
})

describe("startupCheckDue", () => {
  const now = 1_800_000_000_000
  it("is never due when disabled", () => {
    expect(startupCheckDue({ checkUpdatesOnStartup: false, lastUpdateCheck: 0 }, now)).toBe(false)
  })
  it("is due when never checked or after 24 hours", () => {
    expect(startupCheckDue({ checkUpdatesOnStartup: true, lastUpdateCheck: 0 }, now)).toBe(true)
    expect(startupCheckDue({ checkUpdatesOnStartup: true, lastUpdateCheck: now - UPDATE_CHECK_INTERVAL_MS }, now)).toBe(true)
  })
  it("is not due within 24 hours, but is when the clock went back", () => {
    expect(startupCheckDue({ checkUpdatesOnStartup: true, lastUpdateCheck: now - UPDATE_CHECK_INTERVAL_MS + 1 }, now)).toBe(false)
    expect(startupCheckDue({ checkUpdatesOnStartup: true, lastUpdateCheck: now + 1000 }, now)).toBe(true)
  })
})

describe("checkForUpdate", () => {
  const ok = (body: unknown) => async () => ({ ok: true, json: async () => body }) as Response
  it("returns the evaluation on success", async () => {
    const r = await checkForUpdate("0.1.0", { fetchImpl: ok([{ tag_name: "v0.2.0" }]) })
    expect(r).toMatchObject({ status: "available", latest: "0.2.0" })
  })
  it("passes the channel through", async () => {
    const body = [{ tag_name: "v0.2.0-rc.1", prerelease: true }]
    expect((await checkForUpdate("0.1.0", { fetchImpl: ok(body) })).status).toBe("up-to-date")
    expect(await checkForUpdate("0.1.0", { fetchImpl: ok(body), channel: "prerelease" })).toMatchObject({ status: "available", prerelease: true })
  })
  it("treats HTTP errors (e.g. 404 on a private repo) as unavailable", async () => {
    const r = await checkForUpdate("0.1.0", { fetchImpl: async () => ({ ok: false, status: 404 }) as Response })
    expect(r).toEqual({ status: "error", reason: "unavailable" })
  })
  it("treats network failures and malformed bodies as errors", async () => {
    expect(await checkForUpdate("0.1.0", { fetchImpl: async () => { throw new Error("offline") } })).toEqual({ status: "error", reason: "network" })
    expect(await checkForUpdate("0.1.0", { fetchImpl: ok({ message: "x" }) })).toEqual({ status: "error", reason: "unavailable" })
  })
})
