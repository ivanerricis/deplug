/** Keyboard shortcuts of the main window as a pure mapping from a key event to an action. */

export type ShortcutAction =
  | "focus-search"
  | "select-all"
  | "uninstall-selected"
  | "open-export"
  | "open-settings"
  | "rescan"
  | "open-shortcuts"

export interface ShortcutKeyEvent {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
}

export interface ShortcutContext {
  /** Focus is in a text field, select or contenteditable element: plain keys belong to it. */
  inInput: boolean
  /** A dialog or menu is open: the list shortcuts must not act behind it. */
  modalOpen: boolean
  hasSelection: boolean
  /** A scan is running (rescan would be redundant). */
  scanning: boolean
}

/** True for elements that consume typing or Delete/Ctrl+A themselves. */
export function isEditableTarget(el: Element | null): boolean {
  if (!el) return false
  const tag = el.tagName
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
  return (el as HTMLElement).isContentEditable === true
}

/** Returns the action for a key press, or null when it is not a shortcut in this context. */
export function shortcutAction(e: ShortcutKeyEvent, ctx: ShortcutContext): ShortcutAction | null {
  const mod = e.ctrlKey || e.metaKey
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key

  if (mod && !e.altKey && !e.shiftKey) {
    if (key === "f") return ctx.modalOpen ? null : "focus-search"
    if (key === ",") return ctx.modalOpen ? null : "open-settings"
    if (ctx.modalOpen) return null
    if (key === "e") return "open-export"
    if (key === "r") return ctx.scanning ? null : "rescan"
    if (key === "a") return ctx.inInput ? null : "select-all"
    return null
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return null

  if (ctx.modalOpen) return null
  if (key === "F5") return ctx.scanning ? null : "rescan"
  if (ctx.inInput) return null
  if (key === "Delete") return ctx.hasSelection ? "uninstall-selected" : null
  if (key === "?") return "open-shortcuts"
  return null
}
