import { beforeEach, describe, expect, it } from "vitest"
import { ERROR_LOG_CAPACITY, clearErrors, getErrors, pushError, redactPaths } from "./errorLog"

describe("errorLog", () => {
  beforeEach(clearErrors)

  it("records source, message and an ISO time", () => {
    pushError("scan", new Error("boom"), new Date("2026-01-02T03:04:05Z"))
    expect(getErrors()).toEqual([{ time: "2026-01-02T03:04:05.000Z", source: "scan", message: "boom" }])
  })

  it("keeps only the newest 20 entries", () => {
    for (let i = 0; i < ERROR_LOG_CAPACITY + 5; i++) pushError("x", `e${i}`)
    const all = getErrors()
    expect(all).toHaveLength(ERROR_LOG_CAPACITY)
    expect(all[0].message).toBe("e5")
    expect(all[all.length - 1].message).toBe(`e${ERROR_LOG_CAPACITY + 4}`)
  })

  it("accepts non-Error values and truncates long messages", () => {
    pushError("a", "x".repeat(1000))
    pushError("b", 42)
    expect(getErrors()[0].message).toHaveLength(300)
    expect(getErrors()[1].message).toBe("42")
  })

  it("returns copies", () => {
    pushError("a", "m")
    getErrors()[0].message = "changed"
    expect(getErrors()[0].message).toBe("m")
  })
})

describe("redactPaths", () => {
  it("removes Windows paths, including spaces", () => {
    expect(redactPaths("failed to remove C:\\Program Files\\Foo\\bar.dll: Access is denied. (os error 5)")).toBe(
      "failed to remove <path>: Access is denied. (os error 5)",
    )
    expect(redactPaths("cannot open C:\\Plugins\\My Foo.vst3")).toBe("cannot open <path>")
  })
  it("removes UNC and POSIX paths", () => {
    expect(redactPaths("\\\\server\\share\\x")).toBe("<path>")
    expect(redactPaths("cannot open /Library/Audio/Foo.vst3: denied")).toBe("cannot open <path>: denied")
  })
  it("leaves plain text alone", () => {
    expect(redactPaths("Access is denied (os error 5)")).toBe("Access is denied (os error 5)")
    expect(redactPaths("a/b")).toBe("a/b")
  })
})
