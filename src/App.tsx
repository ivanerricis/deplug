import { useEffect, useState } from "react"
import { RowSelectionState } from "@tanstack/react-table"

import { PluginScanner } from "./core/plugin/PluginScanner"
import { Plugin } from "./core/plugin/Plugin"
import UpdatePage from "./LoadingComponent"
import Toolbar from "./components/Toolbar"
import PluginTable from "./components/PluginTable"
import { paths } from "./core/plugin/Path"

export default function App() {
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [loading, setLoading] = useState(true)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const scanPlugins = async () => {
    setLoading(true)
    const scanner = new PluginScanner()

    const found = await scanner.search(paths)
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
      <Toolbar
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