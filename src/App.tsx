import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { homeDir } from "@tauri-apps/api/path"
import { PluginScanner } from "./core/plugin/PluginScanner"
import { TauriOS } from "./core/os/TauriOS"
import { detectPlatform, getPluginPaths } from "./core/plugin/Path"
import UpdatePage from "./LoadingComponent"
import Toolbar from "./components/Toolbar"
import Section from "./components/Section"
import SettingsDialog from "./components/SettingsDialog"
import { Button } from "./components/ui/button"
import { getAppInfo, type AppInfo } from "./core/settings/AppSettings"
import { useSettings } from "./core/settings/SettingsContext"
import { useI18n } from "./i18n/I18nProvider"
import type { Plugin } from "@/core/plugin/Plugin"
import type { ScanResult } from "./core/plugin/PluginScanner"

type SectionType = "VST2" | "VST3" | "AAX" | "AU"
const SECTION_ORDER: SectionType[] = ["VST2", "VST3", "AAX", "AU"]
const EMPTY_RESULT: ScanResult = { all: [], vst2: [], vst3: [], aax: [], au: [] }

export default function App() {
  const { t } = useI18n()
  const { settings, loaded } = useSettings()
  const platform = useMemo(() => detectPlatform(), [])
  const [home, setHome] = useState("")
  const [scanning, setScanning] = useState(false)
  const [scanned, setScanned] = useState(false)
  const [result, setResult] = useState<ScanResult>(EMPTY_RESULT)
  const [appInfo, setAppInfo] = useState<AppInfo | undefined>(undefined)
  const [showSettings, setShowSettings] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<SectionType, boolean>>({ VST2: false, VST3: false, AAX: false, AU: false })
  const [visible, setVisible] = useState<Record<SectionType, boolean>>({ VST2: true, VST3: true, AAX: true, AU: true })

  const systemPaths = useMemo(() => getPluginPaths(platform, home), [platform, home])
  // What the last scan used, so closing settings only rescans when it would change the list.
  const lastScanKey = useRef<string>("")
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  const scanKey = (s: typeof settings) =>
    JSON.stringify([s.customScanPaths, s.customScanDepth, s.disabledSystemPaths])

  const scanPlugins = useCallback(async () => {
    const s = settingsRef.current
    lastScanKey.current = scanKey(s)
    setScanning(true)
    try {
      const homePath = await homeDir().then(h => h.replace(/[\\/]+$/, ""), () => "")
      setHome(homePath)
      const scanner = new PluginScanner(
        new TauriOS(),
        getPluginPaths(platform, homePath),
        platform,
        s.customScanPaths,
        { customDepth: s.customScanDepth, disabledPaths: s.disabledSystemPaths },
      )
      setResult(await scanner.search())
      setScanned(true)
    } catch (e) {
      console.error(e)
    } finally {
      setScanning(false)
    }
  }, [platform])

  useEffect(() => {
    getAppInfo().then(setAppInfo, () => {})
    homeDir().then(h => setHome(h.replace(/[\\/]+$/, "")), () => {})
  }, [])

  // Initial scan, once the settings are known.
  const started = useRef(false)
  useEffect(() => {
    if (!loaded || started.current) return
    started.current = true
    if (settings.scanOnStartup) void scanPlugins()
  }, [loaded, settings.scanOnStartup, scanPlugins])

  const closeSettings = () => {
    setShowSettings(false)
    if (scanned && lastScanKey.current !== scanKey(settingsRef.current)) void scanPlugins()
  }

  if (!loaded || scanning) return <UpdatePage />

  const byType: Record<SectionType, Plugin[]> = { VST2: result.vst2, VST3: result.vst3, AAX: result.aax, AU: result.au }

  return (
    <div className="w-full h-full p-2 flex flex-col">
      <Toolbar
        pluginsCount={result.all.length}
        onRefresh={() => void scanPlugins()}
        onSettings={() => setShowSettings(true)}
        showAU={visible.AU}
        showVST2={visible.VST2}
        showVST3={visible.VST3}
        showAAX={visible.AAX}
        onToggleAU={value => setVisible(c => ({ ...c, AU: value }))}
        onToggleVST2={value => setVisible(c => ({ ...c, VST2: value }))}
        onToggleVST3={value => setVisible(c => ({ ...c, VST3: value }))}
        onToggleAAX={value => setVisible(c => ({ ...c, AAX: value }))}
      />

      {showSettings && (
        <SettingsDialog platform={platform} systemPaths={systemPaths} appInfo={appInfo} onClose={closeSettings} />
      )}

      {result.all.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="max-w-md">
            <h1 className="text-lg font-semibold">{scanned ? t("empty.none.title") : t("empty.idle.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {scanned ? t("empty.none.body") : t("empty.idle.body")}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => void scanPlugins()}>{t("empty.scan")}</Button>
            <Button variant="outline" onClick={() => setShowSettings(true)}>{t("empty.openSettings")}</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 overflow-y-auto">
          {SECTION_ORDER.filter(type => visible[type]).map(type => (
            <Section
              key={type}
              type={type}
              items={byType[type]}
              collapsed={collapsed[type]}
              onToggle={() => setCollapsed(c => ({ ...c, [type]: !c[type] }))}
              onUninstalled={() => void scanPlugins()}
            />
          ))}
        </div>
      )}
    </div>
  )
}
