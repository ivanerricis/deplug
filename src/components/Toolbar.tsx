import type { RefObject } from "react"
import { Button } from "./ui/button"
import { RefreshCcw, Search, Settings, X } from "lucide-react"
import { Checkbox } from "./ui/checkbox"
import { Label } from "./ui/label"
import { useI18n } from "@/i18n/I18nProvider"

type ToolbarProps = {
  pluginsCount: number
  onRefresh: () => void
  onSettings?: () => void
  showVST2: boolean
  showVST3: boolean
  showAAX: boolean
  showAU: boolean
  onToggleVST2: (value: boolean) => void
  onToggleVST3: (value: boolean) => void
  onToggleAAX: (value: boolean) => void
  onToggleAU: (value: boolean) => void
  query: string
  onQueryChange: (value: string) => void
  searchRef: RefObject<HTMLInputElement | null>
  duplicatesOnly: boolean
  onToggleDuplicatesOnly: (value: boolean) => void
  duplicateCount: number
}

export default function Toolbar({
  pluginsCount,
  onRefresh,
  onSettings,
  showVST2,
  showVST3,
  showAAX,
  showAU,
  onToggleVST2,
  onToggleVST3,
  onToggleAAX,
  onToggleAU,
  query,
  onQueryChange,
  searchRef,
  duplicatesOnly,
  onToggleDuplicatesOnly,
  duplicateCount,
}: ToolbarProps) {
  const { t } = useI18n()
  return (
    <div className="mb-2 flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div className="whitespace-nowrap text-sm" aria-live="polite">
          {t("toolbar.count", { count: pluginsCount })}
        </div>

        <div className="relative min-w-0 flex-1">
          <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            placeholder={t("toolbar.search")}
            aria-label={t("toolbar.searchLabel")}
            autoComplete="off"
            spellCheck={false}
            className="h-9 w-full rounded border border-input bg-background pl-8 pr-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
          />
          {query !== "" && (
            <button
              type="button"
              onClick={() => { onQueryChange(""); searchRef.current?.focus() }}
              aria-label={t("toolbar.searchClear")}
              title={t("toolbar.searchClear")}
              className="absolute right-1 top-1/2 flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <X aria-hidden className="size-4" />
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh} aria-label={t("toolbar.rescan")} title={t("toolbar.rescan")}>
            <RefreshCcw aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onSettings}
            aria-label={t("toolbar.settings")}
            title={t("toolbar.settings")}
          >
            <Settings aria-hidden />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div role="group" aria-label={t("toolbar.formats")} className="flex items-center gap-5">
          <div className="flex items-center gap-1">
            <Checkbox id="VST2" checked={showVST2} onCheckedChange={(value) => onToggleVST2(Boolean(value))} />
            <Label htmlFor="VST2" className="ml-1">VST2</Label>
          </div>
          <div className="flex items-center gap-1">
            <Checkbox id="VST3" checked={showVST3} onCheckedChange={(value) => onToggleVST3(Boolean(value))} />
            <Label htmlFor="VST3" className="ml-1">VST3</Label>
          </div>
          <div className="flex items-center gap-1">
            <Checkbox id="AAX" checked={showAAX} onCheckedChange={(value) => onToggleAAX(Boolean(value))} />
            <Label htmlFor="AAX" className="ml-1">AAX</Label>
          </div>
          <div className="flex items-center gap-1">
            <Checkbox id="AU" checked={showAU} onCheckedChange={(value) => onToggleAU(Boolean(value))} />
            <Label htmlFor="AU" className="ml-1">AU</Label>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Checkbox
            id="duplicates-only"
            checked={duplicatesOnly}
            onCheckedChange={(value) => onToggleDuplicatesOnly(Boolean(value))}
          />
          <Label htmlFor="duplicates-only" className="ml-1">
            {t("toolbar.duplicatesOnly")}
            <span className="tabular-nums text-muted-foreground">({duplicateCount})</span>
          </Label>
        </div>
      </div>
    </div>
  )
}
