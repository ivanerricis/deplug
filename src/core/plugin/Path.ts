export type Platform = "windows" | "macos" | "linux"

export function detectPlatform(userAgent: string = navigator.userAgent): Platform {
  if (/windows/i.test(userAgent)) return "windows"
  if (/mac/i.test(userAgent)) return "macos"
  return "linux"
}

/** Windows known-folder roots reported by the backend's `system_paths` command (all null elsewhere). */
export interface SystemPaths {
  programFiles: string | null
  programFilesX86: string | null
  commonProgramFiles: string | null
  commonProgramFilesX86: string | null
  programData: string | null
  localAppData: string | null
}

const WINDOWS_DEFAULTS = {
  programFiles: "C:/Program Files",
  programFilesX86: "C:/Program Files (x86)",
  commonProgramFiles: "C:/Program Files/Common Files",
  commonProgramFilesX86: "C:/Program Files (x86)/Common Files",
} as const

/** Forward slashes and no trailing separator, so the same folder always has the same spelling. */
function normalizeRoot(p: string): string {
  return p.replace(/\\/g, "/").replace(/\/+$/, "")
}

function dedupe(paths: string[]): string[] {
  const seen = new Set<string>()
  return paths.filter(p => {
    const k = p.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

function windowsPaths(sys?: Partial<SystemPaths> | null): string[] {
  const root = (value: string | null | undefined, fallback: string) => normalizeRoot(value || fallback)
  const pf = root(sys?.programFiles, WINDOWS_DEFAULTS.programFiles)
  const pf86 = root(sys?.programFilesX86, WINDOWS_DEFAULTS.programFilesX86)
  const cpf = root(sys?.commonProgramFiles, WINDOWS_DEFAULTS.commonProgramFiles)
  const cpf86 = root(sys?.commonProgramFilesX86, WINDOWS_DEFAULTS.commonProgramFilesX86)
  const list = [
    // VST2
    `${pf}/VstPlugins`,
    `${pf86}/VstPlugins`,
    `${cpf}/VST2`,
    `${cpf86}/VST2`,
    `${pf}/Steinberg/VSTPlugins`,
    `${pf86}/Steinberg/VstPlugins`,
    // VST3
    `${cpf}/VST3`,
    `${cpf86}/VST3`,
    // AAX
    `${cpf}/Avid/Audio/Plug-Ins`,
    `${cpf86}/Avid/Audio/Plug-Ins`,
    // CLAP
    `${cpf}/CLAP`,
    `${cpf86}/CLAP`,
  ]
  // User-level VST3 and CLAP install locations.
  if (sys?.localAppData) {
    const local = normalizeRoot(sys.localAppData)
    list.push(`${local}/Programs/Common/VST3`, `${local}/Programs/Common/CLAP`)
  }
  return dedupe(list)
}

/**
 * Built-in folders to scan. On Windows the roots come from the backend (`system_paths`) so
 * localized or relocated Program Files are honoured; without them the C:/ defaults apply.
 */
export function getPluginPaths(platform: Platform, home: string, sys?: Partial<SystemPaths> | null): string[] {
  switch (platform) {
    case "windows":
      return windowsPaths(sys)
    case "macos":
      return [
        "/Library/Audio/Plug-Ins/VST",
        "/Library/Audio/Plug-Ins/VST3",
        "/Library/Audio/Plug-Ins/Components",
        "/Library/Audio/Plug-Ins/CLAP",
        "/Library/Application Support/Avid/Audio/Plug-Ins",
        `${home}/Library/Audio/Plug-Ins/VST`,
        `${home}/Library/Audio/Plug-Ins/VST3`,
        `${home}/Library/Audio/Plug-Ins/Components`,
        `${home}/Library/Audio/Plug-Ins/CLAP`,
        `${home}/Library/Application Support/Avid/Audio/Plug-Ins`,
      ]
    case "linux":
      return [
        "/usr/lib/vst",
        "/usr/local/lib/vst",
        `${home}/.vst`,
        "/usr/lib/vst3",
        "/usr/local/lib/vst3",
        `${home}/.vst3`,
        "/usr/lib/clap",
        `${home}/.clap`,
      ]
  }
}

export function osLabel(platform: Platform): string {
  return platform === "windows" ? "Windows" : platform === "macos" ? "macOS" : "Linux"
}
