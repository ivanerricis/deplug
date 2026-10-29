import { describe, expect, it } from "vitest"
import { en } from "./en"
import { it as itDict } from "./it"
import { interpolate, makeT, resolveLanguage } from "./translate"
import { localizeBackendError } from "./errors"

describe("dictionaries", () => {
  it("have identical keys", () => {
    expect(Object.keys(itDict).sort()).toEqual(Object.keys(en).sort())
  })

  it("have no empty values and the same placeholders", () => {
    const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort()
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(en[key].length, key).toBeGreaterThan(0)
      expect(itDict[key].length, key).toBeGreaterThan(0)
      expect(placeholders(itDict[key]), key).toEqual(placeholders(en[key]))
    }
  })
})

describe("interpolate / t", () => {
  it("replaces placeholders and keeps unknown ones", () => {
    expect(interpolate("a {x} b {y}", { x: 1 })).toBe("a 1 b {y}")
    expect(interpolate("plain")).toBe("plain")
  })

  it("translates per language", () => {
    expect(makeT("en")("toolbar.count", { count: 3 })).toBe("Plugins found: 3")
    expect(makeT("it")("toolbar.count", { count: 3 })).toBe("Plugin trovati: 3")
  })
})

describe("resolveLanguage", () => {
  it("honours explicit choices", () => {
    expect(resolveLanguage("en", "it-IT")).toBe("en")
    expect(resolveLanguage("it", "en-US")).toBe("it")
  })

  it("resolves system from the navigator language", () => {
    expect(resolveLanguage("system", "it-IT")).toBe("it")
    expect(resolveLanguage("system", "IT")).toBe("it")
    expect(resolveLanguage("system", "en-GB")).toBe("en")
    expect(resolveLanguage("system", "fr-FR")).toBe("en")
    expect(resolveLanguage("system", undefined)).toBe("en")
  })
})

describe("localizeBackendError", () => {
  const t = makeT("en")
  it("maps stable codes", () => {
    expect(localizeBackendError("ERR_INVALID_PATH", t)).toBe(en["error.invalidPath"])
    expect(localizeBackendError("ERR_NOT_FOUND", t)).toBe(en["error.notFound"])
    expect(localizeBackendError("ERR_RESTORE_UNSUPPORTED", t)).toBe(en["error.restoreUnsupported"])
    expect(localizeBackendError("ERR_RESTORE_UAC_CANCELLED", t)).toBe(en["error.restoreUacCancelled"])
    expect(localizeBackendError("ERR_RESTORE_PROTECTION_DISABLED", t)).toBe(en["error.restoreProtectionDisabled"])
    expect(localizeBackendError("ERR_RESTORE_FREQUENCY", t)).toBe(en["error.restoreFrequency"])
    expect(localizeBackendError("WARN_NOT_WRITABLE", t)).toBe(en["warn.notWritable"])
    expect(localizeBackendError("WARN_APP_TRANSLOCATION", t)).toBe(en["warn.appTranslocation"])
  })

  it("maps codes with a detail, keeping colons in the detail", () => {
    expect(localizeBackendError("ERR_TRASH_FAILED:permission denied", t)).toBe(
      "Could not move the plugin to the trash: permission denied",
    )
    expect(localizeBackendError("ERR_RESTORE_FAILED:0x80042306: busy", t)).toBe(
      "Could not create the restore point: 0x80042306: busy",
    )
    expect(localizeBackendError("ERR_INTERNAL:join error", t)).toBe("An unexpected error occurred: join error")
    expect(localizeBackendError("ERR_TRASH_FAILED:x", makeT("it"))).toContain("cestino")
  })

  it("shows unknown strings as-is", () => {
    expect(localizeBackendError("something exploded", t)).toBe("something exploded")
    expect(localizeBackendError("ERR_UNKNOWN:x", t)).toBe("ERR_UNKNOWN:x")
    expect(localizeBackendError("", t)).toBe("")
  })
})
