import { useEffect, useState } from "react"
import { getVersion } from "@tauri-apps/api/app"
import { openUrl } from "@tauri-apps/plugin-opener"
import { Copy, ExternalLink } from "lucide-react"
import { DOCS_AVAILABLE, DOCS_URL, ISSUES_URL, RELEASES_URL, REPO_URL } from "@/core/appInfo"
import { osLabel, type Platform } from "@/core/plugin/Path"
import { useSettings } from "@/core/settings/SettingsContext"
import type { AppInfo } from "@/core/settings/AppSettings"
import { useI18n } from "@/i18n/I18nProvider"
import { Button } from "../ui/button"
import markLight from "../../../assets/brand/deplug-mark-color.svg"
import markDark from "../../../assets/brand/deplug-mark-color-on-dark.svg"

type AboutProps = {
  platform: Platform
  appInfo?: AppInfo
  systemPaths: string[]
}

export default function AboutSection({ platform, appInfo, systemPaths }: AboutProps) {
  const { t, tError } = useI18n()
  const { settings } = useSettings()
  const [version, setVersion] = useState<string | null>(null)
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle")

  useEffect(() => {
    getVersion().then(setVersion, () => setVersion(null))
  }, [])

  const unknown = t("settings.about.unknown")
  const mode = appInfo?.portable ? t("settings.about.modePortable") : t("settings.about.modeNormal")

  const links = [
    { label: t("settings.about.github"), url: REPO_URL },
    ...(DOCS_AVAILABLE ? [{ label: t("settings.about.docs"), url: DOCS_URL }] : []),
    { label: t("settings.about.issues"), url: ISSUES_URL },
    { label: t("settings.about.releases"), url: RELEASES_URL },
  ]

  const copyDiagnostics = async () => {
    const folders = [...systemPaths.filter(p => !settings.disabledSystemPaths.includes(p)), ...settings.customScanPaths]
    const text = [
      `Deplug`,
      `${t("diagnostics.version")}: ${version ?? unknown}`,
      `${t("diagnostics.os")}: ${osLabel(platform)}`,
      `${t("diagnostics.mode")}: ${mode}`,
      ...(appInfo?.portable && appInfo.dataDir ? [`${t("diagnostics.dataDir")}: ${appInfo.dataDir}`] : []),
      `${t("diagnostics.scanFolders")}: ${folders.length === 0 ? t("diagnostics.none") : ""}`,
      ...folders.map(f => `  - ${f}`),
    ].join("\n")
    try {
      await navigator.clipboard.writeText(text)
      setCopyState("copied")
    } catch {
      setCopyState("failed")
    }
    window.setTimeout(() => setCopyState("idle"), 2000)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <img src={markLight} alt="" className="size-14 dark:hidden" />
        <img src={markDark} alt="" className="hidden size-14 dark:block" />
        <div>
          <div className="text-xl font-semibold tracking-tight">{t("app.name")}</div>
          <p className="text-sm text-muted-foreground">{t("settings.about.tagline")}</p>
        </div>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-muted-foreground">{t("settings.about.version")}</dt>
        <dd className="tabular-nums">{version ?? unknown}</dd>
        <dt className="text-muted-foreground">{t("settings.about.mode")}</dt>
        <dd>{mode}</dd>
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
