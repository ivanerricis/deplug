import { ArrowDown, ArrowUp, ChevronDown } from "lucide-react"
import { Checkbox } from "./ui/checkbox"
import { FormatDot } from "./FormatTag"
import { MODIFIED_CELL, ROW_GRID } from "./listLayout"
import { formatBytes } from "@/core/format"
import { useI18n } from "@/i18n/I18nProvider"
import type { SortKey, SortState } from "@/core/plugin/ListOps"
import type { PluginType } from "@/core/plugin/Plugin"

type HeaderRowProps = {
  type: PluginType
  expanded: boolean
  onToggle: () => void
  sort: SortState
  onSort: (key: SortKey) => void
  shown: number
  total: number
  selectState: boolean | "indeterminate"
  onSelectAll: () => void
  /** Total size of the shown plugins when known; shown next to the count. */
  sizeTotal?: number | null
}

function SortButton({ column, label, sort, onSort, className = "" }: { column: SortKey; label: string; sort: SortState; onSort: (key: SortKey) => void; className?: string }) {
  const { t } = useI18n()
  const active = sort.key === column
  const aria = !active ? "none" : sort.dir === "asc" ? "ascending" : "descending"
  const name = !active
    ? t("section.sortNone", { column: label })
    : t(sort.dir === "asc" ? "section.sortAsc" : "section.sortDesc", { column: label })
  const Icon = sort.dir === "asc" ? ArrowUp : ArrowDown
  return (
    <button
      type="button"
      role="columnheader"
      aria-sort={aria}
      onClick={() => onSort(column)}
      aria-label={name}
      title={name}
      className={`flex h-8 cursor-pointer items-center gap-1 rounded-md px-2 text-xs font-medium outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 ${active ? "text-foreground" : "text-muted-foreground"} ${className}`}
    >
      <span className="truncate">{label}</span>
      {/* Reserve the arrow's space so labels do not shift when the sort changes. */}
      <Icon aria-hidden className={`size-3 shrink-0 ${active ? "" : "opacity-0"}`} />
    </button>
  )
}

/** Sticky section header: collapse toggle, count and the sortable column labels. */
export default function HeaderRow({ type, expanded, onToggle, sort, onSort, shown, total, selectState, onSelectAll, sizeTotal = null }: HeaderRowProps) {
  const { t, language } = useI18n()
  return (
    <div role="row" className={`${ROW_GRID} sticky top-0 z-10 items-center border-b border-border bg-background`}>
      <div role="columnheader" className="flex h-10 items-center justify-center">
        <Checkbox
          checked={selectState}
          onCheckedChange={onSelectAll}
          aria-label={t("section.selectAll", { type })}
          disabled={shown === 0}
          className="relative after:absolute after:-inset-3 after:content-['']"
        />
      </div>

      <div role="columnheader" className="flex h-10 min-w-0 items-center gap-1">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={t(expanded ? "section.collapse" : "section.expand", { type })}
          className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md pl-1 pr-2 text-sm font-semibold outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <ChevronDown aria-hidden className={`size-4 text-muted-foreground transition-transform motion-reduce:transition-none ${expanded ? "" : "-rotate-90"}`} />
          <FormatDot type={type} />
          {type}
        </button>
        <span
          role="status"
          aria-label={t("section.countLabel", { shown, total, type })}
          className="mr-2 shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground"
        >
          {shown === total ? total : t("section.count", { shown, total })}
        </span>
        {sizeTotal !== null && (
          <span
            aria-label={t("section.sizeTotalLabel", { type, size: formatBytes(sizeTotal, language) })}
            className="mr-2 hidden shrink-0 text-[11px] tabular-nums text-muted-foreground sm:inline"
          >
            {t("section.sizeTotal", { size: formatBytes(sizeTotal, language) })}
          </span>
        )}
        <SortButton column="name" label={t("section.name")} sort={sort} onSort={onSort} />
        <SortButton column="path" label={t("section.path")} sort={sort} onSort={onSort} />
      </div>

      <div className="flex h-10 items-center justify-end">
        <SortButton column="size" label={t("section.size")} sort={sort} onSort={onSort} className="flex-row-reverse" />
      </div>
      <div className={`h-10 items-center ${MODIFIED_CELL}`}>
        <SortButton column="modified" label={t("section.modified")} sort={sort} onSort={onSort} />
      </div>
      <div aria-hidden />
    </div>
  )
}
