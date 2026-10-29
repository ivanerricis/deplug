import type { ThemeSetting } from "./settings/AppSettings"

export type ResolvedTheme = "light" | "dark"

export function resolveTheme(setting: ThemeSetting, systemPrefersDark: boolean): ResolvedTheme {
  if (setting === "system") return systemPrefersDark ? "dark" : "light"
  return setting
}

/** Sets the `dark` class on <html> and keeps following the OS preference while the setting is 'system'. */
export function applyTheme(setting: ThemeSetting, root: HTMLElement = document.documentElement): () => void {
  const media = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)") : null
  const apply = () => {
    const resolved = resolveTheme(setting, media?.matches ?? false)
    root.classList.toggle("dark", resolved === "dark")
    root.style.colorScheme = resolved
  }
  apply()
  if (setting !== "system" || !media) return () => {}
  media.addEventListener("change", apply)
  return () => media.removeEventListener("change", apply)
}
