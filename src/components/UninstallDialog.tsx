import { useEffect, useId, useRef, useState } from "react"
import { Button } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import { Label } from "./ui/label"
import type { Plugin } from "@/core/plugin/Plugin"
import { detectPlatform } from "@/core/plugin/Path"
import { buildPluginPath, tauriUninstallBackend, uninstallPlugin } from "@/core/plugin/Uninstall"

type UninstallDialogProps = {
  plugin: Plugin
  onClose: () => void
  onUninstalled: () => void
}

export default function UninstallDialog({ plugin, onClose, onUninstalled }: UninstallDialogProps) {
  const isWindows = detectPlatform() === "windows"
  const [restorePoint, setRestorePoint] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingConfirm, setPendingConfirm] = useState<{ message: string; resolve: (v: boolean) => void } | null>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const descId = useId()
  const checkboxId = useId()
  const fullPath = buildPluginPath(plugin.installPath, plugin.name)

  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        cancel()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

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
      if (result.status === "failed") setError(result.error ?? "Errore sconosciuto")
    } catch (e) {
      setError(String(e))
    }
    setRunning(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="flex w-full max-w-lg flex-col gap-3 rounded border-2 border-foreground/50 bg-background p-4 text-foreground shadow-lg"
      >
        <h2 id={titleId} className="text-lg font-semibold">Disinstalla plugin</h2>
        <div id={descId} className="flex flex-col gap-2 text-sm">
          <p>
            Il plugin <strong className="break-all">{plugin.name}</strong> verrà spostato nel cestino di sistema.
          </p>
          <p className="break-all opacity-70">{fullPath}</p>
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
                Crea un punto di ripristino di sistema prima di disinstallare
              </Label>
              <span className="text-xs opacity-70">Windows potrebbe richiedere i permessi di amministratore.</span>
            </div>
          </div>
        )}

        {pendingConfirm && (
          <div role="alert" className="flex flex-col gap-2 rounded border border-destructive p-2 text-sm">
            <p className="text-destructive">{pendingConfirm.message}</p>
            <p>Continuare senza punto di ripristino?</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => answer(false)}>No</Button>
              <Button variant="destructive" size="sm" onClick={() => answer(true)}>Sì, continua</Button>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive break-words">{error}</p>
        )}

        <div className="flex justify-end gap-2">
          <Button ref={cancelRef as never} variant="outline" onClick={cancel} disabled={running && !pendingConfirm}>
            Annulla
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={running}>
            {running ? "Disinstallazione…" : "Sposta nel cestino"}
          </Button>
        </div>
      </div>
    </div>
  )
}
