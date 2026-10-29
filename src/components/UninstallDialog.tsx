import { useEffect, useId, useRef, useState } from "react"
import { Check, Loader2, X } from "lucide-react"
import { Button } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import { Label } from "./ui/label"
import type { Plugin } from "@/core/plugin/Plugin"
import { detectPlatform } from "@/core/plugin/Path"
import { useSettings } from "@/core/settings/SettingsContext"
import { useI18n } from "@/i18n/I18nProvider"
import { useModal } from "./ui/useModal"
import {
  buildPluginPath,
  tauriUninstallBackend,
  uninstallPlugins,
  type BatchItemResult,
} from "@/core/plugin/Uninstall"
import { pluginKey } from "@/core/plugin/ListOps"

type UninstallDialogProps = {
  plugins: Plugin[]
  /** `removedAny` tells the caller whether the list needs a rescan. */
  onClose: (removedAny: boolean) => void
}

const NAME_MARK = "\u0001"

type Phase = "confirm" | "running" | "done"

export default function UninstallDialog({ plugins, onClose }: UninstallDialogProps) {
  const isWindows = detectPlatform() === "windows"
  const { t, tError } = useI18n()
  const { settings } = useSettings()
  const many = plugins.length > 1
  const [restorePoint, setRestorePoint] = useState(settings.restorePointDefault)
  const [phase, setPhase] = useState<Phase>("confirm")
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ completed: BatchItemResult[]; current: Plugin | null }>({ completed: [], current: null })
  const [pendingConfirm, setPendingConfirm] = useState<{ message: string; resolve: (v: boolean) => void } | null>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descId = useId()
  const checkboxId = useId()
  const [before, after] = t("uninstall.description", { name: NAME_MARK }).split(NAME_MARK)
  const running = phase === "running"
  const removedAny = progress.completed.some(r => r.status === "removed")

  useEffect(() => {
    if (pendingConfirm) cancelRef.current?.focus()
  }, [pendingConfirm])

  useEffect(() => {
    if (phase === "done") cancelRef.current?.focus()
  }, [phase])

  const answer = (value: boolean) => {
    pendingConfirm?.resolve(value)
    setPendingConfirm(null)
  }

  const cancel = () => {
    if (pendingConfirm) return answer(false)
    if (running) return
    onClose(phase === "done" && removedAny)
  }

  useModal(dialogRef, cancel, cancelRef)

  const confirm = async () => {
    setPhase("running")
    setError(null)
    setProgress({ completed: [], current: null })
    try {
      const batch = await uninstallPlugins(plugins, {
        restorePoint: isWindows && restorePoint,
        backend: tauriUninstallBackend,
        confirmContinue: message => new Promise<boolean>(resolve => setPendingConfirm({ message, resolve })),
        onProgress: (completed, current) => setProgress({ completed, current }),
      })
      if (batch.status === "cancelled") {
        setPhase("confirm")
        return
      }
      // A single plugin that went through needs no summary.
      if (!many && batch.results[0]?.status === "removed") {
        onClose(true)
        return
      }
      setProgress({ completed: batch.results, current: null })
      setPhase("done")
    } catch (e) {
      setError(String(e))
      setPhase("confirm")
    }
  }

  const failed = progress.completed.filter(r => r.status === "failed").length
  const removed = progress.completed.length - failed

  const statusOf = (plugin: Plugin, index: number): BatchItemResult | "running" | "pending" => {
    if (index < progress.completed.length) return progress.completed[index]
    return progress.current === plugin ? "running" : "pending"
  }

  // Once finished, failures come first so their errors are visible without scrolling.
  const ordered = plugins.map((plugin, index) => ({ plugin, index }))
  if (phase === "done") {
    ordered.sort((a, b) => Number(progress.completed[b.index]?.status === "failed") - Number(progress.completed[a.index]?.status === "failed"))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="flex max-h-full w-full max-w-lg flex-col gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground shadow-lg"
      >
        <h2 id={titleId} className="text-lg font-semibold">
          {many ? t("uninstall.titleMany", { count: plugins.length }) : t("uninstall.title")}
        </h2>
        <div id={descId} className="flex flex-col gap-2 text-sm">
          {phase === "done" ? (
            <p role="status">
              {failed === 0 ? t("uninstall.summaryOk", { removed }) : t("uninstall.summary", { removed, failed })}
            </p>
          ) : many ? (
            running ? (
              <p role="status">
                {t("uninstall.progress", { current: Math.min(progress.completed.length + 1, plugins.length), total: plugins.length })}
              </p>
            ) : (
              <p>{t("uninstall.descriptionMany", { count: plugins.length })}</p>
            )
          ) : (
            <>
              <p>
                {before}<strong className="break-all">{plugins[0].name}</strong>{after}
              </p>
              {phase === "confirm" && <p className="break-all text-muted-foreground">{buildPluginPath(plugins[0].installPath, plugins[0].name)}</p>}
            </>
          )}
        </div>

        {(many || phase === "done") && (
          <ul
            aria-label={many ? t("uninstall.titleMany", { count: plugins.length }) : plugins[0].name}
            className="flex max-h-60 min-h-0 flex-col divide-y overflow-y-auto rounded border border-border"
            tabIndex={0}
          >
            {ordered.map(({ plugin, index: i }) => {
              const st = phase === "confirm" ? "pending" : statusOf(plugin, i)
              const result = typeof st === "object" ? st : null
              return (
                <li key={pluginKey(plugin)} className="flex items-start gap-2 px-2 py-1.5 text-sm">
                  {phase !== "confirm" && (
                    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
                      {result?.status === "removed" && <Check aria-hidden className="size-4" />}
                      {result?.status === "failed" && <X aria-hidden className="size-4 text-destructive" />}
                      {st === "running" && <Loader2 aria-hidden className="size-4 animate-spin" />}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium" title={plugin.name}>{plugin.name}</div>
                    <div className="truncate text-xs text-muted-foreground" title={plugin.installPath}>
                      {plugin.type} · {plugin.installPath}
                    </div>
                    {result?.status === "failed" && (
                      <div className="mt-0.5 break-words text-xs text-destructive">
                        {tError(result.error ?? t("uninstall.unknownError"))}
                      </div>
                    )}
                  </div>
                  {phase !== "confirm" && (
                    <span className={`shrink-0 text-xs ${result?.status === "failed" ? "font-medium text-destructive" : "text-muted-foreground"}`}>
                      {result?.status === "removed" && t("uninstall.resultOk")}
                      {result?.status === "failed" && t("uninstall.resultFailed")}
                      {st === "running" && t("uninstall.resultRunning")}
                      {st === "pending" && t("uninstall.resultPending")}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {isWindows && phase !== "done" && (
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
          {phase === "done" ? (
            <Button ref={cancelRef as never} variant="outline" onClick={cancel}>
              {t("uninstall.close")}
            </Button>
          ) : (
            <>
              <Button ref={cancelRef as never} variant="outline" onClick={cancel} disabled={running && !pendingConfirm}>
                {t("uninstall.cancel")}
              </Button>
              <Button variant="destructive" onClick={confirm} disabled={running}>
                {running ? t("uninstall.running") : t("uninstall.confirm")}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
