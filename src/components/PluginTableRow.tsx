import { Plugin } from "../core/plugin/Plugin"
import { Button } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import { TableRow, TableCell } from "./ui/table"
import { Folder, Trash2 } from "lucide-react"

interface PluginTableRowProps {
  plugin: Plugin
}

export default function PluginTableRow({ plugin }: PluginTableRowProps) {
  return (
    <TableRow>
      <TableCell>
        <Checkbox />
      </TableCell>

      <TableCell>{plugin.name}</TableCell>

      <TableCell>{plugin.type}</TableCell>

      <TableCell className="font-mono text-xs">
        {plugin.installPath}
      </TableCell>

      <TableCell className="flex gap-1">
        <Button variant="outline" size="sm">
          <Folder />
        </Button>
        <Button variant="destructive" size="sm">
          <Trash2 />
        </Button>
      </TableCell>
    </TableRow>
  )
}
