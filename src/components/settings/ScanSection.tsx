import { useState } from "react"
import { open } from "@tauri-apps/plugin-dialog"
import { FolderPlus, X } from "lucide-react"
import { useSettings } from "@/core/settings/SettingsContext"
import { MAX_SCAN_DEPTH, MIN_SCAN_DEPTH } from "@/core/settings/AppSettings"
import { useI18n } from "@/i18n/I18nProvider"
import { Button } from "../ui/button"
import { Checkbox } from "../ui/checkbox"
import { Input } from "../ui/input"
import { Separator } from "../ui/separator"
import { Switch } from "../ui/switch"
import { Group, SettingRow } from "./SettingRow"

export default function ScanSection({ systemPaths }: { systemPaths: string[] }) {
  const { t } = useI18n()
  const { settings, update } = useSettings()
  const [draft, setDraft] = useState<string | null>(null)

  const commitDepth = (text: string) => {
    const n = Number(text)
    if (text.trim() !== "" && Number.isInteger(n) && n >= MIN_SCAN_DEPTH && n <= MAX_SCAN_DEPTH) {
      update({ customScanDepth: n })
    }
  }
  const step = (delta: number) =>
    update({ customScanDepth: Math.min(MAX_SCAN_DEPTH, Math.max(MIN_SCAN_DEPTH, settings.customScanDepth + delta)) })

  const addFolder = async () => {
    try {
      const selected = await open({ directory: true, multiple: false })
      if (typeof selected === "string" && !settings.customScanPaths.includes(selected)) {
        update({ customScanPaths: [...settings.customScanPaths, selected] })
      }
    } catch (e) {
      console.error(e)
    }
  }

  const toggleSystem = (path: string, enabled: boolean) => {
    const rest = settings.disabledSystemPaths.filter(p => p !== path)
    update({ disabledSystemPaths: enabled ? rest : [...rest, path] })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col">
        <SettingRow label={t("settings.scan.startup")} hint={t("settings.scan.startupHint")} labelId="set-startup" hintId="set-startup-h">
          <Switch
            checked={settings.scanOnStartup}
            onCheckedChange={v => update({ scanOnStartup: v })}
            aria-labelledby="set-startup"
            aria-describedby="set-startup-h"
          />
        </SettingRow>
        <Separator />
        <SettingRow label={t("settings.scan.depth")} hint={t("settings.scan.depthHint")} labelId="set-depth" hintId="set-depth-h">
          <div className="inline-flex items-center gap-1">
            <Button variant="outline" size="icon-sm" aria-label="−" onClick={() => step(-1)} disabled={settings.customScanDepth <= MIN_SCAN_DEPTH}>−</Button>
            <Input
              type="number"
              inputMode="numeric"
              min={MIN_SCAN_DEPTH}
              max={MAX_SCAN_DEPTH}
              aria-label={t("settings.scan.depthInput")}
              aria-describedby="set-depth-h"
              value={draft ?? settings.customScanDepth}
              onChange={e => {
                setDraft(e.target.value)
                commitDepth(e.target.value)
              }}
              onBlur={() => setDraft(null)}
              className="h-8 w-14 px-2 text-center tabular-nums"
            />
            <Button variant="outline" size="icon-sm" aria-label="+" onClick={() => step(1)} disabled={settings.customScanDepth >= MAX_SCAN_DEPTH}>+</Button>
          </div>
        </SettingRow>
      </div>

      <Group title={t("settings.scan.folders")} hint={t("settings.scan.foldersHint")}>
        <div className="flex flex-col gap-2">
          {settings.customScanPaths.length === 0 ? (
            <p className="rounded bg-muted px-3 py-2 text-sm text-muted-foreground">{t("settings.scan.noFolders")}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {settings.customScanPaths.map(path => (
                <li key={path} className="flex items-center justify-between gap-2 rounded bg-muted py-1 pl-3 pr-1">
                  <span className="min-w-0 truncate text-sm" title={path}>{path}</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("settings.scan.removeFolder", { path })}
                    onClick={() => update({ customScanPaths: settings.customScanPaths.filter(p => p !== path) })}
                  >
                    <X />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div>
            <Button variant="outline" size="sm" onClick={addFolder}>
              <FolderPlus /> {t("settings.scan.addFolder")}
            </Button>
          </div>
        </div>
      </Group>

      <Group title={t("settings.scan.system")} hint={t("settings.scan.systemHint")}>
        <ul className="flex flex-col">
          {systemPaths.map((path, i) => {
            const id = `sys-${i}`
            const enabled = !settings.disabledSystemPaths.includes(path)
            return (
              <li key={path} className="flex items-center gap-3 py-1.5">
                <Checkbox id={id} checked={enabled} onCheckedChange={v => toggleSystem(path, v === true)} aria-label={t("settings.scan.systemToggle", { path })} />
                <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer truncate text-sm" title={path}>{path}</label>
              </li>
            )
          })}
        </ul>
      </Group>
      <p className="text-sm text-muted-foreground">{t("settings.scan.rescanNote")}</p>
    </div>
  )
}
