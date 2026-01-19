import { useEffect, useState } from "react"

import { PluginScanner } from "./core/plugin/PluginScanner"
import UpdatePage from "./LoadingComponent"
import Toolbar from "./components/Toolbar"
import Row from "./components/Row"
import { Plugin } from "@/core/plugin/Plugin";

export default function App() {
  const [loading, setLoading] = useState(true)
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [pluginsVST2, setPluginsVST2] = useState<Plugin[]>([])
  const [pluginsVST3, setPluginsVST3] = useState<Plugin[]>([])
  const [pluginsAAX, setPluginsAAX] = useState<Plugin[]>([])

  const scanPlugins = async () => {
    setLoading(true)
    const scanner = new PluginScanner()

    const found = await scanner.search()
    setPlugins(found)
    plugins.forEach(plugin => {
      if (plugin.type === "VST2")
        pluginsVST2.push(plugin)
      else if (plugin.type === "VST3")
        pluginsVST3.push(plugin)
      else if (plugin.type === "AAX3")
        pluginsAAX.push(plugin)
    });
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
      />

      {plugins.length === 0 ? (
        <p className="shrink-0">Nessun plugin trovato</p>
      ) : (
        <div className="flex flex-col">
          <Row type="VST2" header={{ name: "Name", path: "Path" }}></Row>
          {plugins.map(e => (
            <div className="flex flex-col">
              <Row plugin={e}></Row>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}