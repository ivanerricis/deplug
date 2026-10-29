import { useEffect, useId, useRef, useState } from "react"
import { Info, ScanSearch, SlidersHorizontal, Trash2, X, type LucideIcon } from "lucide-react"
import { useSettings } from "@/core/settings/SettingsContext"
import type { AppInfo } from "@/core/settings/AppSettings"
import type { Platform } from "@/core/plugin/Path"
import type { PluginArch } from "@/core/plugin/Meta"
import { useI18n } from "@/i18n/I18nProvider"
import type { MessageKey } from "@/i18n/translate"
import { cn } from "@/lib/utils"
import { Button } from "./ui/button"
import { useModal } from "./ui/useModal"
import GeneralSection from "./settings/GeneralSection"
import ScanSection from "./settings/ScanSection"
import UninstallSection from "./settings/UninstallSection"
import AboutSection from "./settings/AboutSection"

type TabId = "general" | "scan" | "uninstall" | "about"

const TABS: { id: TabId; label: MessageKey; icon: LucideIcon }[] = [
  { id: "general", label: "settings.nav.general", icon: SlidersHorizontal },
  { id: "scan", label: "settings.nav.scan", icon: ScanSearch },
  { id: "uninstall", label: "settings.nav.uninstall", icon: Trash2 },
  { id: "about", label: "settings.nav.about", icon: Info },
]

type SettingsDialogProps = {
  platform: Platform
  systemPaths: string[]
  /** Plugins per detected architecture, for the diagnostics text. */
  archSummary?: Partial<Record<PluginArch, number>>
  appInfo?: AppInfo
  initialTab?: TabId
  onClose: () => void
}

export default function SettingsDialog({ platform, systemPaths, archSummary, appInfo, initialTab = "general", onClose }: SettingsDialogProps) {
  const { t, tError } = useI18n()
  const { saveError, clearSaveError } = useSettings()
  const [tab, setTab] = useState<TabId>(initialTab)
  const dialogRef = useRef<HTMLDivElement>(null)
  const tabsRef = useRef<HTMLDivElement>(null)
  const uid = useId()
  const titleId = `${uid}-title`

  useModal(dialogRef, onClose)
  useEffect(() => {
    // Start on the selected tab rather than the close button.
    tabsRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus()
  }, [])

  const onTabKey = (e: React.KeyboardEvent, index: number) => {
    const delta = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0
    const jump = e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : null
    if (!delta && jump === null) return
    e.preventDefault()
    const next = jump ?? (index + delta + TABS.length) % TABS.length
    setTab(TABS[next].id)
    tabsRef.current?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-full w-full max-w-[680px] flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-lg"
        style={{ height: 560 }}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-border py-2 pl-5 pr-3">
          <h2 id={titleId} className="text-base font-semibold">{t("settings.title")}</h2>
          <Button variant="ghost" size="icon-sm" aria-label={t("settings.close")} onClick={onClose}>
            <X />
          </Button>
        </header>

        <div className="flex min-h-0 flex-1">
          <div
            ref={tabsRef}
            role="tablist"
            aria-orientation="vertical"
            aria-label={t("settings.sections")}
            className="flex w-44 shrink-0 flex-col gap-0.5 border-r border-border bg-background/60 p-2"
          >
            {TABS.map(({ id, label, icon: Icon }, i) => {
              const active = tab === id
              return (
                <button
                  key={id}
                  id={`${uid}-tab-${id}`}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={`${uid}-panel-${id}`}
                  tabIndex={active ? 0 : -1}
                  onClick={() => setTab(id)}
                  onKeyDown={e => onTabKey(e, i)}
                  className={cn(
                    "relative flex h-9 w-full cursor-pointer items-center gap-2.5 rounded px-3 text-left text-sm outline-none transition-colors",
                    "focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    active ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  )}
                >
                  {active && <span aria-hidden className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-signal" />}
                  <Icon aria-hidden className="size-4 shrink-0" />
                  <span className="truncate">{t(label)}</span>
                </button>
              )
            })}
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            {saveError && (
              <div role="alert" className="flex shrink-0 items-start justify-between gap-2 bg-destructive/10 px-5 py-2 text-sm text-destructive">
                <span className="break-words">{t("settings.saveError", { error: tError(saveError) })}</span>
                <button type="button" onClick={clearSaveError} className="shrink-0 cursor-pointer rounded px-1 underline outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                  {t("settings.dismiss")}
                </button>
              </div>
            )}
            <div
              key={tab}
              id={`${uid}-panel-${tab}`}
              role="tabpanel"
              aria-labelledby={`${uid}-tab-${tab}`}
              tabIndex={0}
              className="min-h-0 flex-1 overflow-y-auto px-5 py-4 outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/50"
            >
              {tab === "general" && <GeneralSection />}
              {tab === "scan" && <ScanSection systemPaths={systemPaths} />}
              {tab === "uninstall" && <UninstallSection platform={platform} />}
              {tab === "about" && <AboutSection platform={platform} appInfo={appInfo} systemPaths={systemPaths} archSummary={archSummary} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
