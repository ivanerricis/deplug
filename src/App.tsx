import { useEffect, useState } from "react"

import { homeDir } from "@tauri-apps/api/path"
import { PluginScanner } from "./core/plugin/PluginScanner"
import { TauriOS } from "./core/os/TauriOS"
import { detectPlatform, getPluginPaths } from "./core/plugin/Path"
import UpdatePage from "./LoadingComponent"
import Toolbar from "./components/Toolbar"
import { Plugin } from "@/core/plugin/Plugin";
import Section from "./components/Section"
import SettingsPanel from "./components/SettingsPanel"
import { loadCustomPaths, saveCustomPaths } from "./core/plugin/CustomPaths"
import { getAppInfo, type AppInfo } from "./core/settings/AppSettings"

export default function App() {
  const [loading, setLoading] = useState(true)
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [pluginsVST2, setPluginsVST2] = useState<Plugin[]>([])
  const [pluginsVST3, setPluginsVST3] = useState<Plugin[]>([])
  const [pluginsAAX, setPluginsAAX] = useState<Plugin[]>([])
  const [pluginsAU, setPluginsAU] = useState<Plugin[]>([])
  const [customPaths, setCustomPaths] = useState<string[]>([])
  const [appInfo, setAppInfo] = useState<AppInfo | undefined>(undefined)
  const [showSettings, setShowSettings] = useState(false)
  const [collapsedSections, setCollapsedSections] = useState({
    VST2: false,
    VST3: false,
    AAX: false,
    AU: false,
  })
  const [visibleSections, setVisibleSections] = useState({
    VST2: true,
    VST3: true,
    AAX: true,
    AU: true,
  })

  const scanPlugins = async (extraPaths: string[] = customPaths) => {
    setLoading(true)
    try {
      const platform = detectPlatform()
      const home = await homeDir().then(h => h.replace(/[\\/]+$/, ""), () => "")
      const scanner = new PluginScanner(new TauriOS(), getPluginPaths(platform, home), platform, extraPaths)

      const found = await scanner.search()
      setPlugins(found.all)
      setPluginsVST2(found.vst2)
      setPluginsVST3(found.vst3)
      setPluginsAAX(found.aax)
      setPluginsAU(found.au)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    getAppInfo().then(setAppInfo, () => {})
    loadCustomPaths()
      .then(paths => {
        setCustomPaths(paths)
        return scanPlugins(paths)
      })
      .catch(error => {
        console.error(error)
        return scanPlugins([])
      })
  }, [])

  if (loading) return <UpdatePage />

  return (
    <div className="w-full h-full p-2 flex flex-col">
      <Toolbar
        pluginsCount={plugins.length}
        onRefresh={() => scanPlugins()}
        onSettings={() => setShowSettings(s => !s)}
        showAU={visibleSections.AU}
        onToggleAU={(value) => setVisibleSections(current => ({ ...current, AU: value }))}
        showVST2={visibleSections.VST2}
        showVST3={visibleSections.VST3}
        showAAX={visibleSections.AAX}
        onToggleVST2={(value) => setVisibleSections(current => ({ ...current, VST2: value }))}
        onToggleVST3={(value) => setVisibleSections(current => ({ ...current, VST3: value }))}
        onToggleAAX={(value) => setVisibleSections(current => ({ ...current, AAX: value }))}
      />

      {showSettings && (
        <SettingsPanel
          paths={customPaths}
          appInfo={appInfo}
          onChange={(paths) => {
            setCustomPaths(paths)
            saveCustomPaths(paths).catch(console.error)
            scanPlugins(paths)
          }}
          onClose={() => setShowSettings(false)}
        />
      )}

      {plugins.length === 0 ? (
        <p className="shrink-0">Nessun plugin trovato</p>
      ) : (
        <div className="flex flex-col gap-2">
          {visibleSections.VST2 && (
            <Section
              type="VST2"
              items={pluginsVST2}
              collapsed={collapsedSections.VST2}
              onToggle={() =>
                setCollapsedSections(current => ({ ...current, VST2: !current.VST2 }))
              }
            ></Section>
          )}
          {visibleSections.VST3 && (
            <Section
              type="VST3"
              items={pluginsVST3}
              collapsed={collapsedSections.VST3}
              onToggle={() =>
                setCollapsedSections(current => ({ ...current, VST3: !current.VST3 }))
              }
            ></Section>
          )}
          {visibleSections.AAX && (
            <Section
              type="AAX"
              items={pluginsAAX}
              collapsed={collapsedSections.AAX}
              onToggle={() =>
                setCollapsedSections(current => ({ ...current, AAX: !current.AAX }))
              }
            ></Section>
          )}
          {visibleSections.AU && (
            <Section
              type="AU"
              items={pluginsAU}
              collapsed={collapsedSections.AU}
              onToggle={() =>
                setCollapsedSections(current => ({ ...current, AU: !current.AU }))
              }
            ></Section>
          )}
        </div>
      )}
    </div>
  )
}