import { useRef } from "react"
import Row from "./Row"
import HeaderRow from "./HeaderRow"
import type { Plugin } from "@/core/plugin/Plugin"
import { pluginKey, type SortKey, type SortState } from "@/core/plugin/ListOps"

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
    onUninstall: (plugin: Plugin) => void
}

export default function Section({ type, items, total, sort, onSort, collapsed, onToggle, selected, onSelectKeys, duplicates, onUninstall }: SectionProps) {
    // Last row clicked, so Shift+click can select the range between it and the next click.
    const anchor = useRef<number | null>(null)
    if (items.length === 0) return null

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
        <div role="table" aria-label={type} className="flex flex-col border-2 border-foreground/50">
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
                    className={collapsed ? "" : "border-b-2 border-foreground/50"}
                />
            </div>
            {!collapsed && (
                <div role="rowgroup" className="flex flex-col divide-y-2">
                    {items.map((plugin, i) => {
                        const key = pluginKey(plugin)
                        return (
                            <Row
                                key={key}
                                plugin={plugin}
                                selected={selected.has(key)}
                                duplicates={duplicates.get(key)}
                                onSelect={shift => click(i, shift)}
                                onUninstall={() => onUninstall(plugin)}
                            />
                        )
                    })}
                </div>
            )}
        </div>
    )
}
