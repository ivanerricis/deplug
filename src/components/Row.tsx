import { Folder, Trash } from "lucide-react"
import { Button } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import { ROW_GRID } from "./HeaderRow"
import type { Plugin } from "@/core/plugin/Plugin"
import { openPath } from "@tauri-apps/plugin-opener"
import { useI18n } from "@/i18n/I18nProvider"

type RowProps = {
    plugin: Plugin
    selected: boolean
    /** The other copies of this plugin, when it is a duplicate. */
    duplicates?: Plugin[]
    onSelect: (shiftKey: boolean) => void
    onUninstall: () => void
}

export default function Row({ plugin, selected, duplicates, onSelect, onUninstall }: RowProps) {
    const { t } = useI18n()
    const tip = duplicates && duplicates.length > 0
        ? `${t("row.duplicateAlso")}\n${duplicates.map(d => `${d.type} · ${d.installPath}`).join("\n")}`
        : undefined
    return (
        <div role="row" aria-selected={selected} className={`${ROW_GRID} items-stretch ${selected ? "bg-accent" : ""}`}>
            <div role="cell" className="flex items-center justify-center border-r-2">
                <Checkbox
                    checked={selected}
                    aria-label={t("row.select", { name: plugin.name })}
                    // Controlled through onClick so Shift+click can select a range.
                    onClick={e => onSelect(e.shiftKey)}
                    className="relative after:absolute after:-inset-2.5 after:content-['']"
                />
            </div>
            <div role="cell" className="flex items-center justify-between gap-1 border-r-2 p-1">
                <Button variant="outline" size="sm" aria-label={t("row.openFolder", { name: plugin.name })} title={t("row.openFolder", { name: plugin.name })} onClick={() => { openPath(plugin.installPath).catch(console.error) }}>
                    <Folder aria-hidden />
                </Button>
                <Button variant="destructive" size="sm" aria-label={t("row.uninstall", { name: plugin.name })} title={t("row.uninstall", { name: plugin.name })} onClick={onUninstall}>
                    <Trash aria-hidden />
                </Button>
            </div>
            <div role="cell" className="flex min-w-0 items-center gap-2 border-r-2 px-2 py-1.5">
                <span className="truncate text-sm font-medium" title={plugin.name}>{plugin.name}</span>
                {tip && (
                    <span
                        title={tip}
                        className="shrink-0 cursor-help rounded-sm border border-signal/70 px-1.5 py-px text-xs font-medium text-foreground"
                    >
                        {t("row.duplicate")}
                        <span className="sr-only">. {tip.replace(/\n/g, ". ")}</span>
                    </span>
                )}
            </div>
            <div role="cell" className="flex min-w-0 items-center px-2 py-1.5">
                <span className="truncate text-sm text-muted-foreground" title={plugin.installPath}>{plugin.installPath}</span>
            </div>
        </div>
    )
}
