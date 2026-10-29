import { describe, expect, it } from "vitest"
import { formatBytes, formatDate, shortenPath } from "./format"

describe("formatBytes", () => {
  it("formats units", () => {
    expect(formatBytes(0, "en")).toBe("0 B")
    expect(formatBytes(1023, "en")).toBe("1023 B")
    expect(formatBytes(1024, "en")).toBe("1.0 KB")
    expect(formatBytes(12.4 * 1024 * 1024, "en")).toBe("12.4 MB")
    expect(formatBytes(150 * 1024 * 1024, "en")).toBe("150 MB")
    expect(formatBytes(1.5 * 1024 ** 3, "en")).toBe("1.5 GB")
  })
  it("localizes the decimal separator", () => {
    expect(formatBytes(12.4 * 1024 * 1024, "it")).toBe("12,4 MB")
  })
  it("gives a dash for unknown or invalid values", () => {
    expect(formatBytes(null)).toBe("—")
    expect(formatBytes(undefined)).toBe("—")
    expect(formatBytes(-1)).toBe("—")
    expect(formatBytes(NaN)).toBe("—")
  })
})

describe("formatDate", () => {
  it("uses the requested language", () => {
    const secs = Date.UTC(2025, 2, 9, 12) / 1000
    expect(formatDate(secs, "en")).toMatch(/Mar/)
    expect(formatDate(secs, "it")).toMatch(/mar/)
  })
  it("gives a dash when unknown", () => {
    expect(formatDate(null)).toBe("—")
  })
})

describe("shortenPath", () => {
  it("abbreviates the home folder", () => {
    expect(shortenPath("/Users/ivan/Library/Audio", "/Users/ivan")).toBe("~/Library/Audio")
    expect(shortenPath("/Users/ivanna/x", "/Users/ivan")).toBe("/Users/ivanna/x")
  })
  it("elides the middle of long paths", () => {
    const long = "C:/Program Files/Some Vendor/Deeply/Nested/Plugins/Common Files/VST3"
    expect(shortenPath(long, "", 40)).toBe("C:/…/Common Files/VST3")
  })
  it("leaves short paths alone", () => {
    expect(shortenPath("C:/VST3")).toBe("C:/VST3")
  })
})
