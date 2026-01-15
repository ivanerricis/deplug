import { Button } from "./ui/button"
import { RefreshCcw, Settings } from "lucide-react"

type PluginToolbarProps = {
  pluginsCount: number
  selectedCount: number
  onRefresh: () => void
  onSettings?: () => void
}

export default function PluginToolbar({
  pluginsCount,
  selectedCount,
  onRefresh,
  onSettings,
}: PluginToolbarProps) {
  return (
    <div className="flex items-center justify-between mb-2 shrink-0">
      <div className="flex space-x-4">
        <div>
          Plugin trovati: {pluginsCount}
        </div>

        <div>
          Selezionati: {selectedCount}
        </div>
      </div>

      <div className="flex space-x-2">
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
