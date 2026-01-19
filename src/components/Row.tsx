import { ChevronDown, Folder, Trash } from "lucide-react";
import { Button } from "./ui/button";
import { Label } from "@radix-ui/react-label";
import { Plugin } from "@/core/plugin/Plugin";
import { openPath } from "@tauri-apps/plugin-opener";

type RowProps = {
    plugin?: Plugin
    header?: { name: string, path: string }
    type?: string
}

export default function Row({ plugin, header, type }: RowProps) {
    return (
        <div className="flex border border-b-0 gap-2 items-center h-full">
            <div className="flex gap-2 items-center justify-between p-1 border-r">
                {plugin !== undefined ? (
                    <>
                        <Button variant={"outline"} size={"sm"} onClick={() => { openPath(plugin.installPath) }}>
                            <Folder />
                        </Button>
                        <Button variant={"destructive"} size={"sm"}>
                            <Trash />
                        </Button>
                    </>
                ) : (
                    <div className="flex items-center w-20 gap-2">
                        <Button variant={"outline"} size={"sm"}>
                            <ChevronDown />
                        </Button>
                        <Label>
                            {type}
                        </Label>
                    </div>
                )}
            </div>
            <div className="flex items-center border-r h-full w-sm">
                <Label className="p-2">
                    {plugin !== undefined ? (plugin.name) : (header?.name)}
                </Label>
            </div>
            <div className="flex items-center h-full">
                <Label className="p-2">
                    {plugin !== undefined ? (plugin.installPath) : (header?.path)}
                </Label>
            </div>
        </div>
    )
}