const KEY = "customScanPaths"

export function loadCustomPaths(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]")
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === "string") : []
  } catch {
    return []
  }
}

export function saveCustomPaths(paths: string[]): void {
  localStorage.setItem(KEY, JSON.stringify(paths))
}
