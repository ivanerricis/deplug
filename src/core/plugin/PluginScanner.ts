import { OSApi } from "../os/OSApi"
import { createExcludeMatcher } from "./Exclude"
import { Plugin, PluginType } from "./Plugin"

const MAX_DEPTH = 3
const CUSTOM_MAX_DEPTH = 6

export interface ScannerOptions {
  /** Max folder depth for manually added folders. */
  customDepth?: number
  /** Built-in system folders the user switched off. */
  disabledPaths?: string[]
  /** Name patterns (see Exclude.ts) for plugins and folders to skip. */
  exclusions?: string[]
}

export interface ScanResult {
  all: Plugin[]
  vst2: Plugin[]
  vst3: Plugin[]
  aax: Plugin[]
  au: Plugin[]
  clap: Plugin[]
}

export function pluginTypeOf(name: string, platform: string): PluginType | null {
  const lower = name.toLowerCase()
  if (lower.endsWith(".vst3")) return "VST3"
  if (lower.endsWith(".aaxplugin")) return "AAX"
  if (lower.endsWith(".clap")) return "CLAP"
  if (lower.endsWith(".component") && platform === "macos") return "AU"
  if (lower.endsWith(".dll") && platform === "windows") return "VST2"
  if (lower.endsWith(".vst") && platform === "macos") return "VST2"
  if (lower.endsWith(".so") && platform === "linux") return "VST2"
  return null
}

export class PluginScanner {
  constructor(
    private os: OSApi,
    private paths: string[],
    private platform: string,
    private customPaths: string[] = [],
    private options: ScannerOptions = {},
  ) {
    this.isExcluded = createExcludeMatcher(options.exclusions)
  }

  private isExcluded: (name: string) => boolean

  async search(): Promise<ScanResult> {
    const result: ScanResult = { all: [], vst2: [], vst3: [], aax: [], au: [], clap: [] }
    const seen = new Set<string>()

    const disabled = new Set(this.options.disabledPaths ?? [])
    const customDepth = this.options.customDepth ?? CUSTOM_MAX_DEPTH
    const roots = [
      ...this.paths.filter(path => !disabled.has(path)).map(path => ({ path, depth: MAX_DEPTH })),
      // manually installed plugins can live anywhere, so dig deeper
      ...this.customPaths.map(path => ({ path, depth: customDepth })),
    ]
    for (const { path: root, depth: maxDepth } of roots) {
      if (!(await this.os.pathExists(root).catch(() => false))) continue
      for (const plugin of await this.scanDir(root, 0, maxDepth)) {
        const key = `${plugin.installPath}/${plugin.name}`
        if (seen.has(key)) continue
        seen.add(key)
        result.all.push(plugin)
        if (plugin.type === "VST2") result.vst2.push(plugin)
        else if (plugin.type === "VST3") result.vst3.push(plugin)
        else if (plugin.type === "AAX") result.aax.push(plugin)
        else if (plugin.type === "CLAP") result.clap.push(plugin)
        else result.au.push(plugin)
      }
    }
    return result
  }

  private async scanDir(dir: string, depth: number, maxDepth: number): Promise<Plugin[]> {
    let entries
    try {
      entries = await this.os.readDir(dir)
    } catch {
      return []
    }

    const found: Plugin[] = []
    for (const entry of entries) {
      if (this.isExcluded(entry.name)) continue
      const type = pluginTypeOf(entry.name, this.platform)
      if (type) {
        // plugin bundles are directories too: report them, don't descend
        found.push({ name: entry.name, installPath: dir, type })
      } else if (entry.isDirectory && depth < maxDepth) {
        found.push(...(await this.scanDir(entry.path, depth + 1, maxDepth)))
      }
    }
    return found
  }
}
