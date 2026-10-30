import { useEffect, useRef, useState } from "react"
import { getVersion } from "@tauri-apps/api/app"
import { openUrl } from "@tauri-apps/plugin-opener"
import { Copy, ExternalLink, RefreshCw } from "lucide-react"
import { checkForUpdate, type UpdateResult } from "@/core/update"
import { buildDiagnostics } from "@/core/diagnostics"
import { pushError, getErrors } from "@/core/errorLog"
import type { StartupUpdate } from "@/core/useStartupUpdateCheck"
import {
  downloadPercent,
  initialSelfUpdateState,
  runCheck,
  runInstall,
  selfUpdateReducer,
  tauriUpdaterBackend,
  type PendingUpdate,
  type SelfUpdateAction,
  type SelfUpdateState,
} from "@/core/selfUpdate"
import { DOCS_AVAILABLE, DOCS_URL, ISSUES_URL, RELEASES_URL, REPO_URL } from "@/core/appInfo"
import type { PluginArch } from "@/core/plugin/Meta"
import { osLabel, type Platform } from "@/core/plugin/Path"
import { useSettings } from "@/core/settings/SettingsContext"
import type { AppInfo, UpdateChannel } from "@/core/settings/AppSettings"
import { useI18n } from "@/i18n/I18nProvider"
import { Alert, AlertDescription } from "../ui/alert"
import { Button } from "../ui/button"
import { Progress } from "../ui/progress"
import { Switch } from "../ui/switch"
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group"
import { Separator } from "../ui/separator"
import { Group, Rows, SettingRow } from "./SettingRow"
import markLight from "../../../assets/brand/deplug-mark-color.svg"
import markDark from "../../../assets/brand/deplug-mark-color-on-dark.svg"

type AboutProps = {
  platform: Platform
  appInfo?: AppInfo
  systemPaths: string[]
  archSummary?: Partial<Record<PluginArch, number>>
  formatCounts?: Record<string, number>
  /** Set when the opt-in startup check already found a newer version. */
  startupUpdate?: StartupUpdate | null
}

export default function AboutSection({ platform, appInfo, systemPaths, archSummary, formatCounts, startupUpdate }: AboutProps) {
  const { t, tError } = useI18n()
  const { settings, update: updateSettings } = useSettings()
  const [version, setVersion] = useState<string | null>(null)
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle")
  const [update, setUpdate] = useState<UpdateResult | "checking" | null>(null)
  const [self, setSelf] = useState<SelfUpdateState>(initialSelfUpdateState)
  const pending = useRef<PendingUpdate | null>(null)

  useEffect(() => {
    getVersion().then(setVersion, () => setVersion(null))
  }, [])

  const unknown = t("settings.about.unknown")
  const mode = appInfo?.portable ? t("settings.about.modePortable") : t("settings.about.modeNormal")

  const adminText = appInfo?.elevated ? t("settings.about.yes") : t("settings.about.no")

  const links = [
    { label: t("settings.about.github"), url: REPO_URL },
    ...(DOCS_AVAILABLE ? [{ label: t("settings.about.docs"), url: DOCS_URL }] : []),
    { label: t("settings.about.issues"), url: ISSUES_URL },
    { label: t("settings.about.releases"), url: RELEASES_URL },
  ]

  // Installed (non-portable) copies can update themselves; portable ones are replaced by hand.
  const portable = appInfo?.portable === true
  const canSelfUpdate = appInfo?.portable === false

  const dispatchSelf = (a: SelfUpdateAction) => setSelf(prev => selfUpdateReducer(prev, a))

  const runUpdateCheck = async () => {
    setUpdate("checking")
    pending.current = null
    setSelf(initialSelfUpdateState)
    // Without a known running version (plain browser dev mode) there is nothing to compare.
    const result = version ? await checkForUpdate(version, { channel: settings.updateChannel }) : ({ status: "error", reason: "invalid-version" } as const)
    // The GitHub check is the base (it knows pre-releases); the plugin then confirms it can install the update.
    // The in-app installer only sees stable releases: a pre-release always goes through the release page.
    if (result.status === "available" && result.prerelease) dispatchSelf({ type: "manual" })
    else if (result.status === "available" && canSelfUpdate) pending.current = await runCheck(tauriUpdaterBackend, dispatchSelf)
    if (result.status === "error") pushError("update", result.reason)
    setUpdate(result)
  }

  const installUpdate = async () => {
    if (pending.current) await runInstall(pending.current, a => {
      if (a.type === "failed") pushError("update", a.message)
      dispatchSelf(a)
    })
  }

  const restart = () => {
    tauriUpdaterBackend.relaunch().catch(e => { pushError("update", e); dispatchSelf({ type: "failed", message: String(e) }) })
  }

  const percent = downloadPercent(self)

  const copyDiagnostics = async () => {
    const text = buildDiagnostics({
      t,
      version,
      osName: osLabel(platform),
      osInfo: appInfo?.osInfo,
      userAgent: typeof navigator === "undefined" ? undefined : navigator.userAgent,
      portable: appInfo?.portable === true,
      elevated: platform === "windows" ? appInfo?.elevated === true : undefined,
      settings,
      dataDir: appInfo?.dataDir,
      scanFolders: [...systemPaths.filter(p => !settings.disabledSystemPaths.includes(p)), ...settings.customScanPaths],
      formatCounts: formatCounts ?? {},
      archCounts: archSummary,
      errors: getErrors(),
    })
    try {
      await navigator.clipboard.writeText(text)
      setCopyState("copied")
    } catch {
      setCopyState("failed")
    }
    window.setTimeout(() => setCopyState("idle"), 2000)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <img src={markLight} alt="" className="size-14 dark:hidden" />
        <img src={markDark} alt="" className="hidden size-14 dark:block" />
        <div>
          <div className="text-xl font-semibold tracking-tight">{t("app.name")}</div>
          <p className="text-sm text-muted-foreground">{t("settings.about.tagline")}</p>
        </div>
      </div>

      <dl className="grid grid-cols-[minmax(9rem,auto)_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-muted-foreground">{t("settings.about.version")}</dt>
        <dd className="tabular-nums">{version ?? unknown}</dd>
        <dt className="text-muted-foreground">{t("settings.about.mode")}</dt>
        <dd>{mode}</dd>
        {platform === "windows" && (
          <>
            <dt className="text-muted-foreground">{t("settings.about.admin")}</dt>
            <dd>{adminText}</dd>
          </>
        )}
        {appInfo?.portable && (
          <>
            <dt className="text-muted-foreground">{t("settings.about.dataDir")}</dt>
            <dd className="break-all">{appInfo.dataDir ?? unknown}</dd>
          </>
        )}
      </dl>

      {appInfo?.portableWarning && (
        <p role="note" className="rounded border border-destructive/60 px-3 py-2 text-sm text-destructive">
          {tError(appInfo.portableWarning)}
        </p>
      )}

      {startupUpdate && (
        <Alert role="status">
          <AlertDescription className="flex flex-col gap-2 text-foreground">
            <span className="font-medium">{t("settings.about.startupUpdate", { version: startupUpdate.latest })}</span>
            {startupUpdate.prerelease && <span className="text-muted-foreground">{t("settings.about.prereleaseHint")}</span>}
            <div>
              <Button size="sm" onClick={() => { openUrl(startupUpdate.url).catch(console.error) }}>
                {t("settings.about.openRelease")} <ExternalLink aria-hidden />
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Separator />

      <Group title={t("settings.about.updates")}>
        <Rows>
          <SettingRow label={t("settings.about.updatesAtStartup")} hint={t("settings.about.updatesAtStartupHint")} labelId="set-upd" hintId="set-upd-h">
            <Switch
              checked={settings.checkUpdatesOnStartup}
              onCheckedChange={v => updateSettings({ checkUpdatesOnStartup: v })}
              aria-labelledby="set-upd"
              aria-describedby="set-upd-h"
            />
          </SettingRow>
          <SettingRow label={t("settings.about.channel")} hint={t("settings.about.channelHint")} labelId="set-chan" wide hintId="set-chan-h">
            <ToggleGroup
              type="single"
              variant="outline"
              value={settings.updateChannel}
              onValueChange={v => { if (v) updateSettings({ updateChannel: v as UpdateChannel }) }}
              aria-labelledby="set-chan"
              aria-describedby="set-chan-h"
            >
              {(["stable", "prerelease"] as const).map(value => (
                <ToggleGroupItem key={value} value={value} className="px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                  {t(value === "stable" ? "settings.about.channelStable" : "settings.about.channelPrerelease")}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </SettingRow>
        </Rows>
        <div className="mt-1">
          <Button variant="outline" size="sm" onClick={runUpdateCheck} disabled={update === "checking"}>
            <RefreshCw aria-hidden className={update === "checking" ? "animate-spin" : ""} />
            {update === "checking" ? t("settings.about.checking") : t("settings.about.checkUpdates")}
          </Button>
        </div>
        {update && update !== "checking" && (
          <Alert variant={update.status === "error" ? "destructive" : "default"} role="status">
            <AlertDescription className="flex flex-col gap-2 text-foreground">
              {update.status === "up-to-date" && <span>{t("settings.about.upToDate", { version: update.current })}</span>}
              {update.status === "available" && (self.phase === "available" || self.phase === "downloading" || self.phase === "ready") && (
                <>
                  <span className="font-medium">{t("settings.about.updateAvailable", { version: update.latest })}</span>
                  {self.phase === "available" && (
                    <>
                      <span className="text-muted-foreground">{t("settings.about.autoHint")}</span>
                      <div>
                        <Button size="sm" onClick={installUpdate}>{t("settings.about.install")}</Button>
                      </div>
                    </>
                  )}
                  {self.phase === "downloading" && (
                    <>
                      <span className="text-muted-foreground">
                        {percent === null ? t("settings.about.downloadingUnknown") : t("settings.about.downloading", { percent })}
                      </span>
                      <Progress value={percent ?? 0} aria-label={t("settings.about.downloadingUnknown")} />
                    </>
                  )}
                  {self.phase === "ready" && (
                    <>
                      <span className="text-muted-foreground">{t("settings.about.readyToRestart", { version: self.version })}</span>
                      <div>
                        <Button size="sm" onClick={restart}>{t("settings.about.restart")}</Button>
                      </div>
                    </>
                  )}
                </>
              )}
              {update.status === "available" && (self.phase === "idle" || self.phase === "manual") && (
                <>
                  <span className="font-medium">{t("settings.about.updateAvailable", { version: update.latest })}</span>
                  <span className="text-muted-foreground">
                    {update.prerelease ? t("settings.about.prereleaseHint") : portable ? t("settings.about.portableHint") : t("settings.about.updateHint")}
                  </span>
                  <div>
                    <Button size="sm" onClick={() => { openUrl(update.url).catch(console.error) }}>
                      {t("settings.about.openRelease")} <ExternalLink aria-hidden />
                    </Button>
                  </div>
                </>
              )}
              {update.status === "available" && self.phase === "error" && (
                <>
                  <span>{t("settings.about.installError", { message: self.message })}</span>
                  <div>
                    <Button variant="outline" size="sm" onClick={() => { openUrl(update.url).catch(console.error) }}>
                      {t("settings.about.openRelease")} <ExternalLink aria-hidden />
                    </Button>
                  </div>
                </>
              )}
              {update.status === "error" && (
                <>
                  <span>{t("settings.about.updateError")}</span>
                  <div>
                    <Button variant="outline" size="sm" onClick={() => { openUrl(RELEASES_URL).catch(console.error) }}>
                      {t("settings.about.releases")} <ExternalLink aria-hidden />
                    </Button>
                  </div>
                </>
              )}
            </AlertDescription>
          </Alert>
        )}
      </Group>

      <Separator />

      <nav aria-label={t("settings.about.links")} className="flex flex-wrap gap-2">
        {links.map(link => (
          <Button key={link.url} variant="outline" size="sm" onClick={() => { openUrl(link.url).catch(console.error) }}>
            {link.label} <ExternalLink aria-hidden />
          </Button>
        ))}
      </nav>

      <div className="flex items-center gap-3">
        <Button variant="secondary" size="sm" onClick={copyDiagnostics}>
          <Copy aria-hidden /> {t("settings.about.copyDiagnostics")}
        </Button>
        <span role="status" className="text-sm text-muted-foreground">
          {copyState === "copied" ? t("settings.about.copied") : copyState === "failed" ? t("settings.about.copyFailed") : ""}
        </span>
      </div>

      <p className="text-sm text-muted-foreground">{t("settings.about.license")}</p>
    </div>
  )
}
