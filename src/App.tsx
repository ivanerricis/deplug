import { useEffect, useState } from "react"

import { PluginScanner } from "./core/plugin/PluginScanner"
import UpdatePage from "./LoadingComponent"
import Toolbar from "./components/Toolbar"
import { Plugin } from "@/core/plugin/Plugin";
import Section from "./components/Section"

export default function App() {
  const [loading, setLoading] = useState(true)
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [pluginsVST2, setPluginsVST2] = useState<Plugin[]>([])
  const [pluginsVST3, setPluginsVST3] = useState<Plugin[]>([])
  const [pluginsAAX, setPluginsAAX] = useState<Plugin[]>([])
  const [collapsedSections, setCollapsedSections] = useState({
    VST2: false,
    VST3: false,
    AAX: false,
  })
  const [visibleSections, setVisibleSections] = useState({
    VST2: true,
    VST3: true,
    AAX: true,
  })

  const scanPlugins = async () => {
    setLoading(true)
    const scanner = new PluginScanner()

    const found = await scanner.search()
    setPlugins(found.all)
    setPluginsVST2(found.vst2)
    setPluginsVST3(found.vst3)
    setPluginsAAX(found.aax)
    setLoading(false)
  }

  useEffect(() => {
    scanPlugins()
  }, [])

  if (loading) return <UpdatePage />

  return (
    <div className="w-full h-full p-2 flex flex-col">
      <Toolbar
        pluginsCount={plugins.length}
        onRefresh={scanPlugins}
        showVST2={visibleSections.VST2}
        showVST3={visibleSections.VST3}
        showAAX={visibleSections.AAX}
        onToggleVST2={(value) => setVisibleSections(current => ({ ...current, VST2: value }))}
        onToggleVST3={(value) => setVisibleSections(current => ({ ...current, VST3: value }))}
        onToggleAAX={(value) => setVisibleSections(current => ({ ...current, AAX: value }))}
      />

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
        </div>
      )}
    </div>
  )
}