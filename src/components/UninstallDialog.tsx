import { useEffect, useId, useRef, useState } from "react"
import { Button } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import { Label } from "./ui/label"
import type { Plugin } from "@/core/plugin/Plugin"
import { detectPlatform } from "@/core/plugin/Path"
import { useSettings } from "@/core/settings/SettingsContext"
import { useI18n } from "@/i18n/I18nProvider"
import { useModal } from "./ui/useModal"
import { buildPluginPath, tauriUninstallBackend, uninstallPlugin } from "@/core/plugin/Uninstall"

type UninstallDialogProps = {
  plugin: Plugin
  onClose: () => void
  onUninstalled: () => void
}

const NAME_MARK = "\u0001"

export default function UninstallDialog({ plugin, onClose, onUninstalled }: UninstallDialogProps) {
  const isWindows = detectPlatform() === "windows"
  const { t, tError } = useI18n()
  const { settings } = useSettings()
  const [restorePoint, setRestorePoint] = useState(settings.restorePointDefault)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingConfirm, setPendingConfirm] = useState<{ message: string; resolve: (v: boolean) => void } | null>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descId = useId()
  const checkboxId = useId()
  const [before, after] = t("uninstall.description", { name: NAME_MARK }).split(NAME_MARK)
  const fullPath = buildPluginPath(plugin.installPath, plugin.name)

  useEffect(() => {
    if (pendingConfirm) cancelRef.current?.focus()
  }, [pendingConfirm])

  const answer = (value: boolean) => {
    pendingConfirm?.resolve(value)
    setPendingConfirm(null)
  }

  const cancel = () => {
    if (pendingConfirm) return answer(false)
    if (!running) onClose()
  }

  useModal(dialogRef, cancel, cancelRef)

  const confirm = async () => {
    setRunning(true)
    setError(null)
    try {
      const result = await uninstallPlugin(plugin, {
        restorePoint: isWindows && restorePoint,
        backend: tauriUninstallBackend,
        confirmContinue: message => new Promise<boolean>(resolve => setPendingConfirm({ message, resolve })),
      })
      if (result.status === "removed") {
        onUninstalled()
        onClose()
        return
      }
      if (result.status === "failed") setError(result.error ?? t("uninstall.unknownError"))
    } catch (e) {
      setError(String(e))
    }
    setRunning(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="flex w-full max-w-lg flex-col gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground shadow-lg"
      >
        <h2 id={titleId} className="text-lg font-semibold">{t("uninstall.title")}</h2>
        <div id={descId} className="flex flex-col gap-2 text-sm">
          <p>
            {before}<strong className="break-all">{plugin.name}</strong>{after}
          </p>
          <p className="break-all text-muted-foreground">{fullPath}</p>
        </div>

        {isWindows && (
          <div className="flex items-start gap-2">
            <Checkbox
              id={checkboxId}
              checked={restorePoint}
              disabled={running}
              onCheckedChange={v => setRestorePoint(v === true)}
              className="mt-0.5"
            />
            <div className="flex flex-col gap-1">
              <Label htmlFor={checkboxId} className="text-sm">
                {t("uninstall.restorePoint")}
              </Label>
              <span className="text-xs text-muted-foreground">{t("uninstall.restorePointHint")}</span>
            </div>
          </div>
        )}

        {pendingConfirm && (
          <div role="alert" className="flex flex-col gap-2 rounded border border-destructive p-2 text-sm">
            <p className="text-destructive break-words">{tError(pendingConfirm.message)}</p>
            <p>{t("uninstall.continueQuestion")}</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => answer(false)}>{t("uninstall.no")}</Button>
              <Button variant="destructive" size="sm" onClick={() => answer(true)}>{t("uninstall.yesContinue")}</Button>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive break-words">{tError(error)}</p>
        )}

        <div className="flex justify-end gap-2">
          <Button ref={cancelRef as never} variant="outline" onClick={cancel} disabled={running && !pendingConfirm}>
            {t("uninstall.cancel")}
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={running}>
            {running ? t("uninstall.running") : t("uninstall.confirm")}
          </Button>
        </div>
      </div>
    </div>
  )
}
