import { useRef, useState } from "react"
import { Info, ScanSearch, SlidersHorizontal, Trash2, X, type LucideIcon } from "lucide-react"
import { useSettings } from "@/core/settings/SettingsContext"
import type { AppInfo } from "@/core/settings/AppSettings"
import type { Platform } from "@/core/plugin/Path"
import { useI18n } from "@/i18n/I18nProvider"
import type { MessageKey } from "@/i18n/translate"
import { Alert, AlertDescription } from "./ui/alert"
import { Button } from "./ui/button"
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog"
import { ScrollArea } from "./ui/scroll-area"
import { Separator } from "./ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
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
  appInfo?: AppInfo
  initialTab?: TabId
  onClose: () => void
}

export default function SettingsDialog({ platform, systemPaths, appInfo, initialTab = "general", onClose }: SettingsDialogProps) {
  const { t, tError } = useI18n()
  const { saveError, clearSaveError } = useSettings()
  const [tab, setTab] = useState<TabId>(initialTab)
  const tabsRef = useRef<HTMLDivElement>(null)
  // Radix only restores focus to a <DialogTrigger>; this dialog is mounted on demand, so remember the opener.
  const opener = useRef(document.activeElement as HTMLElement | null)

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="flex h-[560px] max-h-[calc(100%-2rem)] flex-col gap-0 overflow-hidden bg-card p-0 text-card-foreground sm:max-w-[680px]"
        onCloseAutoFocus={e => {
          e.preventDefault()
          if (opener.current?.isConnected) opener.current.focus()
        }}
        onOpenAutoFocus={e => {
          // Start on the selected tab rather than the close button.
          e.preventDefault()
          tabsRef.current?.querySelector<HTMLElement>('[role="tab"][data-state="active"]')?.focus()
        }}
      >
        <DialogHeader className="flex-row items-center justify-between space-y-0 py-2 pl-5 pr-3">
          <DialogTitle className="text-base">{t("settings.title")}</DialogTitle>
          <DialogClose asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t("settings.close")}>
              <X />
            </Button>
          </DialogClose>
        </DialogHeader>
        <Separator />

        <Tabs
          value={tab}
          onValueChange={v => setTab(v as TabId)}
          orientation="vertical"
          className="min-h-0 flex-1 flex-row gap-0"
        >
          <TabsList
            ref={tabsRef}
            aria-label={t("settings.sections")}
            className="h-auto w-44 shrink-0 flex-col items-stretch justify-start gap-0.5 rounded-none border-r border-border bg-background/60 p-2"
          >
            {TABS.map(({ id, label, icon: Icon }) => (
              <TabsTrigger
                key={id}
                value={id}
                className="relative h-9 flex-none cursor-pointer justify-start gap-2.5 px-3 text-left text-muted-foreground before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full hover:bg-accent/60 hover:text-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground data-[state=active]:shadow-none data-[state=active]:before:bg-signal dark:text-muted-foreground dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-accent dark:data-[state=active]:text-accent-foreground"
              >
                <Icon aria-hidden />
                <span className="truncate">{t(label)}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {saveError && (
              <Alert variant="destructive" className="shrink-0 rounded-none border-0 bg-destructive/10 px-5 py-2">
                <AlertDescription className="flex items-start justify-between gap-2 text-destructive">
                  <span className="break-words">{t("settings.saveError", { error: tError(saveError) })}</span>
                  <button type="button" onClick={clearSaveError} className="shrink-0 cursor-pointer rounded px-1 underline outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                    {t("settings.dismiss")}
                  </button>
                </AlertDescription>
              </Alert>
            )}
            <ScrollArea className="min-h-0 flex-1 [&_[data-radix-scroll-area-viewport]>div]:!block">
              <TabsContent value="general" className="px-5 py-4"><GeneralSection /></TabsContent>
              <TabsContent value="scan" className="px-5 py-4"><ScanSection systemPaths={systemPaths} /></TabsContent>
              <TabsContent value="uninstall" className="px-5 py-4"><UninstallSection platform={platform} /></TabsContent>
              <TabsContent value="about" className="px-5 py-4"><AboutSection platform={platform} appInfo={appInfo} systemPaths={systemPaths} /></TabsContent>
            </ScrollArea>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
