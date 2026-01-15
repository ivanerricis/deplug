import { OSApi } from "../os/OSApi"
import { Plugin } from "./Plugin"

export class PluginScanner {
  constructor(private os: OSApi) {}

  async scan(pathsByType: Record<string, string[]>): Promise<Plugin[]> {
    const result: Plugin[] = []

    for (const [type, paths] of Object.entries(pathsByType)) {
      for (const basePath of paths) {
        if (!(await this.os.pathExists(basePath))) continue

        // Per VST2, scansiona ricorsivamente le sottocartelle
        if (type === 'VST2') {
          await this.scanRecursive(basePath, type, result)
        } else {
          const entries = await this.os.readDir(basePath)

          for (const e of entries) {
            if (!e.isDirectory) continue

            result.push({
              name: e.name,
              installPath: e.path,
              type
            })
          }
        }
      }
    }

    return result
  }

  private async scanRecursive(
    basePath: string, 
    type: string, 
    result: Plugin[]
  ): Promise<void> {
    const entries = await this.os.readDir(basePath)

    for (const e of entries) {
      if (!e.isDirectory) continue

      result.push({
        name: e.name,
        installPath: e.path,
        type
      })

      // Scansiona ricorsivamente le sottocartelle
      await this.scanRecursive(e.path, type, result)
    }
  }
}