import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown } from "lucide-react"
import { Button } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import { useI18n } from "@/i18n/I18nProvider"
import type { SortKey, SortState } from "@/core/plugin/ListOps"

/** Shared column template so header and rows line up: select, actions, name, path. */
export const ROW_GRID = "grid grid-cols-[2.5rem_6rem_minmax(0,1fr)_minmax(0,1.4fr)]"

type HeaderRowProps = {
  type: string
  expanded: boolean
  onToggle: () => void
  sort: SortState
  onSort: (key: SortKey) => void
  shown: number
  total: number
  selectState: boolean | "indeterminate"
  onSelectAll: () => void
  className?: string
}

function SortButton({ column, label, sort, onSort }: { column: SortKey; label: string; sort: SortState; onSort: (key: SortKey) => void }) {
  const { t } = useI18n()
  const active = sort.key === column
  const aria = !active ? "none" : sort.dir === "asc" ? "ascending" : "descending"
  const name = !active
    ? t("section.sortNone", { column: label })
    : t(sort.dir === "asc" ? "section.sortAsc" : "section.sortDesc", { column: label })
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown
  return (
    <div role="columnheader" aria-sort={aria} className="flex min-w-0 items-center">
      <button
        type="button"
        onClick={() => onSort(column)}
        aria-label={name}
        title={name}
        className="flex h-8 cursor-pointer items-center gap-1.5 rounded px-2 text-sm font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span className="truncate">{label}</span>
        <Icon aria-hidden className={`size-3.5 shrink-0 ${active ? "" : "text-muted-foreground"}`} />
      </button>
    </div>
  )
}

export default function HeaderRow({ type, expanded, onToggle, sort, onSort, shown, total, selectState, onSelectAll, className }: HeaderRowProps) {
  const { t } = useI18n()
  return (
    <div role="row" className={`${ROW_GRID} items-center ${className ?? ""}`}>
      <div role="columnheader" className="flex h-full items-center justify-center border-r-2 border-foreground/50">
        <Checkbox
          checked={selectState}
          onCheckedChange={onSelectAll}
          aria-label={t("section.selectAll", { type })}
          disabled={shown === 0}
          className="relative after:absolute after:-inset-2.5 after:content-['']"
        />
      </div>
      <div role="columnheader" className="flex h-full items-center gap-2 border-r-2 border-foreground/50 p-1">
        <Button variant="outline" size="sm" onClick={onToggle} aria-expanded={expanded} aria-label={t(expanded ? "section.collapse" : "section.expand", { type })}>
          <ChevronDown aria-hidden className={`transition-transform ${expanded === false ? "-rotate-90" : ""}`} />
        </Button>
        <span className="text-sm font-medium">{type}</span>
      </div>
      <div className="h-full border-r-2 border-foreground/50 py-1">
        <SortButton column="name" label={t("section.name")} sort={sort} onSort={onSort} />
      </div>
      <div className="flex h-full items-center justify-between gap-2 py-1 pr-2">
        <SortButton column="path" label={t("section.path")} sort={sort} onSort={onSort} />
        <span
          role="status"
          aria-label={t("section.countLabel", { shown, total, type })}
          className="shrink-0 text-xs tabular-nums text-muted-foreground"
        >
          {t("section.count", { shown, total })}
        </span>
      </div>
    </div>
  )
}
