import * as settings from "../settings/AppSettings"

const KEY = "customScanPaths"

export type CustomPathsBackend = {
  getSettings: () => Promise<{ customScanPaths: string[] }>
  saveCustomPaths: (paths: string[]) => Promise<void>
}

export type CustomPathsStorage = {
  getItem: (key: string) => string | null
  removeItem: (key: string) => void
}

export type CustomPathsDeps = {
  backend: CustomPathsBackend
  storage: CustomPathsStorage | undefined
}

const defaultDeps = (): CustomPathsDeps => ({
  backend: settings,
  storage: typeof localStorage === "undefined" ? undefined : localStorage,
})

const onlyStrings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((p): p is string => typeof p === "string") : []

function readLegacy(storage: CustomPathsStorage | undefined): string[] {
  try {
    const raw = storage?.getItem(KEY)
    return raw ? onlyStrings(JSON.parse(raw)) : []
  } catch {
    return []
  }
}

export async function loadCustomPaths(deps: CustomPathsDeps = defaultDeps()): Promise<string[]> {
  const { backend, storage } = deps
  const stored = onlyStrings((await backend.getSettings()).customScanPaths)
  if (stored.length > 0) return stored

  const legacy = readLegacy(storage)
  if (legacy.length === 0) return []

  await backend.saveCustomPaths(legacy)
  try {
    storage?.removeItem(KEY)
  } catch {
    // ignore
  }
  return legacy
}

export function saveCustomPaths(paths: string[], deps: Pick<CustomPathsDeps, "backend"> = defaultDeps()): Promise<void> {
  return deps.backend.saveCustomPaths(paths)
}
