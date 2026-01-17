import { FolderOpen, MoreVertical, Trash } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Button } from "./ui/button";
import { openPath } from "@tauri-apps/plugin-opener";
import { Plugin } from "../core/plugin/Plugin"

type RowDropdownMenuProps = {
    plugin: Plugin
}

export default function RowDropdownMenu({plugin}: RowDropdownMenuProps) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                    <MoreVertical className="w-4 h-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openPath(plugin.installPath)}>
                    <FolderOpen className="w-4 h-4 mr-2" />
                    Apri cartella
                </DropdownMenuItem>
                <DropdownMenuItem
                    variant="destructive"
                    onClick={() => console.log("Delete", plugin.installPath)}
                >
                    <Trash className="w-4 h-4 mr-2" />
                    Disinstalla
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}