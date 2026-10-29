import { open } from "@tauri-apps/plugin-dialog"
import { FolderPlus, X } from "lucide-react"
import { Button } from "./ui/button"
import type { AppInfo } from "@/core/settings/AppSettings"

type SettingsPanelProps = {
  paths: string[]
  appInfo?: AppInfo
  onChange: (paths: string[]) => void
  onClose: () => void
}

export default function SettingsPanel({ paths, appInfo, onChange, onClose }: SettingsPanelProps) {
  const addFolder = async () => {
    const selected = await open({ directory: true, multiple: false })
    if (typeof selected === "string" && !paths.includes(selected)) {
      onChange([...paths, selected])
    }
  }

  return (
    <div className="border-2 border-foreground/50 p-2 mb-2 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span>Cartelle aggiuntive da scansionare (plugin copiati a mano)</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={addFolder}>
            <FolderPlus />
          </Button>
          <Button variant="outline" size="sm" onClick={onClose}>
            <X />
          </Button>
        </div>
      </div>
      {appInfo?.portable && (
        <p className="text-sm opacity-70">Modalità portatile — dati in: {appInfo.dataDir ?? "?"}</p>
      )}
      {appInfo?.portableWarning && <p className="text-sm text-destructive">{appInfo.portableWarning}</p>}
      {paths.length === 0 && <p className="text-sm opacity-70">Nessuna cartella aggiunta</p>}
      {paths.map(path => (
        <div key={path} className="flex items-center justify-between gap-2">
          <span className="truncate">{path}</span>
          <Button variant="outline" size="sm" onClick={() => onChange(paths.filter(p => p !== path))}>
            <X />
          </Button>
        </div>
      ))}
    </div>
  )
}
