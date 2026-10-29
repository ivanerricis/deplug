import { useState } from "react"
import { Folder, Trash } from "lucide-react"
import { Label } from "@radix-ui/react-label"
import { Button } from "./ui/button"
import UninstallDialog from "./UninstallDialog"
import { Plugin } from "@/core/plugin/Plugin"
import { openPath } from "@tauri-apps/plugin-opener"
import { useI18n } from "@/i18n/I18nProvider"

type RowProps = {
    plugin: Plugin
    onUninstalled?: () => void
}

export default function Row({ plugin, onUninstalled }: RowProps) {
    const { t } = useI18n()
    const [confirming, setConfirming] = useState(false)
    return (
        <div className="flex gap-2 items-center h-full">
            <div className="flex gap-2 items-center justify-between p-1 border-r-2 w-24">
                <Button variant={"outline"} size={"sm"} aria-label={t("row.openFolder", { name: plugin.name })} title={t("row.openFolder", { name: plugin.name })} onClick={() => { openPath(plugin.installPath).catch(console.error) }}>
                    <Folder aria-hidden />
                </Button>
                <Button variant={"destructive"} size={"sm"} aria-label={t("row.uninstall", { name: plugin.name })} title={t("row.uninstall", { name: plugin.name })} onClick={() => setConfirming(true)}>
                    <Trash aria-hidden />
                </Button>
            </div>
            <div className="flex items-center border-r-2 h-full w-sm min-w-0">
                <Label className="p-2 truncate w-full">{plugin.name}</Label>
            </div>
            <div className="flex items-center h-full flex-1 min-w-0">
                <Label className="p-2 truncate w-full">{plugin.installPath}</Label>
            </div>
            {confirming && (
                <UninstallDialog
                    plugin={plugin}
                    onClose={() => setConfirming(false)}
                    onUninstalled={() => onUninstalled?.()}
                />
            )}
        </div>
    )
}