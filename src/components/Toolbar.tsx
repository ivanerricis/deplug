import { useEffect, useState, type RefObject } from "react"
import { ChevronDown, Copy, Cpu, Download, OctagonAlert, RefreshCcw, Search, Settings, X } from "lucide-react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Toggle, toggleVariants } from "./ui/toggle"
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "./ui/dropdown-menu"
import BrandMark from "./BrandMark"
import { FormatDot } from "./FormatTag"
import { cn } from "@/lib/utils"
import { useI18n } from "@/i18n/I18nProvider"
import type { PluginType } from "@/core/plugin/Plugin"
import type { ArchFilter } from "@/core/plugin/ListOps"
import type { ExportFormat } from "@/core/plugin/Export"

type ToolbarProps = {
  pluginsCount: number
  /** Plugins found per format, before filtering. */
  counts: Record<PluginType, number>
  tab: "all" | PluginType
  onTabChange: (tab: "all" | PluginType) => void
  onRefresh: () => void
  onSettings?: () => void
  query: string
  onQueryChange: (value: string) => void
  searchRef: RefObject<HTMLInputElement | null>
  duplicatesOnly: boolean
  onToggleDuplicatesOnly: (value: boolean) => void
  duplicateCount: number
  damagedOnly: boolean
  onToggleDamagedOnly: (value: boolean) => void
  damagedCount: number
  /** Architecture filter; the control is hidden until the backend has reported at least one architecture. */
  archFilter: ArchFilter
  onArchFilterChange: (value: ArchFilter) => void
  archCounts: Record<ArchFilter, number>
  archAvailable: boolean
  /** How many plugins an export would write: the selection when there is one, otherwise what is shown. */
  exportCount: number
  exportSelection: boolean
  onExport: (format: ExportFormat) => void
  /** Increments to open the export menu from the keyboard (Ctrl/Cmd+E). */
  exportOpenSignal?: number
  /** A newer version was found by the startup check: shows a dot on the settings button. */
  updateAvailable?: boolean
}

const TYPES: PluginType[] = ["VST2", "VST3", "AAX", "AU", "CLAP"]

// Filter toggles share the control height (h-9) and the rounded-md corners of the search field and the format tabs.
const chip = "shrink-0 cursor-pointer gap-1.5 px-2.5 text-xs font-medium"
const chipOn = "border-signal/60 bg-signal/10 text-foreground hover:bg-signal/15 data-[state=on]:bg-signal/10 data-[state=on]:text-foreground"

/** One calm row: search, format chips, duplicates and damaged toggles, rescan, settings. */
export default function Toolbar({
  pluginsCount,
  counts,
  tab,
  onTabChange,
  onRefresh,
  onSettings,
  query,
  onQueryChange,
  searchRef,
  duplicatesOnly,
  onToggleDuplicatesOnly,
  duplicateCount,
  damagedOnly,
  onToggleDamagedOnly,
  damagedCount,
  archFilter,
  onArchFilterChange,
  archCounts,
  archAvailable,
  exportCount,
  exportSelection,
  onExport,
  exportOpenSignal = 0,
  updateAvailable = false,
}: ToolbarProps) {
  const { t } = useI18n()
  const [exportOpen, setExportOpen] = useState(false)
  useEffect(() => {
    if (exportOpenSignal > 0) setExportOpen(true)
  }, [exportOpenSignal])
  return (
    <div className="flex flex-none flex-wrap items-center gap-2 border-b border-border px-3 py-2">
      <BrandMark className="mr-1 hidden size-6 shrink-0 text-foreground min-[900px]:block" />

      <div className="relative min-w-[9rem] flex-1">
        <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={searchRef}
          type="text"
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          placeholder={t("toolbar.search")}
          aria-label={t("toolbar.searchLabel")}
          autoComplete="off"
          spellCheck={false}
          className="rounded-md border-transparent bg-secondary pl-8 pr-9 text-sm shadow-none hover:bg-accent/70 focus-visible:bg-background dark:bg-secondary dark:hover:bg-accent/70 dark:focus-visible:bg-background"
        />
        {query !== "" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => { onQueryChange(""); searchRef.current?.focus() }}
                aria-label={t("toolbar.searchClear")}
                className="absolute right-1 top-1/2 size-7 -translate-y-1/2"
              >
                <X aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("toolbar.searchClear")}</TooltipContent>
          </Tooltip>
        )}
      </div>

      <Tabs value={tab} onValueChange={v => onTabChange(v as "all" | PluginType)} className="shrink-0">
        <TabsList aria-label={t("toolbar.formats")} className="h-9 rounded-md">
          <TabsTrigger value="all" className="gap-1.5 px-2.5 text-xs">
            {t("toolbar.tabAll")}
            <span className="tabular-nums text-muted-foreground">{TYPES.reduce((n, type) => n + counts[type], 0)}</span>
          </TabsTrigger>
          {TYPES.map(type => (
            <TabsTrigger key={type} value={type} aria-label={t("toolbar.formatChip", { type, count: counts[type] })} className="gap-1.5 px-2.5 text-xs">
              <FormatDot type={type} />
              <span aria-hidden>{type}</span>
              <span aria-hidden className="tabular-nums text-muted-foreground max-[1099px]:hidden">{counts[type]}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Toggle
        pressed={duplicatesOnly}
        aria-label={t("toolbar.duplicatesOnly")}
        onPressedChange={onToggleDuplicatesOnly}
        variant="outline"
        className={cn(chip, duplicatesOnly && chipOn)}
      >
        <Copy aria-hidden className="size-3.5" />
        <span aria-hidden className="hidden min-[1100px]:inline">{t("toolbar.duplicatesShort")}</span>
        <span aria-hidden className="tabular-nums text-muted-foreground">{duplicateCount}</span>
      </Toggle>

      <Toggle
        pressed={damagedOnly}
        aria-label={t("toolbar.damagedOnly")}
        onPressedChange={onToggleDamagedOnly}
        variant="outline"
        className={cn(chip, damagedOnly && chipOn)}
      >
        <OctagonAlert aria-hidden className="size-3.5" />
        <span aria-hidden className="hidden min-[1100px]:inline">{t("toolbar.damagedShort")}</span>
        <span aria-hidden className="tabular-nums text-muted-foreground">{damagedCount}</span>
      </Toggle>

      {archAvailable && (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={t("toolbar.archLabel")}
            className={cn(toggleVariants({ variant: "outline" }), chip, archFilter !== "all" && chipOn)}
          >
            <Cpu aria-hidden className="size-3.5 min-[1100px]:hidden" />
            <span className={archFilter === "all" ? "hidden min-[1100px]:inline" : undefined}>{archFilter === "all" ? t("toolbar.arch") : t(`arch.${archFilter}`)}</span>
            <ChevronDown aria-hidden className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup value={archFilter} onValueChange={v => onArchFilterChange(v as ArchFilter)}>
              <DropdownMenuRadioItem value="all">
                {t("toolbar.archOption", { label: t("toolbar.archAll"), count: archCounts.all })}
              </DropdownMenuRadioItem>
              {(["x64", "x86", "arm64"] as const).map(a => (
                <DropdownMenuRadioItem key={a} value={a}>
                  {t("toolbar.archOption", { label: t(`arch.${a}`), count: archCounts[a] })}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <span aria-live="polite" className="whitespace-nowrap text-xs tabular-nums text-muted-foreground max-[1099px]:sr-only">
        {t("toolbar.count", { count: pluginsCount })}
      </span>

      <div className="flex items-center">
        <DropdownMenu open={exportOpen} onOpenChange={setExportOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={t("toolbar.export")} disabled={exportCount === 0}>
                  <Download aria-hidden />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>{t("toolbar.export")}</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              {t(exportSelection ? "toolbar.exportSelection" : "toolbar.exportShown", { count: exportCount })}
            </DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => onExport("csv")}>{t("toolbar.exportCsv")}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onExport("txt")}>{t("toolbar.exportTxt")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onRefresh} aria-label={t("toolbar.rescan")}>
              <RefreshCcw aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("toolbar.rescan")}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={onSettings} aria-label={t(updateAvailable ? "toolbar.settingsUpdate" : "toolbar.settings")} className="relative">
              <Settings aria-hidden />
              {updateAvailable && <span aria-hidden className="absolute right-1.5 top-1.5 size-2 rounded-full bg-signal" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t(updateAvailable ? "toolbar.settingsUpdate" : "toolbar.settings")}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
