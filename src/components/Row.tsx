import { Folder, Trash } from "lucide-react"
import ArchPill from "./ArchPill"
import HealthPill from "./HealthPill"
import { Button } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import { Badge } from "./ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip"
import { MODIFIED_CELL, ROW_GRID } from "./listLayout"
import type { Plugin } from "@/core/plugin/Plugin"
import type { PluginMeta } from "@/core/plugin/Meta"
import { openPath } from "@tauri-apps/plugin-opener"
import { buildPluginPath } from "@/core/plugin/Uninstall"
import { useI18n } from "@/i18n/I18nProvider"
import { formatBytes, formatDate, shortenPath } from "@/core/format"

type RowProps = {
    plugin: Plugin
    selected: boolean
    /** The other copies of this plugin, when it is a duplicate. */
    duplicates?: Plugin[]
    meta?: PluginMeta
    /** When true, the folder is shown muted under the name (otherwise the section shows it once per group). */
    showPath?: boolean
    home?: string
    onSelect: (shiftKey: boolean) => void
    onUninstall: () => void
}

const actionBase =
    "relative size-9 text-muted-foreground after:absolute after:-inset-0.5 after:content-[''] hover:text-foreground"

export default function Row({ plugin, selected, duplicates, meta, showPath, home = "", onSelect, onUninstall }: RowProps) {
    const { t, language } = useI18n()
    const tip = duplicates && duplicates.length > 0
        ? `${t("row.duplicateAlso")}\n${duplicates.map(d => `${d.type} · ${d.installPath}`).join("\n")}`
        : undefined
    const folder = showPath ? plugin.installPath : null
    const unknown = t("row.unknown")
    const size = meta?.size ?? null
    const modified = meta?.modified ?? null
    return (
        <div
            role="row"
            aria-selected={selected}
            className={`${ROW_GRID} group items-center rounded-lg transition-colors motion-reduce:transition-none ${selected ? "bg-accent" : "hover:bg-accent/50 focus-within:bg-accent/50"}`}
        >
            <div role="cell" className="flex h-full items-center justify-center">
                <Checkbox
                    checked={selected}
                    aria-label={t("row.select", { name: plugin.name })}
                    // Controlled through onClick so Shift+click can select a range.
                    onClick={e => onSelect(e.shiftKey)}
                    className="relative after:absolute after:-inset-3 after:content-['']"
                />
            </div>

            <div role="cell" className="min-w-0 py-2 pr-2">
                <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium" title={plugin.name}>{plugin.name}</span>
                    <ArchPill arch={meta?.arch} />
                    <HealthPill health={meta?.health} />
                    {tip && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Badge
                                    variant="outline"
                                    className="cursor-help gap-1 border-transparent bg-signal/12 px-1.5 py-px text-[11px] text-foreground"
                                >
                                    <span aria-hidden className="size-1.5 rounded-full bg-signal" />
                                    {t("row.duplicate")}
                                    <span className="sr-only">. {tip.replace(/\n/g, ". ")}</span>
                                </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="whitespace-pre-line text-left">{tip}</TooltipContent>
                        </Tooltip>
                    )}
                </div>
                {folder !== null && (
                    <div className="mt-0.5 truncate text-xs text-muted-foreground" title={buildPluginPath(plugin.installPath, plugin.name)}>
                        <span className="sr-only">{t("row.folder", { path: folder })}</span>
                        <span aria-hidden>{shortenPath(folder, home)}</span>
                    </div>
                )}
            </div>

            <div role="cell" className="px-2 text-right text-sm tabular-nums text-muted-foreground">
                {size === null ? <span aria-label={unknown}>—</span> : formatBytes(size, language)}
            </div>
            <div role="cell" className={`px-2 text-sm tabular-nums text-muted-foreground ${MODIFIED_CELL}`}>
                {modified === null ? <span aria-label={unknown}>—</span> : formatDate(modified, language)}
            </div>

            <div
                role="cell"
                // Revealed on hover/focus; always visible on touch devices. Space is reserved so nothing shifts.
                className="flex items-center justify-end pr-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 motion-reduce:transition-none [@media(hover:none)]:opacity-100"
            >
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className={actionBase}
                            aria-label={t("row.openFolder", { name: plugin.name })}
                            onClick={() => { openPath(plugin.installPath).catch(console.error) }}
                        >
                            <Folder aria-hidden />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t("row.openFolder", { name: plugin.name })}</TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className={`${actionBase} hover:bg-destructive/10 hover:text-destructive focus-visible:text-destructive`}
                            aria-label={t("row.uninstall", { name: plugin.name })}
                            onClick={onUninstall}
                        >
                            <Trash aria-hidden />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t("row.uninstall", { name: plugin.name })}</TooltipContent>
                </Tooltip>
            </div>
        </div>
    )
}
