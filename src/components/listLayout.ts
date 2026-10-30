import type { ColumnKey, DensitySetting } from "@/core/settings/AppSettings"

/**
 * Shared column template for section headers and rows: select, name, [size], [modified], actions.
 * The Modified column only exists from 900px up so the 720px minimum window never scrolls sideways.
 * Full class names are spelled out so Tailwind can see them.
 */
const GRIDS = {
  base: "grid grid-cols-[2.25rem_minmax(0,1fr)_5.5rem]",
  size: "grid grid-cols-[2.25rem_minmax(0,1fr)_4.75rem_5.5rem] min-[900px]:grid-cols-[2.25rem_minmax(0,1fr)_5rem_5.5rem]",
  modified: "grid grid-cols-[2.25rem_minmax(0,1fr)_5.5rem] min-[900px]:grid-cols-[2.25rem_minmax(0,1fr)_7rem_5.5rem]",
  both: "grid grid-cols-[2.25rem_minmax(0,1fr)_4.75rem_5.5rem] min-[900px]:grid-cols-[2.25rem_minmax(0,1fr)_5rem_7rem_5.5rem]",
} as const

export type ListColumns = Record<ColumnKey, boolean>

export function listColumns(visible: readonly ColumnKey[]): ListColumns {
  return {
    path: visible.includes("path"),
    size: visible.includes("size"),
    modified: visible.includes("modified"),
    arch: visible.includes("arch"),
  }
}

/** Grid template classes that only reserve room for the columns that are shown. */
export function rowGrid(columns: Pick<ListColumns, "size" | "modified">): string {
  if (columns.size && columns.modified) return GRIDS.both
  if (columns.size) return GRIDS.size
  if (columns.modified) return GRIDS.modified
  return GRIDS.base
}

/** Cell for the Modified column: hidden when the window is narrow. */
export const MODIFIED_CELL = "hidden min-[900px]:flex"

/** Vertical padding of a row's name cell. */
export function rowPadding(density: DensitySetting): string {
  return density === "compact" ? "py-0.5" : "py-2"
}
