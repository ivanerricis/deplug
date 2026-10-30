import { describe, expect, it } from "vitest"
import { shortcutAction, type ShortcutContext, type ShortcutKeyEvent } from "./shortcuts"

const ev = (key: string, mods: Partial<ShortcutKeyEvent> = {}): ShortcutKeyEvent => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
})
const ctx = (over: Partial<ShortcutContext> = {}): ShortcutContext => ({
  inInput: false,
  modalOpen: false,
  hasSelection: true,
  scanning: false,
  ...over,
})

describe("shortcutAction", () => {
  it("maps Delete to uninstall only with a selection and outside inputs", () => {
    expect(shortcutAction(ev("Delete"), ctx())).toBe("uninstall-selected")
    expect(shortcutAction(ev("Delete"), ctx({ hasSelection: false }))).toBeNull()
    expect(shortcutAction(ev("Delete"), ctx({ inInput: true }))).toBeNull()
  })
  it("maps Ctrl/Cmd+A to select-all outside inputs only", () => {
    expect(shortcutAction(ev("a", { ctrlKey: true }), ctx())).toBe("select-all")
    expect(shortcutAction(ev("A", { metaKey: true }), ctx())).toBe("select-all")
    expect(shortcutAction(ev("a", { ctrlKey: true }), ctx({ inInput: true }))).toBeNull()
  })
  it("maps Ctrl/Cmd+E, +, and +F", () => {
    expect(shortcutAction(ev("e", { ctrlKey: true }), ctx())).toBe("open-export")
    expect(shortcutAction(ev(",", { metaKey: true }), ctx())).toBe("open-settings")
    expect(shortcutAction(ev("f", { ctrlKey: true }), ctx({ inInput: true }))).toBe("focus-search")
  })
  it("maps F5 and Ctrl/Cmd+R to rescan, also from inputs, unless scanning", () => {
    expect(shortcutAction(ev("F5"), ctx({ inInput: true }))).toBe("rescan")
    expect(shortcutAction(ev("r", { ctrlKey: true }), ctx())).toBe("rescan")
    expect(shortcutAction(ev("F5"), ctx({ scanning: true }))).toBeNull()
  })
  it("maps ? to the shortcuts help outside inputs", () => {
    expect(shortcutAction(ev("?", { shiftKey: true }), ctx())).toBe("open-shortcuts")
    expect(shortcutAction(ev("?"), ctx({ inInput: true }))).toBeNull()
  })
  it("does nothing behind an open dialog", () => {
    const m = ctx({ modalOpen: true })
    for (const e of [ev("Delete"), ev("a", { ctrlKey: true }), ev("e", { ctrlKey: true }), ev(",", { ctrlKey: true }), ev("F5"), ev("?"), ev("f", { ctrlKey: true })]) {
      expect(shortcutAction(e, m)).toBeNull()
    }
  })
  it("ignores other keys and extra modifiers", () => {
    expect(shortcutAction(ev("x"), ctx())).toBeNull()
    expect(shortcutAction(ev("a", { ctrlKey: true, shiftKey: true }), ctx())).toBeNull()
    expect(shortcutAction(ev("Delete", { altKey: true }), ctx())).toBeNull()
    expect(shortcutAction(ev("F5", { ctrlKey: true }), ctx())).toBeNull()
  })
})
