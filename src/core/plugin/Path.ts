export type Platform = "windows" | "macos" | "linux"

export function detectPlatform(userAgent: string = navigator.userAgent): Platform {
  if (/windows/i.test(userAgent)) return "windows"
  if (/mac/i.test(userAgent)) return "macos"
  return "linux"
}

export function getPluginPaths(platform: Platform, home: string): string[] {
  switch (platform) {
    case "windows":
      return [
        "C:/Program Files/Common Files/VST2",
        "C:/Program Files/Steinberg/VSTPlugins",
        "C:/Program Files (x86)/Steinberg/VstPlugins",
        "C:/Program Files/Common Files/VST3",
        "C:/Program Files/Common Files/Avid/Audio/Plug-Ins",
      ]
    case "macos":
      return [
        "/Library/Audio/Plug-Ins/VST",
        "/Library/Audio/Plug-Ins/VST3",
        "/Library/Application Support/Avid/Audio/Plug-Ins",
        `${home}/Library/Audio/Plug-Ins/VST`,
        `${home}/Library/Audio/Plug-Ins/VST3`,
      ]
    case "linux":
      return [
        "/usr/lib/vst",
        "/usr/local/lib/vst",
        `${home}/.vst`,
        "/usr/lib/vst3",
        "/usr/local/lib/vst3",
        `${home}/.vst3`,
      ]
  }
}
