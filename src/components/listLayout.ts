/**
 * Shared column template for section headers and rows: select, name, size, [modified], actions.
 * The Modified column only exists from 900px up so the 720px minimum window never scrolls sideways.
 */
export const ROW_GRID =
  "grid grid-cols-[2.25rem_minmax(0,1fr)_4.75rem_5.5rem] min-[900px]:grid-cols-[2.25rem_minmax(0,1fr)_5rem_7rem_5.5rem]"

/** Cell for the Modified column: hidden when the window is narrow. */
export const MODIFIED_CELL = "hidden min-[900px]:flex"
