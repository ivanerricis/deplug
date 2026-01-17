import { Button } from "./ui/button"
import { RefreshCcw, Settings } from "lucide-react"
import { Checkbox } from "./ui/checkbox"
import { Label } from "./ui/label"

type ToolbarProps = {
  pluginsCount: number
  selectedCount: number
  onRefresh: () => void
  onSettings?: () => void
}

export default function Toolbar({
  pluginsCount,
  selectedCount,
  onRefresh,
  onSettings,
}: ToolbarProps) {
  return (
    <div className="flex items-center justify-between mb-2">
      <div className="flex space-x-4 mr-14">
        <div>
          Plugin trovati: {pluginsCount}
        </div>

        <div>
          Selezionati: {selectedCount}
        </div>
      </div>

      <div className="flex items-center flex-1 space-x-6">
        <div className="flex items-center gap-1">
          <Checkbox id="VST2" />
          <Label htmlFor="VST2" className="ml-1">VST2</Label>
        </div>
        <div className="flex items-center gap-1">
          <Checkbox id="VST3" />
          <Label htmlFor="VST3" className="ml-1">VST3</Label>
        </div>
        <div className="flex items-center gap-1">
          <Checkbox id="AAX" />
          <Label htmlFor="AAX" className="ml-1">AAX</Label>
        </div>
      </div>

      <div className="flex space-x-2 flex-1 justify-end">
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCcw />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onSettings}
        >
          <Settings />
        </Button>
      </div>
    </div>
  )
}
