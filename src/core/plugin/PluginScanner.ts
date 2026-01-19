import { DirEntry, readDir } from "@tauri-apps/plugin-fs"
import { Plugin } from "./Plugin"
import { paths } from "./Path"

export class PluginScanner {
  

  async search(): Promise<Plugin[]> {
    const result: Plugin[] = []
    for (const path of paths) {
      const entries = await readDir(path)
      for (const e of entries) {
        const plugin: Plugin = await this.scanPath(e, path)
        if (plugin.name !== "")
          result.push(plugin)
      }
    }
    return result
  }

  async scanPath(entry: DirEntry, path: string): Promise<Plugin> {
    let result: Plugin = {name: "", installPath: "", type: ""}

    if (entry.name.includes("dll"))
      return result = { name: entry.name, installPath: path, type: "VST2" }
    else if (entry.name.includes("vst3"))
      return result = { name: entry.name, installPath: path, type: "VST3" }
    else if (entry.name.includes("aax"))
      return result = { name: entry.name, installPath: path, type: "AAX" }
    else if (entry.isDirectory) {
      this.scanPath(entry, path)
    }
    return result
  }
}