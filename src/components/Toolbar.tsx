import { Button } from "./ui/button"
import { RefreshCcw, Settings } from "lucide-react"
import { Checkbox } from "./ui/checkbox"
import { Label } from "./ui/label"

type ToolbarProps = {
  pluginsCount: number
  onRefresh: () => void
  onSettings?: () => void
  showVST2: boolean
  showVST3: boolean
  showAAX: boolean
  showAU: boolean
  onToggleVST2: (value: boolean) => void
  onToggleVST3: (value: boolean) => void
  onToggleAAX: (value: boolean) => void
  onToggleAU: (value: boolean) => void
}

export default function Toolbar({
  pluginsCount,
  onRefresh,
  onSettings,
  showVST2,
  showVST3,
  showAAX,
  showAU,
  onToggleVST2,
  onToggleVST3,
  onToggleAAX,
  onToggleAU,
}: ToolbarProps) {
  return (
    <div className="flex items-center justify-between mb-2">
      <div className="flex space-x-4 mr-14">
        Plugin trovati: {pluginsCount}
      </div>

      <div className="flex items-center flex-1 space-x-6">
        <div className="flex items-center gap-1">
          <Checkbox id="VST2" checked={showVST2} onCheckedChange={(value) => onToggleVST2(Boolean(value))} />
          <Label htmlFor="VST2" className="ml-1">VST2</Label>
        </div>
        <div className="flex items-center gap-1">
          <Checkbox id="VST3" checked={showVST3} onCheckedChange={(value) => onToggleVST3(Boolean(value))} />
          <Label htmlFor="VST3" className="ml-1">VST3</Label>
        </div>
        <div className="flex items-center gap-1">
          <Checkbox id="AAX" checked={showAAX} onCheckedChange={(value) => onToggleAAX(Boolean(value))} />
          <Label htmlFor="AAX" className="ml-1">AAX</Label>
        </div>
        <div className="flex items-center gap-1">
          <Checkbox id="AU" checked={showAU} onCheckedChange={(value) => onToggleAU(Boolean(value))} />
          <Label htmlFor="AU" className="ml-1">AU</Label>
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
