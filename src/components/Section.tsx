import Row from "./Row"
import HeaderRow from "./HeaderRow"
import { Plugin } from "@/core/plugin/Plugin"

type SectionType = "VST2" | "VST3" | "AAX" | "AU"

type SectionProps = {
    type: SectionType
    items: Plugin[]
    collapsed: boolean
    onToggle: () => void
    onUninstalled?: () => void
}

export default function Section({ type, items, collapsed, onToggle, onUninstalled }: SectionProps) {
    if (items.length === 0) return null

    return (
        <div className="flex flex-col border-2 border-foreground/50">
            <HeaderRow
                type={type}
                expanded={!collapsed}
                onToggle={onToggle}
                className={collapsed ? "" : "border-b-2 border-foreground/50"}
            ></HeaderRow>
            {!collapsed && (
                <div className="flex flex-col divide-y-2">
                    {items.map(plugin => (
                        <div className="flex flex-col" key={`${plugin.type}-${plugin.installPath}-${plugin.name}`}>
                            <Row plugin={plugin} onUninstalled={onUninstalled}></Row>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
