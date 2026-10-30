import { useEffect, useId, useRef, useState } from "react"
import { AlertTriangle, Check, ChevronRight, Loader2, ShieldCheck, Trash2, X } from "lucide-react"
import { Button } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import { Label } from "./ui/label"
import { Badge } from "./ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog"
import { ScrollArea } from "./ui/scroll-area"
import { Alert, AlertDescription, AlertTitle } from "./ui/alert"
import { RadioGroup, RadioGroupItem } from "./ui/radio-group"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible"
import { formatBytes } from "@/core/format"
import type { Plugin } from "@/core/plugin/Plugin"
import { knownArch, type MetaMap } from "@/core/plugin/Meta"
import { detectPlatform } from "@/core/plugin/Path"
import { useSettings } from "@/core/settings/SettingsContext"
import { useI18n } from "@/i18n/I18nProvider"
import {
  buildPluginPath,
  tauriUninstallBackend,
  tauriSingleBackend,
  groupVendorUninstallers,
  freedBytes,
  totalKnownSize,
  uninstallPlugins,
  uninstallSingle,
  findVendorUninstaller,
  findLeftovers,
  type BatchItemResult,
  type Leftover,
  type SingleUninstallResult,
  type VendorGroup,
  type VendorUninstaller,
} from "@/core/plugin/Uninstall"
import { pluginKey } from "@/core/plugin/ListOps"
import { canForceRemove, forceRemove, tauriForceBackend } from "@/core/plugin/ForceRemove"
import { pushError } from "@/core/errorLog"
import { elevationCandidates, restoreOutcomeKey, retryElevated, tauriElevatedBackend } from "@/core/plugin/Elevate"

type UninstallDialogProps = {
  plugins: Plugin[]
  /** Optional file metadata; the architecture is shown next to each plugin when known. */
  meta?: MetaMap
  /** `removedAny` tells the caller whether the list needs a rescan. */
  onClose: (removedAny: boolean) => void
  /** The app already runs as administrator: an access-denied error is then a plain failure. */
  elevated?: boolean
}

const NAME_MARK = "\u0001"

type Phase = "confirm" | "running" | "done"

export default function UninstallDialog({ plugins, meta, onClose, elevated = false }: UninstallDialogProps) {
  const isWindows = detectPlatform() === "windows"
  const { t, tError, language } = useI18n()
  const { settings } = useSettings()
  const many = plugins.length > 1
  const [restorePoint, setRestorePoint] = useState(settings.restorePointDefault)
  const permanent = settings.deleteMethod === "permanent"
  // Confirmation can be switched off, but never for a permanent deletion. Decided once, when the dialog opens.
  const [autoRun] = useState(() => !settings.confirmUninstall && !permanent)
  const autoStarted = useRef(false)
  const [phase, setPhase] = useState<Phase>(autoRun ? "running" : "confirm")
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ completed: BatchItemResult[]; current: Plugin | null; active: Plugin[] }>({ completed: [], current: null, active: [] })
  const [pendingConfirm, setPendingConfirm] = useState<{ message: string; resolve: (v: boolean) => void } | null>(null)
  // Single-plugin extras, discovered in the background; failures just mean "nothing extra".
  const [vendor, setVendor] = useState<VendorUninstaller | null>(null)
  const [leftovers, setLeftovers] = useState<Leftover[]>([])
  const [leftoversSearched, setLeftoversSearched] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // Batch: plugins grouped by the publisher's uninstaller they resolve to, and the groups the user chose to run.
  const [vendorGroups, setVendorGroups] = useState<VendorGroup[]>([])
  const [vendorSearched, setVendorSearched] = useState(false)
  const [chosenGroups, setChosenGroups] = useState<Set<string>>(new Set())
  const [method, setMethod] = useState<"trash" | "vendor">("trash")
  const [step, setStep] = useState<"restorePoint" | "leftovers" | "plugin" | null>(null)
  const [single, setSingle] = useState<SingleUninstallResult | null>(null)
  const [batchRestore, setBatchRestore] = useState<"created" | "skipped" | "failed">("skipped")
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)
  // Forced removal: the item waiting for the extra confirmation, and whether the deletion is running.
  const [forceItem, setForceItem] = useState<BatchItemResult | null>(null)
  const [forcing, setForcing] = useState(false)
  const cancelRef = useRef<HTMLButtonElement>(null)
  // Radix only restores focus to a <DialogTrigger>; this dialog is mounted on demand, so remember the opener.
  const opener = useRef(document.activeElement as HTMLElement | null)
  const checkboxId = useId()
  const running = phase === "running"
  const runnableVendor = vendor && vendor.kind !== "pkg" ? vendor : null
  const useVendor = method === "vendor" && runnableVendor !== null
  const [before, after] = t(useVendor ? "uninstall.descriptionVendor" : permanent ? "uninstall.descriptionPermanent" : "uninstall.description", { name: NAME_MARK }).split(NAME_MARK)
  const singleTouched = !!single && (single.leftoversTrashed > 0 || (!!single.plugin && single.plugin.status !== "failed"))
  const removedAny = many ? progress.completed.some(r => r.status === "removed" || r.action === "vendor") : singleTouched
  const runGroups = vendorGroups.filter(g => chosenGroups.has(g.key))
  const vendorPlugins = new Set(runGroups.flatMap(g => g.plugins))
  const batchVendor = many && runGroups.length > 0

  useEffect(() => {
    if (!many) return
    let alive = true
    // One lookup per plugin, one after the other; a failed lookup just means "no uninstaller for this one".
    ;(async () => {
      const entries: { plugin: Plugin; vendor: VendorUninstaller | null }[] = []
      for (const plugin of plugins) {
        const vendor = await findVendorUninstaller(buildPluginPath(plugin.installPath, plugin.name)).catch(() => null)
        if (!alive) return
        entries.push({ plugin, vendor: vendor ?? null })
      }
      setVendorGroups(groupVendorUninstallers(entries))
      setVendorSearched(true)
    })()
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (many) return
    let alive = true
    const path = buildPluginPath(plugins[0].installPath, plugins[0].name)
    findVendorUninstaller(path).then(v => { if (alive) setVendor(v ?? null) }).catch(() => {})
    findLeftovers(path)
      .then(l => { if (alive) setLeftovers(Array.isArray(l) ? l : []) })
      .catch(() => {})
      .finally(() => { if (alive) setLeftoversSearched(true) })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    // StrictMode runs effects twice in development; the uninstall must start only once.
    if (autoRun && !autoStarted.current) {
      autoStarted.current = true
      void confirm()
    }
  }, [])

  const toggleGroup = (key: string, on: boolean) =>
    setChosenGroups(prev => {
      const next = new Set(prev)
      if (on) next.add(key)
      else next.delete(key)
      return next
    })

  const toggleLeftover = (path: string, on: boolean) =>
    setSelected(prev => {
      const next = new Set(prev)
      if (on) next.add(path)
      else next.delete(path)
      return next
    })

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
    if (running || retrying || forcing) return
    onClose(phase === "done" && removedAny)
  }

  const confirm = async () => {
    setPhase("running")
    setError(null)
    setProgress({ completed: [], current: null, active: [] })
    try {
      if (!many) {
        const result = await uninstallSingle(plugins[0], {
          restorePoint: isWindows && restorePoint,
          backend: tauriSingleBackend,
          confirmContinue: message => new Promise<boolean>(resolve => setPendingConfirm({ message, resolve })),
          leftovers: leftovers.map(l => l.path).filter(p => selected.has(p)),
          method: useVendor ? "vendor" : "trash",
          deleteMethod: settings.deleteMethod,
          onStep: setStep,
        })
        setStep(null)
        if (result.status === "cancelled") {
          setPhase("confirm")
          return
        }
        // A clean run needs no summary unless there is a size to report or the confirmation was skipped.
        if (result.plugin?.status === "removed" && result.leftoverFailures.length === 0 && !autoRun && totalKnownSize(plugins, sizeOf) === null) {
          onClose(true)
          return
        }
        if (result.plugin?.status === "failed") pushError("uninstall", result.plugin.error)
        setSingle(result)
        setPhase("done")
        return
      }
      const batch = await uninstallPlugins(plugins, {
        restorePoint: isWindows && restorePoint,
        backend: tauriUninstallBackend,
        confirmContinue: message => new Promise<boolean>(resolve => setPendingConfirm({ message, resolve })),
        onProgress: (completed, current, active) => setProgress({ completed, current, active }),
        deleteMethod: settings.deleteMethod,
        vendor: runGroups.length > 0 ? { groups: runGroups, backend: tauriSingleBackend } : undefined,
      })
      if (batch.status === "cancelled") {
        setPhase("confirm")
        return
      }
      setProgress({ completed: batch.results, current: null, active: [] })
      for (const r of batch.results) if (r.status === "failed") pushError("uninstall", r.error ?? "")
      setBatchRestore(batch.restorePoint)
      setPhase("done")
    } catch (e) {
      setStep(null)
      pushError("uninstall", e)
      setError(String(e))
      setPhase("confirm")
    }
  }

  const sizeOf = (plugin: Plugin) => meta?.get(buildPluginPath(plugin.installPath, plugin.name))?.size

  const archLabel = (plugin: Plugin) => {
    const a = knownArch(meta?.get(buildPluginPath(plugin.installPath, plugin.name)))
    return a ? t(`arch.${a}`) : null
  }
  const archOf = (plugin: Plugin) => {
    const a = archLabel(plugin)
    return `${plugin.type}${a ? ` · ${a}` : ""} · ${plugin.installPath}`
  }

  // The single plugin's outcome as a batch item, so the retry, forced removal and size logic is shared with the batch flow.
  const singleItems: BatchItemResult[] = (() => {
    const o = !many ? single?.plugin : null
    if (!o) return []
    const item: BatchItemResult = { plugin: plugins[0], status: o.status === "failed" ? "failed" : o.status, action: o.action }
    if (o.status === "failed") item.error = o.error
    return [item]
  })()
  const resultItems = many ? progress.completed : singleItems
  // Items an elevated retry could fix (Windows only), for both flows.
  const retryItems = many ? progress.completed : singleItems.filter(i => i.action !== "vendor")
  const canElevate = phase === "done" && elevationCandidates(retryItems, isWindows, elevated).length > 0

  const setSingleItem = (item: BatchItemResult) => {
    if (many || !single) return
    const plugin: SingleUninstallResult["plugin"] =
      item.status === "removed"
        ? { action: item.action === "delete" ? "delete" : "trash", status: "removed" }
        : { action: item.action === "delete" ? "delete" : "trash", status: "failed", error: item.error ?? "" }
    setSingle({ ...single, plugin })
  }

  const retryWithAdmin = async () => {
    if (retrying) return
    setRetrying(true)
    setRetryError(null)
    try {
      const outcome = await retryElevated(retryItems, isWindows, tauriElevatedBackend, elevated)
      if (outcome.callError) {
        setRetryError(outcome.callError)
      } else if (many) {
        setProgress({ completed: outcome.items, current: null, active: [] })
      } else {
        setSingleItem(outcome.items[0])
      }
    } finally {
      setRetrying(false)
    }
  }

  const runForce = async () => {
    if (!forceItem || forcing) return
    const target = forceItem
    setForcing(true)
    try {
      const result = await forceRemove(target, { isWindows, alreadyElevated: elevated, backend: tauriForceBackend })
      if (many) setProgress(p => ({ ...p, completed: p.completed.map(r => (r === target ? result : r)) }))
      else setSingleItem(result)
      setForceItem(null)
    } finally {
      setForcing(false)
    }
  }

  const forceButton = (item: BatchItemResult) =>
    phase === "done" && canForceRemove(item) ? (
      <Button
        variant="outline"
        size="sm"
        className="mt-1 border-destructive/50 text-destructive hover:text-destructive"
        aria-label={t("uninstall.force.buttonLabel", { name: item.plugin.name })}
        disabled={retrying || forcing}
        onClick={() => setForceItem(item)}
      >
        <Trash2 aria-hidden />
        {t("uninstall.force.button")}
      </Button>
    ) : null

  const forcePath = forceItem ? buildPluginPath(forceItem.plugin.installPath, forceItem.plugin.name) : ""
  const forceAlert = forceItem && (
    <Alert variant="destructive" role="alertdialog" aria-label={t("uninstall.force.title", { name: forceItem.plugin.name })} className="flex flex-col gap-2 border-destructive p-3 text-sm">
      <p className="font-medium text-destructive break-words">{t("uninstall.force.title", { name: forceItem.plugin.name })}</p>
      <p className="text-foreground">{t("uninstall.force.description")}</p>
      <div className="text-xs font-medium text-foreground">{t("uninstall.force.pathLabel")}</div>
      <code className="block max-h-24 overflow-auto break-all rounded bg-muted px-2 py-1.5 font-mono text-xs text-foreground">{forcePath}</code>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => setForceItem(null)} disabled={forcing}>{t("uninstall.cancel")}</Button>
        <Button variant="destructive" size="sm" onClick={runForce} disabled={forcing}>
          {forcing ? <Loader2 aria-hidden className="animate-spin" /> : <Trash2 aria-hidden />}
          {forcing ? t("uninstall.force.working") : t("uninstall.force.confirm")}
        </Button>
      </div>
    </Alert>
  )

  const removedItems = resultItems.filter(r => r.status === "removed")
  const freed = freedBytes(resultItems, sizeOf)
  const freedLine = phase === "done" && freed !== null && freed > 0 && (
    <p role="status" className="text-xs text-muted-foreground">
      {t(removedItems.some(r => sizeOf(r.plugin) == null) ? "uninstall.result.freedAtLeast" : "uninstall.result.freed", { size: formatBytes(freed, language) })}
    </p>
  )

  const restoreKey = restoreOutcomeKey(many ? batchRestore : (single?.restorePoint ?? "skipped"), isWindows && restorePoint)
  const restoreLine = phase === "done" && restoreKey && (
    <p className="text-xs text-muted-foreground">{t(restoreKey)}</p>
  )
  const elevateAlert = canElevate && (
    <Alert className="p-3">
      <ShieldCheck aria-hidden />
      <AlertTitle className="line-clamp-none">
        {many ? t("uninstall.elevate.titleMany") : t("uninstall.elevate.titleOne")}
      </AlertTitle>
      <AlertDescription className="gap-2">
        <p>{t("uninstall.elevate.description")}</p>
        {retryError && <p role="alert" className="break-words text-destructive">{tError(retryError)}</p>}
        <Button variant="outline" size="sm" className="self-start" onClick={retryWithAdmin} disabled={retrying}>
          {retrying ? <Loader2 aria-hidden className="animate-spin" /> : <ShieldCheck aria-hidden />}
          {retrying ? t("uninstall.elevate.retrying") : t("uninstall.elevate.retry")}
        </Button>
      </AlertDescription>
    </Alert>
  )

  const failed = progress.completed.filter(r => r.status !== "removed").length
  const removed = progress.completed.length - failed
  const usedVendor = progress.completed.some(r => r.action === "vendor")
  // Wording of the batch summary: "trash" or "deleted" when every removal worked the same way, otherwise neutral.
  const removedHow = new Set(progress.completed.filter(r => r.status === "removed").map(r => r.action ?? "trash"))
  const summaryKind: "trash" | "permanent" | "vendor" =
    usedVendor || removedHow.size > 1 ? "vendor" : removedHow.has("delete") || (removedHow.size === 0 && permanent) ? "permanent" : "trash"

  // Results are matched by plugin, not by position: a publisher's uninstaller settles several plugins at once.
  const statusOf = (plugin: Plugin): BatchItemResult | "running" | "pending" => {
    const done = progress.completed.find(r => r.plugin === plugin)
    if (done) return done
    return progress.active.includes(plugin) ? "running" : "pending"
  }

  // Once finished, failures come first so their errors are visible without scrolling.
  const ordered = plugins.map((plugin, index) => ({ plugin, index }))
  if (phase === "done") {
    const bad = (plugin: Plugin) => Number(progress.completed.find(r => r.plugin === plugin)?.status === "failed")
    ordered.sort((a, b) => bad(b.plugin) - bad(a.plugin))
  }
  const vendorWaiting = running && many && progress.active.some(p => vendorPlugins.has(p))

  return (
    <Dialog open onOpenChange={open => { if (!open) cancel() }}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[calc(100%-2rem)] flex-col gap-3 overflow-y-auto bg-card p-4 text-card-foreground"
        onCloseAutoFocus={e => {
          e.preventDefault()
          if (opener.current?.isConnected) opener.current.focus()
        }}
        onOpenAutoFocus={e => {
          // Land on the safe choice, not on the destructive button.
          e.preventDefault()
          cancelRef.current?.focus()
        }}
        // Only the explicit buttons dismiss this dialog.
        onInteractOutside={e => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {many ? t("uninstall.titleMany", { count: plugins.length }) : t("uninstall.title")}
          </DialogTitle>
        </DialogHeader>
        <DialogDescription asChild>
        <div className="flex flex-col gap-2 text-sm text-foreground">
          {phase === "done" && !many ? (
            <p role="status">{t("uninstall.result.title")}</p>
          ) : phase === "done" ? (
            <p role="status">
              {summaryKind === "vendor"
                ? (failed === 0 ? t("uninstall.summaryVendorOk", { removed }) : t("uninstall.summaryVendor", { removed, failed }))
                : summaryKind === "permanent"
                  ? (failed === 0 ? t("uninstall.summaryOkPermanent", { removed }) : t("uninstall.summaryPermanent", { removed, failed }))
                  : (failed === 0 ? t("uninstall.summaryOk", { removed }) : t("uninstall.summary", { removed, failed }))}
            </p>
          ) : many ? (
            running ? (
              <p role="status">
                {t("uninstall.progress", { current: Math.min(progress.completed.length + 1, plugins.length), total: plugins.length })}
              </p>
            ) : (
              <p>
                {batchVendor
                  ? t(permanent ? "uninstall.descriptionManyVendorPermanent" : "uninstall.descriptionManyVendor", { vendorCount: vendorPlugins.size, count: plugins.length })
                  : t(permanent ? "uninstall.descriptionManyPermanent" : "uninstall.descriptionMany", { count: plugins.length })}
              </p>
            )
          ) : (
            <>
              <p>
                {before}<strong className="break-all">{plugins[0].name}</strong>{after}
              </p>
              {phase === "confirm" && (
                <p className="break-all text-muted-foreground">
                  {buildPluginPath(plugins[0].installPath, plugins[0].name)}
                  {archLabel(plugins[0]) && ` · ${archLabel(plugins[0])}`}
                </p>
              )}
            </>
          )}
        </div>
        </DialogDescription>

        {many && (
          <ScrollArea className="min-h-0 rounded border border-border [&_[data-radix-scroll-area-viewport]]:max-h-60 [&_[data-radix-scroll-area-viewport]>div]:!block">
          <ul
            aria-label={many ? t("uninstall.titleMany", { count: plugins.length }) : plugins[0].name}
            className="flex flex-col divide-y outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50"
            tabIndex={0}
          >
            {ordered.map(({ plugin }) => {
              const st = phase === "confirm" ? "pending" : statusOf(plugin)
              const result = typeof st === "object" ? st : null
              return (
                <li key={pluginKey(plugin)} className="flex items-start gap-2 px-2 py-1.5 text-sm">
                  {phase !== "confirm" && (
                    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
                      {result?.status === "removed" && <Check aria-hidden className="size-4" />}
                      {result?.status === "still-present" && <AlertTriangle aria-hidden className="size-4 text-amber-600 dark:text-amber-400" />}
                      {result?.status === "failed" && <X aria-hidden className="size-4 text-destructive" />}
                      {st === "running" && <Loader2 aria-hidden className="size-4 animate-spin" />}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium" title={plugin.name}>{plugin.name}</div>
                    <div className="truncate text-xs text-muted-foreground" title={plugin.installPath}>
                      {archOf(plugin)}
                    </div>
                    {result?.status === "failed" && (
                      <div className="mt-0.5 break-words text-xs text-destructive">
                        {tError(result.error ?? t("uninstall.unknownError"))}
                      </div>
                    )}
                    {result?.status === "still-present" && (
                      <div className="mt-0.5 break-words text-xs text-muted-foreground">{t("uninstall.resultStillPresentHint")}</div>
                    )}
                    {result && forceButton(result)}
                  </div>
                  {phase !== "confirm" && (
                    <Badge variant="outline" className={result?.status === "failed" ? "border-destructive/50 text-destructive" : "border-transparent text-muted-foreground"}>
                      {result?.status === "removed" && (result.action === "vendor" ? t("uninstall.resultVendorOk") : result.action === "delete" ? t("uninstall.resultDeleted") : t("uninstall.resultOk"))}
                      {result?.status === "still-present" && t("uninstall.resultStillPresent")}
                      {result?.status === "failed" && t("uninstall.resultFailed")}
                      {st === "running" && t("uninstall.resultRunning")}
                      {st === "pending" && t("uninstall.resultPending")}
                    </Badge>
                  )}
                </li>
              )
            })}
          </ul>
          </ScrollArea>
        )}

        {many && phase === "done" && (<>{freedLine}{restoreLine}{elevateAlert}{forceAlert}</>)}

        {many && phase !== "done" && !vendorSearched && (
          <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 aria-hidden className="size-3.5 shrink-0 animate-spin" />
            {t("uninstall.batchVendor.searching")}
          </p>
        )}
        {many && phase !== "done" && vendorGroups.length > 0 && (
          <Alert role="group" className="p-3">
            <ShieldCheck aria-hidden />
            <AlertTitle className="line-clamp-none">{t("uninstall.batchVendor.title")}</AlertTitle>
            <AlertDescription className="gap-2">
              <p>{t("uninstall.batchVendor.hint")}</p>
              <ul className="flex w-full flex-col gap-2">
                {vendorGroups.map((g, i) => (
                  <li key={g.key} className="flex items-start gap-2">
                    <Checkbox
                      id={`${checkboxId}-v${i}`}
                      checked={chosenGroups.has(g.key)}
                      disabled={running}
                      onCheckedChange={v => toggleGroup(g.key, v === true)}
                      className="mt-0.5"
                    />
                    <Label htmlFor={`${checkboxId}-v${i}`} className="min-w-0 flex-1 flex-col items-start gap-0.5 font-normal">
                      <span className="break-words font-medium text-foreground">
                        {g.plugins.length === 1
                          ? t("uninstall.batchVendor.optionOne", { name: g.vendor.displayName })
                          : t("uninstall.batchVendor.option", { name: g.vendor.displayName, count: g.plugins.length })}
                      </span>
                      {g.vendor.publisher && <span className="text-xs text-muted-foreground">{g.vendor.publisher}</span>}
                      <span className="break-words text-xs text-muted-foreground">{g.plugins.map(p => p.name).join(", ")}</span>
                      {chosenGroups.has(g.key) && (
                        <code className="mt-1 block max-h-24 w-full overflow-auto break-all rounded bg-muted px-2 py-1.5 font-mono text-xs text-foreground">
                          {g.vendor.commandPreview}
                        </code>
                      )}
                    </Label>
                  </li>
                ))}
              </ul>
              {batchVendor && <p className="text-xs text-foreground">{t("uninstall.vendor.warning")}</p>}
            </AlertDescription>
          </Alert>
        )}

        {!many && phase === "done" && single && (
          <ul className="flex flex-col gap-2 rounded border border-border p-2 text-sm">
            {single.leftoversTrashed > 0 && (
              <ResultLine tone="ok">
                {single.leftoverFailures.length === 0
                  ? t(permanent ? "uninstall.result.leftoversDeleted" : "uninstall.result.leftoversOk", { count: single.leftoversTrashed })
                  : t(permanent ? "uninstall.result.leftoversDeletedPartial" : "uninstall.result.leftoversPartial", { done: single.leftoversTrashed, total: single.leftoversTrashed + single.leftoverFailures.length })}
              </ResultLine>
            )}
            {single.leftoverFailures.map(f => (
              <ResultLine key={f.path} tone="fail" detail={tError(f.error)}>
                {t(permanent ? "uninstall.result.leftoverDeleteFailed" : "uninstall.result.leftoverFailed", { path: f.path })}
              </ResultLine>
            ))}
            {single.plugin?.action === "trash" && single.plugin.status === "removed" && (
              <ResultLine tone="ok">{t("uninstall.result.pluginTrashed", { name: plugins[0].name })}</ResultLine>
            )}
            {single.plugin?.action === "trash" && single.plugin.status === "failed" && (
              <ResultLine tone="fail" detail={tError(single.plugin.error)}>
                {t("uninstall.result.pluginTrashFailed", { name: plugins[0].name })}
              </ResultLine>
            )}
            {single.plugin?.action === "delete" && single.plugin.status === "removed" && (
              <ResultLine tone="ok">{t("uninstall.result.pluginDeleted", { name: plugins[0].name })}</ResultLine>
            )}
            {single.plugin?.action === "delete" && single.plugin.status === "failed" && (
              <ResultLine tone="fail" detail={tError(single.plugin.error)}>
                {t("uninstall.result.pluginDeleteFailed", { name: plugins[0].name })}
              </ResultLine>
            )}
            {single.plugin?.action === "vendor" && single.plugin.status === "removed" && (
              <ResultLine tone="ok">{t("uninstall.result.vendorOk")}</ResultLine>
            )}
            {single.plugin?.action === "vendor" && single.plugin.status === "still-present" && (
              <ResultLine tone="warn">
                {t("uninstall.result.vendorOk")} {t("uninstall.result.vendorStillPresent", { name: plugins[0].name })}
              </ResultLine>
            )}
            {single.plugin?.action === "vendor" && single.plugin.status === "failed" && (
              <ResultLine tone="fail" detail={tError(single.plugin.error)}>
                {t("uninstall.result.vendorFailed")}
              </ResultLine>
            )}
            {singleItems[0] && forceButton(singleItems[0]) && <li className="flex justify-end">{forceButton(singleItems[0])}</li>}
          </ul>
        )}

        {!many && phase === "done" && single && (<>{freedLine}{restoreLine}{elevateAlert}{forceAlert}</>)}

        {!many && phase !== "done" && vendor && (
          <Alert role="group" className="p-3">
            <ShieldCheck aria-hidden />
            <AlertTitle className="line-clamp-none">{t("uninstall.vendor.title")}</AlertTitle>
            <AlertDescription className="gap-2">
              <p className="break-words text-foreground">
                {vendor.publisher
                  ? t("uninstall.vendor.detail", { name: vendor.displayName, publisher: vendor.publisher })
                  : t("uninstall.vendor.detailNoPublisher", { name: vendor.displayName })}
              </p>
              {vendor.kind === "pkg" ? (
                <p>{t("uninstall.vendor.pkgInfo", { id: vendor.commandPreview })}</p>
              ) : (
                <>
                  <RadioGroup
                    value={method}
                    onValueChange={v => setMethod(v === "vendor" ? "vendor" : "trash")}
                    disabled={running}
                    aria-label={t("uninstall.vendor.choice")}
                    className="w-full gap-2"
                  >
                    {(["trash", "vendor"] as const).map(m => (
                      <Label key={m} htmlFor={`${checkboxId}-${m}`} className="items-start gap-2 font-normal">
                        <RadioGroupItem value={m} id={`${checkboxId}-${m}`} className="mt-0.5" />
                        <span className="flex flex-col gap-0.5">
                          <span className="font-medium text-foreground">
                            {m === "trash" ? t(permanent ? "uninstall.vendor.optionTrashPermanent" : "uninstall.vendor.optionTrash") : t("uninstall.vendor.optionRun")}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {m === "trash" ? t(permanent ? "uninstall.vendor.optionTrashPermanentHint" : "uninstall.vendor.optionTrashHint") : t("uninstall.vendor.optionRunHint")}
                          </span>
                        </span>
                      </Label>
                    ))}
                  </RadioGroup>
                  {useVendor && (
                    <div className="flex w-full flex-col gap-2">
                      <div className="text-xs font-medium text-foreground">{t("uninstall.vendor.command")}</div>
                      <code className="block max-h-24 overflow-auto break-all rounded bg-muted px-2 py-1.5 font-mono text-xs text-foreground">
                        {vendor.commandPreview}
                      </code>
                      <p className="text-xs text-foreground">{t("uninstall.vendor.warning")}</p>
                    </div>
                  )}
                </>
              )}
            </AlertDescription>
          </Alert>
        )}

        {!many && phase !== "done" && !leftoversSearched && (
          <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 aria-hidden className="size-3.5 shrink-0 animate-spin" />
            {t("uninstall.leftovers.searching")}
          </p>
        )}
        {!many && phase !== "done" && leftoversSearched && leftovers.length === 0 && (
          <p role="status" className="text-xs text-muted-foreground">{t("uninstall.leftovers.none")}</p>
        )}
        {!many && phase !== "done" && leftovers.length > 0 && (
          <Collapsible className="rounded-lg border border-border">
            <CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
              <ChevronRight aria-hidden className="size-4 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
              {t("uninstall.leftovers.title", { count: leftovers.length })}
              {selected.size > 0 && <Badge variant="secondary" className="ml-auto">{selected.size}</Badge>}
            </CollapsibleTrigger>
            <CollapsibleContent className="flex flex-col gap-2 px-3 pb-3">
              <p className="text-xs text-muted-foreground">{t(permanent ? "uninstall.leftovers.hintPermanent" : "uninstall.leftovers.hint")}</p>
              <ul className="flex flex-col gap-1.5">
                {leftovers.map((l, i) => (
                  <li key={l.path} className="flex items-start gap-2">
                    <Checkbox
                      id={`${checkboxId}-l${i}`}
                      aria-label={t(permanent ? "uninstall.leftovers.selectPermanent" : "uninstall.leftovers.select", { path: l.path })}
                      checked={selected.has(l.path)}
                      disabled={running}
                      onCheckedChange={v => toggleLeftover(l.path, v === true)}
                      className="mt-0.5"
                    />
                    <Label htmlFor={`${checkboxId}-l${i}`} className="min-w-0 flex-1 flex-col items-start gap-0 font-normal">
                      <span className="break-all text-sm">{l.path}</span>
                      <span className="text-xs text-muted-foreground">
                        {l.size == null ? t("uninstall.leftovers.sizeUnknown") : formatBytes(l.size, language)}
                      </span>
                    </Label>
                  </li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
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

        {vendorWaiting && !pendingConfirm && (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 aria-hidden className="size-4 shrink-0 animate-spin" />
            {t("uninstall.step.vendor")}
          </p>
        )}
        {running && !many && step && !pendingConfirm && (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 aria-hidden className="size-4 shrink-0 animate-spin" />
            {step === "plugin" && useVendor ? t("uninstall.step.vendor") : step === "leftovers" && permanent ? t("uninstall.step.leftoversPermanent") : t(`uninstall.step.${step}`)}
          </p>
        )}

        {pendingConfirm && (
          <Alert variant="destructive" className="flex flex-col gap-2 border-destructive p-2 text-sm">
            <p className="text-destructive break-words">{tError(pendingConfirm.message)}</p>
            <p className="text-foreground">{t("uninstall.continueQuestion")}</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => answer(false)}>{t("uninstall.no")}</Button>
              <Button variant="destructive" size="sm" onClick={() => answer(true)}>{t("uninstall.yesContinue")}</Button>
            </div>
          </Alert>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive break-words">{tError(error)}</p>
        )}

        <DialogFooter>
          {phase === "done" ? (
            <Button ref={cancelRef as never} variant="outline" onClick={cancel} disabled={retrying}>
              {t("uninstall.close")}
            </Button>
          ) : (
            <>
              <Button ref={cancelRef as never} variant="outline" onClick={cancel} disabled={running && !pendingConfirm}>
                {t("uninstall.cancel")}
              </Button>
              <Button variant="destructive" onClick={confirm} disabled={running}>
                {running
                  ? (useVendor ? t("uninstall.runningVendor") : t("uninstall.running"))
                  : (useVendor ? t("uninstall.confirmVendor") : batchVendor ? t("uninstall.confirmMixed") : permanent ? t("uninstall.confirmPermanent") : t("uninstall.confirm"))}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** One line of the single-plugin result summary. */
function ResultLine({ tone, detail, children }: { tone: "ok" | "warn" | "fail"; detail?: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
        {tone === "ok" && <Check aria-hidden className="size-4" />}
        {tone === "warn" && <AlertTriangle aria-hidden className="size-4 text-amber-600 dark:text-amber-400" />}
        {tone === "fail" && <X aria-hidden className="size-4 text-destructive" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className={`break-words ${tone === "fail" ? "text-destructive" : ""}`}>{children}</div>
        {detail && <div className="break-words text-xs text-muted-foreground">{detail}</div>}
      </div>
    </li>
  )
}
