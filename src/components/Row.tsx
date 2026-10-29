import { useState } from "react"
import { Folder, Trash } from "lucide-react"
import { Label } from "@radix-ui/react-label"
import { Button } from "./ui/button"
import UninstallDialog from "./UninstallDialog"
import { Plugin } from "@/core/plugin/Plugin"
import { openPath } from "@tauri-apps/plugin-opener"

type RowProps = {
    plugin: Plugin
    onUninstalled?: () => void
}

export default function Row({ plugin, onUninstalled }: RowProps) {
    const [confirming, setConfirming] = useState(false)
    return (
        <div className="flex gap-2 items-center h-full">
            <div className="flex gap-2 items-center justify-between p-1 border-r-2 w-24">
                <Button variant={"outline"} size={"sm"} onClick={() => { openPath(plugin.installPath) }}>
                    <Folder />
                </Button>
                <Button variant={"destructive"} size={"sm"} aria-label={`Disinstalla ${plugin.name}`} onClick={() => setConfirming(true)}>
                    <Trash />
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