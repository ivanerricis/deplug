import { invoke } from "@tauri-apps/api/core"

export type AppSettings = {
  version: number
  customScanPaths: string[]
}

export type AppInfo = {
  portable: boolean
  dataDir: string | null
  portableWarning: string | null
}

export function getSettings(): Promise<AppSettings> {
  return invoke<AppSettings>("get_settings")
}

export function saveCustomPaths(paths: string[]): Promise<void> {
  return invoke<void>("save_custom_paths", { paths })
}

export function getAppInfo(): Promise<AppInfo> {
  return invoke<AppInfo>("app_info")
}
