import { OSApi, DirEntry } from "./OSApi"
import { readDir, exists } from "@tauri-apps/plugin-fs"

export class TauriOS implements OSApi {
  async readDir(path: string): Promise<DirEntry[]> {
    const entries = await readDir(path)
    return entries.map(e => ({
      name: e.name,
      path: `${path}/${e.name}`,
      isDirectory: e.isDirectory
    }))
  }

  async pathExists(path: string): Promise<boolean> {
    return exists(path)
  }
}