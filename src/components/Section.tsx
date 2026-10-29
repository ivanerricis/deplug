import { Fragment, useMemo, useRef } from "react"
import { Folder } from "lucide-react"
import Row from "./Row"
import HeaderRow from "./HeaderRow"
import type { Plugin } from "@/core/plugin/Plugin"
import type { MetaMap } from "@/core/plugin/Meta"
import { folderRuns, pluginKey, shouldGroupByFolder, type SortKey, type SortState } from "@/core/plugin/ListOps"
import { buildPluginPath } from "@/core/plugin/Uninstall"
import { shortenPath } from "@/core/format"

type SectionType = "VST2" | "VST3" | "AAX" | "AU"

type SectionProps = {
    type: SectionType
    /** Plugins to display, already filtered and sorted. */
    items: Plugin[]
    /** How many plugins of this format exist before filtering. */
    total: number
    sort: SortState
    onSort: (key: SortKey) => void
    collapsed: boolean
    onToggle: () => void
    selected: ReadonlySet<string>
    /** Replaces the selection of this section's shown rows (add or remove the given keys). */
    onSelectKeys: (keys: string[], select: boolean) => void
    duplicates: ReadonlyMap<string, Plugin[]>
    meta: MetaMap
    /** Home directory, abbreviated to "~" in displayed folders. */
    home: string
    onUninstall: (plugin: Plugin) => void
}

export default function Section({ type, items, total, sort, onSort, collapsed, onToggle, selected, onSelectKeys, duplicates, meta, home, onUninstall }: SectionProps) {
    // Last row clicked, so Shift+click can select the range between it and the next click.
    const anchor = useRef<number | null>(null)
    const runs = useMemo(() => folderRuns(items), [items])
    if (items.length === 0) return null

    // Few long runs: print each folder once above its rows. Many short runs: show it under each name.
    const grouped = shouldGroupByFolder(runs, items.length)
    const runStarts = new Map(runs.map(r => [r.start, r.folder]))

    const selectedCount = items.reduce((n, p) => n + (selected.has(pluginKey(p)) ? 1 : 0), 0)
    const selectState: boolean | "indeterminate" =
        selectedCount === 0 ? false : selectedCount === items.length ? true : "indeterminate"

    const click = (index: number, shiftKey: boolean) => {
        const key = pluginKey(items[index])
        const willSelect = !selected.has(key)
        if (shiftKey && anchor.current !== null && anchor.current < items.length) {
            const [from, to] = [Math.min(anchor.current, index), Math.max(anchor.current, index)]
            onSelectKeys(items.slice(from, to + 1).map(pluginKey), willSelect)
        } else {
            onSelectKeys([key], willSelect)
        }
        anchor.current = index
    }

    return (
        <div role="table" aria-label={type} className="mb-5 flex flex-col">
            <div role="rowgroup">
                <HeaderRow
                    type={type}
                    expanded={!collapsed}
                    onToggle={onToggle}
                    sort={sort}
                    onSort={onSort}
                    shown={items.length}
                    total={total}
                    selectState={selectState}
                    onSelectAll={() => onSelectKeys(items.map(pluginKey), selectState !== true)}
                />
            </div>
            {!collapsed && (
                <div role="rowgroup" className="flex flex-col pt-1">
                    {items.map((plugin, i) => {
                        const key = pluginKey(plugin)
                        const folder = runStarts.get(i)
                        return (
                            <Fragment key={key}>
                                {grouped && folder !== undefined && (
                                    <div role="row">
                                        <div
                                            role="cell"
                                            title={folder}
                                            className="flex items-center gap-1.5 truncate px-2 pb-1 pt-3 text-xs text-muted-foreground first:pt-2"
                                        >
                                            <Folder aria-hidden className="size-3.5 shrink-0" />
                                            <span className="truncate">{shortenPath(folder, home)}</span>
                                        </div>
                                    </div>
                                )}
                                <Row
                                    plugin={plugin}
                                    selected={selected.has(key)}
                                    duplicates={duplicates.get(key)}
                                    meta={meta.get(buildPluginPath(plugin.installPath, plugin.name))}
                                    showPath={!grouped}
                                    home={home}
                                    onSelect={shift => click(i, shift)}
                                    onUninstall={() => onUninstall(plugin)}
                                />
                            </Fragment>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
