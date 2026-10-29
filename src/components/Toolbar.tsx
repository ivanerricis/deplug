import type { RefObject } from "react"
import { Copy, RefreshCcw, Search, Settings, X } from "lucide-react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip"
import BrandMark from "./BrandMark"
import { FormatDot } from "./FormatTag"
import { useI18n } from "@/i18n/I18nProvider"
import type { PluginType } from "@/core/plugin/Plugin"

type ToolbarProps = {
  pluginsCount: number
  /** Plugins found per format, before filtering. */
  counts: Record<PluginType, number>
  visible: Record<PluginType, boolean>
  onToggleType: (type: PluginType, value: boolean) => void
  onRefresh: () => void
  onSettings?: () => void
  query: string
  onQueryChange: (value: string) => void
  searchRef: RefObject<HTMLInputElement | null>
  duplicatesOnly: boolean
  onToggleDuplicatesOnly: (value: boolean) => void
  duplicateCount: number
}

const TYPES: PluginType[] = ["VST2", "VST3", "AAX", "AU"]

const chipBase =
  "inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring"
const chipOn = "border-border bg-secondary text-foreground hover:bg-accent"
const chipOff = "border-transparent text-muted-foreground hover:bg-accent/60 hover:text-foreground"

/** One calm row: search, format chips, duplicates toggle, rescan, settings. */
export default function Toolbar({
  pluginsCount,
  counts,
  visible,
  onToggleType,
  onRefresh,
  onSettings,
  query,
  onQueryChange,
  searchRef,
  duplicatesOnly,
  onToggleDuplicatesOnly,
  duplicateCount,
}: ToolbarProps) {
  const { t } = useI18n()
  return (
    <div className="flex flex-none items-center gap-2 border-b border-border px-3 py-2">
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
          className="rounded-lg border-transparent bg-secondary pl-8 pr-9 text-sm shadow-none hover:bg-accent/70 focus-visible:bg-background dark:bg-secondary dark:hover:bg-accent/70 dark:focus-visible:bg-background"
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

      <div role="group" aria-label={t("toolbar.formats")} className="flex items-center gap-1">
        {TYPES.map(type => (
          <button
            key={type}
            type="button"
            aria-pressed={visible[type]}
            aria-label={t("toolbar.formatChip", { type, count: counts[type] })}
            onClick={() => onToggleType(type, !visible[type])}
            className={`${chipBase} ${visible[type] ? chipOn : chipOff}`}
          >
            <FormatDot type={type} className={visible[type] ? "" : "opacity-40"} />
            <span aria-hidden>{type}</span>
            <span aria-hidden className="hidden tabular-nums text-muted-foreground min-[900px]:inline">{counts[type]}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        aria-pressed={duplicatesOnly}
        aria-label={t("toolbar.duplicatesOnly")}
        onClick={() => onToggleDuplicatesOnly(!duplicatesOnly)}
        className={`${chipBase} ${duplicatesOnly ? "border-signal/60 bg-signal/10 text-foreground hover:bg-signal/15" : chipOff}`}
      >
        <Copy aria-hidden className="size-3.5" />
        <span aria-hidden>{t("toolbar.duplicatesShort")}</span>
        <span aria-hidden className="tabular-nums text-muted-foreground">{duplicateCount}</span>
      </button>

      <span aria-live="polite" className="whitespace-nowrap text-xs tabular-nums text-muted-foreground max-[1099px]:sr-only">
        {t("toolbar.count", { count: pluginsCount })}
      </span>

      <div className="flex items-center">
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
            <Button variant="ghost" size="icon" onClick={onSettings} aria-label={t("toolbar.settings")}>
              <Settings aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("toolbar.settings")}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
