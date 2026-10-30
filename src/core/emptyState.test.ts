import { describe, expect, it } from "vitest"
import { emptyStateKind, type EmptyStateInput } from "./emptyState"

const base: EmptyStateInput = {
  welcome: false,
  scanned: true,
  counts: { VST2: 2, VST3: 3, AAX: 0, AU: 0, CLAP: 0 },
  tab: "all",
  shown: 5,
}
const none = { VST2: 0, VST3: 0, AAX: 0, AU: 0, CLAP: 0 }

describe("emptyStateKind", () => {
  it("is null when there is a list", () => {
    expect(emptyStateKind(base)).toBeNull()
    expect(emptyStateKind({ ...base, tab: "VST3", shown: 3 })).toBeNull()
  })

  it("shows the welcome screen before anything else", () => {
    expect(emptyStateKind({ ...base, welcome: true, scanned: false, counts: none, shown: 0 })).toBe("welcome")
  })

  it("distinguishes not scanned from nothing found", () => {
    expect(emptyStateKind({ ...base, scanned: false, counts: none, shown: 0 })).toBe("idle")
    expect(emptyStateKind({ ...base, counts: none, shown: 0 })).toBe("none")
  })

  it("reports an empty format tab instead of a filter problem", () => {
    expect(emptyStateKind({ ...base, tab: "AAX", shown: 0 })).toBe("tab-empty")
    expect(emptyStateKind({ ...base, tab: "CLAP", shown: 0 })).toBe("tab-empty")
  })

  it("reports filters hiding everything when the tab has plugins", () => {
    expect(emptyStateKind({ ...base, shown: 0 })).toBe("no-match")
    expect(emptyStateKind({ ...base, tab: "VST3", shown: 0 })).toBe("no-match")
  })
})
