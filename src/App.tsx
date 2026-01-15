import { useEffect, useState } from "react"
import { RowSelectionState } from "@tanstack/react-table"

import { TauriOS } from "./core/os/TauriOS"
import { PluginScanner } from "./core/plugin/PluginScanner"
import { Plugin } from "./core/plugin/Plugin"
import UpdatePage from "./LoadingComponent"
import PluginToolbar from "./components/PluginToolbar"
import PluginTable from "./components/PluginTable"

export default function App() {
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [loading, setLoading] = useState(true)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const scanPlugins = async () => {
    setLoading(true)
    const os = new TauriOS()
    const scanner = new PluginScanner(os)

    const paths = {
      VST2: [
        "C:/Program Files/Common Files/VST2",
        "C:/Program Files/Steinberg/VSTPlugins",
        "C:/Program Files (x86)/Steinberg/VstPlugins"
      ],
      VST3: ["C:/Program Files/Common Files/VST3"],
      AUX: ["C:/Program Files/Common Files/Avid/Audio/Plug-Ins"],
    }

    const found = await scanner.scan(paths)
    setPlugins(found)
    setLoading(false)
  }

  useEffect(() => {
    scanPlugins()
  }, [])

  if (loading) return <UpdatePage />

  const selectedCount = Object.keys(rowSelection).length

  return (
    <div className="w-full h-full p-2 flex flex-col overflow-hidden">
      <PluginToolbar
        pluginsCount={plugins.length}
        selectedCount={selectedCount}
        onRefresh={scanPlugins}
      />

      {plugins.length === 0 ? (
        <p className="shrink-0">Nessun plugin trovato</p>
      ) : (
        <PluginTable
          plugins={plugins}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
        />
      )}
    </div>
  )
}