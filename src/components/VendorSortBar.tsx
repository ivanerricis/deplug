import { ArrowDown, ArrowUp } from "lucide-react"
import { Button } from "./ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip"
import { useI18n } from "@/i18n/I18nProvider"
import type { VendorSort, VendorSortKey } from "@/core/plugin/Vendor"

type VendorSortBarProps = {
  sort: VendorSort
  onChange: (sort: VendorSort) => void
  /** Named producers shown (the Unknown group is not counted). */
  groups: number
}

const OPTIONS: { key: VendorSortKey; label: "vendor.sortName" | "vendor.sortCount" | "vendor.sortSize" }[] = [
  { key: "name", label: "vendor.sortName" },
  { key: "count", label: "vendor.sortCount" },
  { key: "size", label: "vendor.sortSize" },
]

/** Slim bar above the producer groups: how many there are and how they are ordered. */
export default function VendorSortBar({ sort, onChange, groups }: VendorSortBarProps) {
  const { t } = useI18n()
  const dirLabel = t(sort.dir === "asc" ? "vendor.dirAsc" : "vendor.dirDesc")
  const DirIcon = sort.dir === "asc" ? ArrowUp : ArrowDown
  return (
    <div className="flex flex-none items-center justify-between gap-2 px-3 pt-2">
      <span aria-live="polite" className="text-xs tabular-nums text-muted-foreground">{groups > 0 && t(groups === 1 ? "vendor.groupsOne" : "vendor.groups", { count: groups })}</span>
      <div className="flex items-center gap-1">
        <Select value={sort.key} onValueChange={key => onChange({ ...sort, key: key as VendorSortKey })}>
          <SelectTrigger size="sm" aria-label={t("vendor.sortLabel")} className="h-8 cursor-pointer gap-2 text-xs">
            <span className="text-muted-foreground">{t("vendor.sortLabel")}</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" align="end">
            {OPTIONS.map(o => (
              <SelectItem key={o.key} value={o.key} className="text-xs">{t(o.label)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="size-8" aria-label={dirLabel} onClick={() => onChange({ ...sort, dir: sort.dir === "asc" ? "desc" : "asc" })}>
              <DirIcon aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{dirLabel}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
