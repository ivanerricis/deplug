import { useEffect, useRef, type RefObject } from "react"

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Modal behaviour: Esc calls onEscape, Tab/Shift+Tab are trapped inside `ref`,
 * focus moves in on mount (to `initialFocus` or the first focusable) and returns
 * to the previously focused element on unmount.
 */
export function useModal(
  ref: RefObject<HTMLElement | null>,
  onEscape: () => void,
  initialFocus?: RefObject<HTMLElement | null>,
) {
  const escape = useRef(onEscape)
  escape.current = onEscape

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const root = ref.current
    const target = initialFocus?.current ?? root?.querySelector<HTMLElement>(FOCUSABLE) ?? root
    target?.focus()

    const onKey = (e: KeyboardEvent) => {
      const dialog = ref.current
      if (!dialog) return
      if (e.key === "Escape") {
        // A native <select> popup uses Esc to close itself.
        if (e.target instanceof HTMLSelectElement) return
        e.preventDefault()
        escape.current()
        return
      }
      if (e.key !== "Tab") return
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => el.offsetParent !== null)
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (!dialog.contains(active)) {
        e.preventDefault()
        first.focus()
      } else if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("keydown", onKey)
      if (previous && document.contains(previous)) previous.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
