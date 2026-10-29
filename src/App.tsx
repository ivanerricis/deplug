import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { homeDir } from "@tauri-apps/api/path"
import { PluginScanner } from "./core/plugin/PluginScanner"
import { TauriOS } from "./core/os/TauriOS"
import { detectPlatform, getPluginPaths } from "./core/plugin/Path"
import UpdatePage from "./LoadingComponent"
import Toolbar from "./components/Toolbar"
import Section from "./components/Section"
import SelectionBar from "./components/SelectionBar"
import UninstallDialog from "./components/UninstallDialog"
import SettingsDialog from "./components/SettingsDialog"
import { Button } from "./components/ui/button"
import { getAppInfo, type AppInfo } from "./core/settings/AppSettings"
import { useSettings } from "./core/settings/SettingsContext"
import { useI18n } from "./i18n/I18nProvider"
import type { Plugin } from "@/core/plugin/Plugin"
import type { ScanResult } from "./core/plugin/PluginScanner"
import { filterPlugins, findDuplicates, pluginKey, sortPlugins, type SortKey, type SortState } from "./core/plugin/ListOps"

type SectionType = "VST2" | "VST3" | "AAX" | "AU"
const SECTION_ORDER: SectionType[] = ["VST2", "VST3", "AAX", "AU"]
const DEFAULT_SORT: SortState = { key: "name", dir: "asc" }
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

  const [queryInput, setQueryInput] = useState("")
  const [query, setQuery] = useState("")
  const [duplicatesOnly, setDuplicatesOnly] = useState(false)
  const [sorts, setSorts] = useState<Record<SectionType, SortState>>({
    VST2: DEFAULT_SORT, VST3: DEFAULT_SORT, AAX: DEFAULT_SORT, AU: DEFAULT_SORT,
  })
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [uninstallTargets, setUninstallTargets] = useState<Plugin[] | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

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

  // Debounce the search so typing does not re-filter and re-render the list on every key.
  useEffect(() => {
    const id = window.setTimeout(() => setQuery(queryInput), 200)
    return () => window.clearTimeout(id)
  }, [queryInput])

  const duplicates = useMemo(() => findDuplicates(result.all), [result.all])

  const view = useMemo(() => {
    const byType: Record<SectionType, Plugin[]> = { VST2: result.vst2, VST3: result.vst3, AAX: result.aax, AU: result.au }
    const out = {} as Record<SectionType, { shown: Plugin[]; total: number }>
    for (const type of SECTION_ORDER) {
      let list = filterPlugins(byType[type], query)
      if (duplicatesOnly) list = list.filter(p => duplicates.has(pluginKey(p)))
      out[type] = { shown: sortPlugins(list, sorts[type]), total: byType[type].length }
    }
    return out
  }, [result, query, duplicatesOnly, duplicates, sorts])

  const visibleShown = useMemo(
    () => SECTION_ORDER.filter(type => visible[type]).flatMap(type => view[type].shown),
    [view, visible],
  )

  // Only plugins that are on screen can stay selected, so "N selected" is always what Uninstall acts on.
  useEffect(() => {
    setSelected(prev => {
      if (prev.size === 0) return prev
      const shownKeys = new Set(visibleShown.map(pluginKey))
      const next = new Set([...prev].filter(k => shownKeys.has(k)))
      return next.size === prev.size ? prev : next
    })
  }, [visibleShown])

  const selectedPlugins = useMemo(
    () => visibleShown.filter(p => selected.has(pluginKey(p))),
    [visibleShown, selected],
  )

  const selectKeys = useCallback((keys: string[], select: boolean) => {
    setSelected(prev => {
      const next = new Set(prev)
      for (const k of keys) {
        if (select) next.add(k)
        else next.delete(k)
      }
      return next
    })
  }, [])

  const toggleSort = (type: SectionType, key: SortKey) =>
    setSorts(c => {
      const cur = c[type]
      const next: SortState = cur.key === key ? { key, dir: cur.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }
      return { ...c, [type]: next }
    })

  const clearFilters = () => {
    setQueryInput("")
    setQuery("")
    setDuplicatesOnly(false)
    setVisible({ VST2: true, VST3: true, AAX: true, AU: true })
  }

  // Ctrl/Cmd+F focuses the search field; Esc clears the search, then the selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "f") {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
        return
      }
      if (e.key !== "Escape" || e.defaultPrevented) return
      if (document.querySelector('[role="dialog"]')) return
      if (document.activeElement === searchRef.current && queryInput !== "") {
        setQueryInput("")
        setQuery("")
        return
      }
      if (selected.size > 0) setSelected(new Set())
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [queryInput, selected])

  const closeUninstall = (removedAny: boolean) => {
    setUninstallTargets(null)
    if (removedAny) {
      setSelected(new Set())
      void scanPlugins()
    }
  }

  const closeSettings = () => {
    setShowSettings(false)
    if (scanned && lastScanKey.current !== scanKey(settingsRef.current)) void scanPlugins()
  }

  if (!loaded || scanning) return <UpdatePage />

  const noResults = result.all.length > 0 && visibleShown.length === 0

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
        query={queryInput}
        onQueryChange={setQueryInput}
        searchRef={searchRef}
        duplicatesOnly={duplicatesOnly}
        onToggleDuplicatesOnly={setDuplicatesOnly}
        duplicateCount={duplicates.size}
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
      ) : noResults ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="max-w-md">
            <h1 className="text-lg font-semibold">{t("list.noResults.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("list.noResults.body")}</p>
          </div>
          <Button variant="outline" onClick={clearFilters}>{t("list.noResults.clear")}</Button>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          {SECTION_ORDER.filter(type => visible[type]).map(type => (
            <Section
              key={type}
              type={type}
              items={view[type].shown}
              total={view[type].total}
              sort={sorts[type]}
              onSort={key => toggleSort(type, key)}
              collapsed={collapsed[type]}
              onToggle={() => setCollapsed(c => ({ ...c, [type]: !c[type] }))}
              selected={selected}
              onSelectKeys={selectKeys}
              duplicates={duplicates}
              onUninstall={plugin => setUninstallTargets([plugin])}
            />
          ))}
        </div>
      )}

      {selectedPlugins.length > 0 && (
        <SelectionBar
          count={selectedPlugins.length}
          onUninstall={() => setUninstallTargets(selectedPlugins)}
          onClear={() => setSelected(new Set())}
        />
      )}

      {uninstallTargets && <UninstallDialog plugins={uninstallTargets} onClose={closeUninstall} />}
    </div>
  )
}
