import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { invoke } from "@tauri-apps/api/core"
import { save } from "@tauri-apps/plugin-dialog"
import { writeTextFile } from "@tauri-apps/plugin-fs"
import { homeDir } from "@tauri-apps/api/path"
import { PluginScanner } from "./core/plugin/PluginScanner"
import { TauriOS } from "./core/os/TauriOS"
import { detectPlatform, getPluginPaths, type SystemPaths } from "./core/plugin/Path"
import UpdatePage from "./LoadingComponent"
import Toolbar from "./components/Toolbar"
import Section from "./components/Section"
import SelectionBar from "./components/SelectionBar"
import UninstallDialog from "./components/UninstallDialog"
import SettingsDialog from "./components/SettingsDialog"
import { Button } from "./components/ui/button"
import { X } from "lucide-react"
import { Alert, AlertDescription } from "./components/ui/alert"
import BrandMark from "./components/BrandMark"
import { exportFileName, exportPlugins, type ExportFormat } from "./core/plugin/Export"
import { buildPluginPath } from "./core/plugin/Uninstall"
import { fetchPluginMeta, knownArch, type PluginMeta } from "./core/plugin/Meta"
import { getAppInfo, type AppInfo } from "./core/settings/AppSettings"
import { useSettings } from "./core/settings/SettingsContext"
import { useStartupUpdateCheck } from "./core/useStartupUpdateCheck"
import { pushError } from "./core/errorLog"
import { isEditableTarget, shortcutAction } from "./core/shortcuts"
import ShortcutsDialog from "./components/ShortcutsDialog"
import { useI18n } from "./i18n/I18nProvider"
import type { Plugin } from "@/core/plugin/Plugin"
import type { ScanResult } from "./core/plugin/PluginScanner"
import { countByArch, filterByArch, filterDamaged, filterPlugins, findDuplicates, type ArchFilter, pluginKey, sortPlugins, type SortKey, type SortState } from "./core/plugin/ListOps"

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
  const [tab, setTab] = useState<"all" | SectionType>("all")
  const visible = useMemo(
    () => ({ VST2: tab === "all" || tab === "VST2", VST3: tab === "all" || tab === "VST3", AAX: tab === "all" || tab === "AAX", AU: tab === "all" || tab === "AU" }),
    [tab],
  )

  const [queryInput, setQueryInput] = useState("")
  const [query, setQuery] = useState("")
  const [duplicatesOnly, setDuplicatesOnly] = useState(false)
  const [sorts, setSorts] = useState<Record<SectionType, SortState>>({
    VST2: DEFAULT_SORT, VST3: DEFAULT_SORT, AAX: DEFAULT_SORT, AU: DEFAULT_SORT,
  })
  const [damagedOnly, setDamagedOnly] = useState(false)
  const [archFilter, setArchFilter] = useState<ArchFilter>("all")
  const [sysPaths, setSysPaths] = useState<SystemPaths | null>(null)
  const sysPathsRef = useRef<SystemPaths | null>(null)
  const [meta, setMeta] = useState<ReadonlyMap<string, PluginMeta>>(new Map())
  const metaRun = useRef(0)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [uninstallTargets, setUninstallTargets] = useState<Plugin[] | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [exportOpenSignal, setExportOpenSignal] = useState(0)

  const systemPaths = useMemo(() => getPluginPaths(platform, home, sysPaths), [platform, home, sysPaths])
  // What the last scan used, so closing settings only rescans when it would change the list.
  const lastScanKey = useRef<string>("")
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  const scanKey = (s: typeof settings) =>
    JSON.stringify([s.customScanPaths, s.customScanDepth, s.disabledSystemPaths])

  // Windows known folders from the backend; null (dev mode, other OS) falls back to the C:/ defaults.
  const loadSystemPaths = useCallback(async () => {
    if (sysPathsRef.current) return sysPathsRef.current
    try {
      const sys = await invoke<SystemPaths>("system_paths")
      sysPathsRef.current = sys ?? null
      setSysPaths(sys ?? null)
    } catch {
      // Keep the defaults.
    }
    return sysPathsRef.current
  }, [])

  const scanPlugins = useCallback(async () => {
    const s = settingsRef.current
    lastScanKey.current = scanKey(s)
    setScanning(true)
    try {
      const homePath = await homeDir().then(h => h.replace(/[\\/]+$/, ""), () => "")
      setHome(homePath)
      const scanner = new PluginScanner(
        new TauriOS(),
        getPluginPaths(platform, homePath, await loadSystemPaths()),
        platform,
        s.customScanPaths,
        { customDepth: s.customScanDepth, disabledPaths: s.disabledSystemPaths },
      )
      const found = await scanner.search()
      setResult(found)
      setScanned(true)
      // Sizes and dates fill in afterwards; the list is already usable.
      const run = ++metaRun.current
      setMeta(new Map())
      void fetchPluginMeta(
        found.all.map(p => buildPluginPath(p.installPath, p.name)),
        batch => setMeta(prev => {
          const next = new Map(prev)
          for (const m of batch) next.set(m.path, m)
          return next
        }),
        { cancelled: () => metaRun.current !== run },
      )
    } catch (e) {
      console.error(e)
      pushError("scan", e)
    } finally {
      setScanning(false)
    }
  }, [platform, loadSystemPaths])

  useEffect(() => {
    void loadSystemPaths()
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
  const damagedCount = useMemo(() => filterDamaged(result.all, meta).length, [result.all, meta])
  const archCounts = useMemo(() => countByArch(result.all, meta), [result.all, meta])
  const archAvailable = useMemo(
    () => result.all.some(p => knownArch(meta.get(buildPluginPath(p.installPath, p.name))) !== null),
    [result.all, meta],
  )
  // Plugin count per detected architecture, for the diagnostics text.
  const archSummary = useMemo(() => {
    const counts: Partial<Record<NonNullable<PluginMeta["arch"]>, number>> = {}
    for (const p of result.all) {
      const a = knownArch(meta.get(buildPluginPath(p.installPath, p.name)))
      if (a) counts[a] = (counts[a] ?? 0) + 1
    }
    return counts
  }, [result.all, meta])

  const view = useMemo(() => {
    const byType: Record<SectionType, Plugin[]> = { VST2: result.vst2, VST3: result.vst3, AAX: result.aax, AU: result.au }
    const out = {} as Record<SectionType, { shown: Plugin[]; total: number }>
    for (const type of SECTION_ORDER) {
      let list = filterPlugins(byType[type], query)
      if (duplicatesOnly) list = list.filter(p => duplicates.has(pluginKey(p)))
      if (damagedOnly) list = filterDamaged(list, meta)
      list = filterByArch(list, archFilter, meta)
      out[type] = { shown: sortPlugins(list, sorts[type], meta), total: byType[type].length }
    }
    return out
  }, [result, query, duplicatesOnly, damagedOnly, archFilter, duplicates, sorts, meta])

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

  const exportList = selectedPlugins.length > 0 ? selectedPlugins : visibleShown
  const [exportStatus, setExportStatus] = useState<{ ok: boolean; text: string } | null>(null)
  useEffect(() => {
    if (!exportStatus?.ok) return
    const id = window.setTimeout(() => setExportStatus(null), 6000)
    return () => window.clearTimeout(id)
  }, [exportStatus])

  const runExport = async (format: ExportFormat) => {
    try {
      const path = await save({
        defaultPath: exportFileName(format),
        filters: [{ name: t(format === "csv" ? "export.filterCsv" : "export.filterTxt"), extensions: [format] }],
      })
      if (!path) return // cancelled
      await writeTextFile(path, exportPlugins(format, exportList, meta))
      setExportStatus({ ok: true, text: t("export.done", { count: exportList.length, path }) })
    } catch (e) {
      pushError("export", e)
      setExportStatus({ ok: false, text: t("export.failed", { error: e instanceof Error ? e.message : String(e) }) })
    }
  }

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
    setDamagedOnly(false)
    setArchFilter("all")
  }

  const startupUpdate = useStartupUpdateCheck(loaded && !scanning && (scanned || !settings.scanOnStartup))

  // Keyboard shortcuts (see core/shortcuts.ts); Esc clears the search, then the selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const action = shortcutAction(e, {
        inInput: isEditableTarget(document.activeElement),
        modalOpen: !!document.querySelector('[role="dialog"], [role="menu"]'),
        hasSelection: selectedPlugins.length > 0,
        scanning,
      })
      if (action) {
        e.preventDefault()
        switch (action) {
          case "focus-search":
            searchRef.current?.focus()
            searchRef.current?.select()
            break
          case "select-all":
            selectKeys(visibleShown.map(pluginKey), true)
            break
          case "uninstall-selected":
            setUninstallTargets(selectedPlugins)
            break
          case "open-export":
            if (exportList.length > 0) setExportOpenSignal(n => n + 1)
            break
          case "open-settings":
            setShowSettings(true)
            break
          case "rescan":
            void scanPlugins()
            break
          case "open-shortcuts":
            setShowShortcuts(true)
            break
        }
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
  }, [queryInput, selected, selectedPlugins, visibleShown, exportList.length, scanning, selectKeys, scanPlugins])

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
    <div className="flex h-full w-full flex-col">
      <Toolbar
        pluginsCount={result.all.length}
        counts={{ VST2: result.vst2.length, VST3: result.vst3.length, AAX: result.aax.length, AU: result.au.length }}
        tab={tab}
        onTabChange={setTab}
        onRefresh={() => void scanPlugins()}
        onSettings={() => setShowSettings(true)}
        query={queryInput}
        onQueryChange={setQueryInput}
        searchRef={searchRef}
        duplicatesOnly={duplicatesOnly}
        onToggleDuplicatesOnly={setDuplicatesOnly}
        duplicateCount={duplicates.size}
        damagedOnly={damagedOnly}
        onToggleDamagedOnly={setDamagedOnly}
        damagedCount={damagedCount}
        archFilter={archFilter}
        onArchFilterChange={setArchFilter}
        archCounts={archCounts}
        archAvailable={archAvailable}
        exportCount={exportList.length}
        exportSelection={selectedPlugins.length > 0}
        onExport={format => void runExport(format)}
        exportOpenSignal={exportOpenSignal}
        updateAvailable={startupUpdate !== null}
      />

      {showSettings && (
        <SettingsDialog
          platform={platform}
          systemPaths={systemPaths}
          archSummary={archSummary}
          appInfo={appInfo}
          formatCounts={{ VST2: result.vst2.length, VST3: result.vst3.length, AAX: result.aax.length, AU: result.au.length }}
          startupUpdate={startupUpdate}
          onClose={closeSettings}
        />
      )}

      {result.all.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
          <BrandMark className="size-20 text-foreground/80" />
          <div className="max-w-md">
            <h1 className="text-lg font-semibold">{scanned ? t("empty.none.title") : t("empty.idle.title")}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {scanned ? t("empty.none.body") : t("empty.idle.body")}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => void scanPlugins()}>{t("empty.scan")}</Button>
            <Button variant="outline" onClick={() => setShowSettings(true)}>{t("empty.openSettings")}</Button>
          </div>
        </div>
      ) : noResults ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
          <BrandMark className="size-14 text-foreground/60" accent={false} />
          <div className="max-w-md">
            <h1 className="text-lg font-semibold">{t("list.noResults.title")}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{t("list.noResults.body")}</p>
          </div>
          <Button variant="outline" onClick={clearFilters}>{t("list.noResults.clear")}</Button>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-24 pt-1">
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
              meta={meta}
              home={home}
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

      {exportStatus && (
        <Alert
          variant={exportStatus.ok ? "default" : "destructive"}
          className="fixed bottom-4 left-1/2 z-50 w-[min(32rem,calc(100%-2rem))] -translate-x-1/2 p-3 shadow-lg"
        >
          <AlertDescription className="flex items-start gap-2">
            <span className="min-w-0 flex-1 break-words">{exportStatus.text}</span>
            <Button variant="ghost" size="icon-sm" className="-my-1 -mr-1 size-6" onClick={() => setExportStatus(null)} aria-label={t("export.dismiss")}>
              <X aria-hidden />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {showShortcuts && <ShortcutsDialog onClose={() => setShowShortcuts(false)} />}

      {uninstallTargets && <UninstallDialog plugins={uninstallTargets} meta={meta} onClose={closeUninstall} elevated={appInfo?.elevated ?? false} />}
    </div>
  )
}
