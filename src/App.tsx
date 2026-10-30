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
import VendorSortBar from "./components/VendorSortBar"
import SelectionBar from "./components/SelectionBar"
import UninstallDialog from "./components/UninstallDialog"
import SettingsDialog, { type TabId as SettingsTab } from "./components/SettingsDialog"
import { Button } from "./components/ui/button"
import { PackageOpen, SearchX, X } from "lucide-react"
import { Alert, AlertDescription } from "./components/ui/alert"
import BrandMark from "./components/BrandMark"
import EmptyState from "./components/EmptyState"
import Welcome from "./components/Welcome"
import { emptyStateKind } from "./core/emptyState"
import { exportFileName, exportPlugins, type ExportFormat } from "./core/plugin/Export"
import { buildPluginPath } from "./core/plugin/Uninstall"
import { fetchPluginMeta, knownArch, type PluginMeta } from "./core/plugin/Meta"
import { getAppInfo, type AppInfo, type GroupBySetting, type SortSetting, type VendorSortSetting } from "./core/settings/AppSettings"
import { useSettings } from "./core/settings/SettingsContext"
import { useStartupUpdateCheck } from "./core/useStartupUpdateCheck"
import { pushError } from "./core/errorLog"
import { isEditableTarget, shortcutAction } from "./core/shortcuts"
import ShortcutsDialog from "./components/ShortcutsDialog"
import { useI18n } from "./i18n/I18nProvider"
import type { Plugin } from "@/core/plugin/Plugin"
import type { ScanResult } from "./core/plugin/PluginScanner"
import { groupByVendor, UNKNOWN_VENDOR_KEY } from "./core/plugin/Vendor"
import { countByArch, filterByArch, filterDamaged, filterPlugins, findDuplicates, type ArchFilter, pluginKey, sortPlugins, type SortKey, type SortState } from "./core/plugin/ListOps"

type SectionType = "VST2" | "VST3" | "AAX" | "AU" | "CLAP"
const SECTION_ORDER: SectionType[] = ["VST2", "VST3", "AAX", "AU", "CLAP"]
const DEFAULT_SORT: SortState = { key: "name", dir: "asc" }
const DEFAULT_VENDOR_SORT: VendorSortSetting = { key: "name", dir: "asc" }
const EMPTY_RESULT: ScanResult = { all: [], vst2: [], vst3: [], aax: [], au: [], clap: [] }

export default function App() {
  const { t } = useI18n()
  const { settings, loaded, update } = useSettings()
  const platform = useMemo(() => detectPlatform(), [])
  const [home, setHome] = useState("")
  const [scanning, setScanning] = useState(false)
  const [scanned, setScanned] = useState(false)
  const [result, setResult] = useState<ScanResult>(EMPTY_RESULT)
  const [appInfo, setAppInfo] = useState<AppInfo | undefined>(undefined)
  const [showSettings, setShowSettings] = useState(false)
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("general")
  const [collapsed, setCollapsed] = useState<Record<SectionType, boolean>>({ VST2: false, VST3: false, AAX: false, AU: false, CLAP: false })
  const [tab, setTab] = useState<"all" | SectionType>("all")
  const visible = useMemo(
    () => ({ VST2: tab === "all" || tab === "VST2", VST3: tab === "all" || tab === "VST3", AAX: tab === "all" || tab === "AAX", AU: tab === "all" || tab === "AU", CLAP: tab === "all" || tab === "CLAP" }),
    [tab],
  )

  const [queryInput, setQueryInput] = useState("")
  const [query, setQuery] = useState("")
  const [duplicatesOnly, setDuplicatesOnly] = useState(false)
  const [sorts, setSorts] = useState<Record<SectionType, SortState>>({
    VST2: DEFAULT_SORT, VST3: DEFAULT_SORT, AAX: DEFAULT_SORT, AU: DEFAULT_SORT, CLAP: DEFAULT_SORT,
  })
  // Last sort the user picked in any section; saved with the tab when "remember" is on.
  const [viewSort, setViewSort] = useState<SortSetting>(DEFAULT_SORT)
  const [viewReady, setViewReady] = useState(false)
  const [damagedOnly, setDamagedOnly] = useState(false)
  const [archFilter, setArchFilter] = useState<ArchFilter>("all")
  const [sysPaths, setSysPaths] = useState<SystemPaths | null>(null)
  const sysPathsRef = useRef<SystemPaths | null>(null)
  const [meta, setMeta] = useState<ReadonlyMap<string, PluginMeta>>(new Map())
  const metaRun = useRef(0)
  // Producer view: grouping switch, order of the groups, collapsed groups and the metadata the grouping reads.
  const [groupBy, setGroupBy] = useState<GroupBySetting>("format")
  const [vendorSort, setVendorSort] = useState<VendorSortSetting>(DEFAULT_VENDOR_SORT)
  const [collapsedVendors, setCollapsedVendors] = useState<Record<string, boolean>>({})
  const [metaLoading, setMetaLoading] = useState(false)
  const [groupMeta, setGroupMeta] = useState<ReadonlyMap<string, PluginMeta>>(new Map())
  const metaRef = useRef(meta)
  metaRef.current = meta
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
    JSON.stringify([s.customScanPaths, s.customScanDepth, s.disabledSystemPaths, s.scanExclusions])

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
    // Any scan (toolbar, shortcut, welcome button) ends the first-run welcome.
    if (!s.welcomeSeen) update({ welcomeSeen: true })
    setScanning(true)
    try {
      const homePath = await homeDir().then(h => h.replace(/[\\/]+$/, ""), () => "")
      setHome(homePath)
      const scanner = new PluginScanner(
        new TauriOS(),
        getPluginPaths(platform, homePath, await loadSystemPaths()),
        platform,
        s.customScanPaths,
        { customDepth: s.customScanDepth, disabledPaths: s.disabledSystemPaths, exclusions: s.scanExclusions },
      )
      const found = await scanner.search()
      setResult(found)
      setScanned(true)
      // Sizes and dates fill in afterwards; the list is already usable.
      const run = ++metaRun.current
      setMeta(new Map())
      setMetaLoading(true)
      void fetchPluginMeta(
        found.all.map(p => buildPluginPath(p.installPath, p.name)),
        batch => setMeta(prev => {
          const next = new Map(prev)
          for (const m of batch) next.set(m.path, m)
          return next
        }),
        { cancelled: () => metaRun.current !== run },
      ).then(() => {
        if (metaRun.current === run) setMetaLoading(false)
      })
    } catch (e) {
      console.error(e)
      pushError("scan", e)
    } finally {
      setScanning(false)
    }
  }, [platform, loadSystemPaths, update])

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
    // Start on the remembered view, or on the explicit defaults.
    const startTab = settings.rememberView ? settings.lastTab : settings.defaultTab
    const startSort = settings.rememberView ? settings.lastSort : settings.defaultSort
    setTab(startTab)
    setViewSort(startSort)
    setGroupBy(settings.rememberView ? settings.groupBy : "format")
    setVendorSort(settings.rememberView ? settings.vendorSort : DEFAULT_VENDOR_SORT)
    setSorts({ VST2: startSort, VST3: startSort, AAX: startSort, AU: startSort, CLAP: startSort })
    setViewReady(true)
    // On the very first run the welcome screen asks first, even when scanning on startup is on.
    if (settings.scanOnStartup && settings.welcomeSeen) void scanPlugins()
  }, [loaded, settings.scanOnStartup, settings.welcomeSeen, scanPlugins])

  // Remember the last tab and sort (debounced, so quick clicking writes the file once).
  useEffect(() => {
    if (!viewReady || !settings.rememberView) return
    const id = window.setTimeout(() => {
      const cur = settingsRef.current
      if (
        cur.lastTab === tab && cur.lastSort.key === viewSort.key && cur.lastSort.dir === viewSort.dir &&
        cur.groupBy === groupBy && cur.vendorSort.key === vendorSort.key && cur.vendorSort.dir === vendorSort.dir
      ) return
      update({ lastTab: tab, lastSort: viewSort, groupBy, vendorSort })
    }, 800)
    return () => window.clearTimeout(id)
  }, [viewReady, settings.rememberView, tab, viewSort, groupBy, vendorSort, update])

  // Producer grouping reads a throttled copy of the metadata: names arrive batch by batch and the
  // groups must not reshuffle on every one. When loading ends the final state is applied at once.
  useEffect(() => {
    if (!metaLoading) {
      setGroupMeta(meta)
      return
    }
    const id = window.setTimeout(() => setGroupMeta(metaRef.current), 500)
    return () => window.clearTimeout(id)
  }, [meta, metaLoading])

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
    const byType: Record<SectionType, Plugin[]> = { VST2: result.vst2, VST3: result.vst3, AAX: result.aax, AU: result.au, CLAP: result.clap }
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

  const vendorGroups = useMemo(
    () => (groupBy === "vendor" ? groupByVendor(visibleShown, groupMeta, vendorSort, t("vendor.unknown")) : []),
    [groupBy, visibleShown, groupMeta, vendorSort, t],
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

  const toggleSort = (type: SectionType, key: SortKey) => {
    const cur = sorts[type]
    const next: SortState = cur.key === key ? { key, dir: cur.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }
    setSorts(c => ({ ...c, [type]: next }))
    setViewSort(next)
  }

  // Producer mode shares one sort for all groups; the format sections follow it when the user switches back.
  const toggleVendorGroupSort = (key: SortKey) => {
    const next: SortState = viewSort.key === key ? { key, dir: viewSort.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }
    setViewSort(next)
    setSorts({ VST2: next, VST3: next, AAX: next, AU: next, CLAP: next })
  }

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
    setSettingsTab("general")
    if (scanned && lastScanKey.current !== scanKey(settingsRef.current)) void scanPlugins()
  }

  // Folders the first scan will really read: the configured ones that exist on this computer.
  const [existingFolders, setExistingFolders] = useState<number | null>(null)
  const welcomeVisible = !settings.welcomeSeen && !scanned
  const configuredFolders = useMemo(
    () => [...systemPaths.filter(p => !settings.disabledSystemPaths.includes(p)), ...settings.customScanPaths],
    [systemPaths, settings.disabledSystemPaths, settings.customScanPaths],
  )
  useEffect(() => {
    if (!welcomeVisible || configuredFolders.length === 0) return
    let alive = true
    const os = new TauriOS()
    void Promise.all(configuredFolders.map(p => os.pathExists(p).catch(() => false))).then(found => {
      if (alive) setExistingFolders(found.filter(Boolean).length)
    })
    return () => { alive = false }
  }, [welcomeVisible, configuredFolders])

  if (!loaded || scanning) return <UpdatePage />

  const openScanSettings = () => {
    setSettingsTab("scan")
    setShowSettings(true)
  }
  const counts = { VST2: result.vst2.length, VST3: result.vst3.length, AAX: result.aax.length, AU: result.au.length, CLAP: result.clap.length }
  const emptyKind = emptyStateKind({ welcome: !settings.welcomeSeen && !scanned, scanned, counts, tab, shown: visibleShown.length })

  return (
    <div className="flex h-full w-full flex-col">
      <Toolbar
        pluginsCount={result.all.length}
        counts={counts}
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
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
      />

      {showSettings && (
        <SettingsDialog
          platform={platform}
          systemPaths={systemPaths}
          archSummary={archSummary}
          appInfo={appInfo}
          formatCounts={{ VST2: result.vst2.length, VST3: result.vst3.length, AAX: result.aax.length, AU: result.au.length, CLAP: result.clap.length }}
          startupUpdate={startupUpdate}
          initialTab={settingsTab}
          onClose={closeSettings}
        />
      )}

      {emptyKind === "welcome" ? (
        <Welcome
          onScan={() => void scanPlugins()}
          onSettings={openScanSettings}
          folderCount={existingFolders}
        />
      ) : emptyKind === "idle" || emptyKind === "none" ? (
        <EmptyState
          icon={<BrandMark className="size-20 text-foreground/80" />}
          title={emptyKind === "none" ? t("empty.none.title") : t("empty.idle.title")}
          body={emptyKind === "none" ? t("empty.none.body") : t("empty.idle.body")}
        >
          <Button onClick={() => void scanPlugins()}>{t(emptyKind === "none" ? "empty.again" : "empty.scan")}</Button>
          <Button variant="outline" onClick={openScanSettings}>{t("empty.openSettings")}</Button>
        </EmptyState>
      ) : emptyKind === "tab-empty" ? (
        <EmptyState
          icon={<PackageOpen aria-hidden className="size-14 text-foreground/60" strokeWidth={1.25} />}
          title={t("empty.tab.title", { type: tab })}
          body={t("empty.tab.body", { type: tab, count: result.all.length })}
        >
          <Button variant="outline" onClick={() => setTab("all")}>{t("empty.tab.all")}</Button>
        </EmptyState>
      ) : emptyKind === "no-match" ? (
        <EmptyState
          icon={<SearchX aria-hidden className="size-14 text-foreground/60" strokeWidth={1.25} />}
          title={t("list.noResults.title")}
          body={t("list.noResults.body")}
        >
          <Button variant="outline" onClick={clearFilters}>{t("list.noResults.clear")}</Button>
        </EmptyState>
      ) : groupBy === "vendor" ? (
        <>
          <VendorSortBar sort={vendorSort} onChange={setVendorSort} groups={vendorGroups.filter(g => g.key !== UNKNOWN_VENDOR_KEY).length} />
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-24 pt-1">
            {vendorGroups.map(group => (
              <Section
                key={group.key}
                vendor={{ name: group.name, unknown: group.key === UNKNOWN_VENDOR_KEY, reading: metaLoading && group.key === UNKNOWN_VENDOR_KEY }}
                items={sortPlugins(group.plugins, viewSort, meta)}
                total={group.plugins.length}
                sort={viewSort}
                onSort={toggleVendorGroupSort}
                collapsed={!!collapsedVendors[group.key]}
                onToggle={() => setCollapsedVendors(c => ({ ...c, [group.key]: !c[group.key] }))}
                selected={selected}
                onSelectKeys={selectKeys}
                duplicates={duplicates}
                meta={meta}
                home={home}
                onUninstall={plugin => setUninstallTargets([plugin])}
              />
            ))}
          </div>
        </>
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
