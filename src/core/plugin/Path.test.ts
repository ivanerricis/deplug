import { describe, expect, it } from "vitest"
import { getPluginPaths, type SystemPaths } from "./Path"

const sys: SystemPaths = {
  programFiles: "D:\\Programmi",
  programFilesX86: "D:\\Programmi (x86)",
  commonProgramFiles: "D:\\Programmi\\File comuni",
  commonProgramFilesX86: "D:\\Programmi (x86)\\File comuni",
  programData: "C:\\ProgramData",
  localAppData: "C:\\Users\\me\\AppData\\Local",
}

describe("getPluginPaths (windows)", () => {
  it("falls back to the C:/ defaults without system paths", () => {
    for (const s of [undefined, null, {}]) {
      const paths = getPluginPaths("windows", "", s)
      expect(paths).toContain("C:/Program Files/VstPlugins")
      expect(paths).toContain("C:/Program Files (x86)/Common Files/VST3")
      expect(paths).toContain("C:/Program Files (x86)/Common Files/Avid/Audio/Plug-Ins")
      expect(paths.some(p => p.includes("AppData"))).toBe(false)
    }
  })

  it("derives every folder from the reported roots, with forward slashes", () => {
    const paths = getPluginPaths("windows", "", sys)
    expect(paths).toEqual([
      "D:/Programmi/VstPlugins",
      "D:/Programmi (x86)/VstPlugins",
      "D:/Programmi/File comuni/VST2",
      "D:/Programmi (x86)/File comuni/VST2",
      "D:/Programmi/Steinberg/VSTPlugins",
      "D:/Programmi (x86)/Steinberg/VstPlugins",
      "D:/Programmi/File comuni/VST3",
      "D:/Programmi (x86)/File comuni/VST3",
      "D:/Programmi/File comuni/Avid/Audio/Plug-Ins",
      "D:/Programmi (x86)/File comuni/Avid/Audio/Plug-Ins",
      "D:/Programmi/File comuni/CLAP",
      "D:/Programmi (x86)/File comuni/CLAP",
      "C:/Users/me/AppData/Local/Programs/Common/VST3",
      "C:/Users/me/AppData/Local/Programs/Common/CLAP",
    ])
  })

  it("de-duplicates when the roots coincide (32-bit Windows)", () => {
    const same = { ...sys, programFilesX86: sys.programFiles, commonProgramFilesX86: sys.commonProgramFiles }
    const paths = getPluginPaths("windows", "", same)
    expect(new Set(paths.map(p => p.toLowerCase())).size).toBe(paths.length)
    // Steinberg/VSTPlugins and Steinberg/VstPlugins are the same folder on Windows (case-insensitive).
    expect(paths.filter(p => p.toLowerCase().endsWith("steinberg/vstplugins"))).toHaveLength(1)
  })

  it("tolerates trailing separators", () => {
    const paths = getPluginPaths("windows", "", { ...sys, programFiles: "D:\\Programmi\\" })
    expect(paths[0]).toBe("D:/Programmi/VstPlugins")
  })
})

describe("getPluginPaths (other platforms)", () => {
  it("ignores system paths on macOS and includes the per-user Avid folder", () => {
    const paths = getPluginPaths("macos", "/Users/me", sys)
    expect(paths).toContain("/Library/Audio/Plug-Ins/VST3")
    expect(paths).toContain("/Users/me/Library/Application Support/Avid/Audio/Plug-Ins")
  })
  it("keeps the Linux list", () => {
    expect(getPluginPaths("linux", "/home/me")).toContain("/home/me/.vst3")
  })

  it("includes the CLAP folders on every platform", () => {
    expect(getPluginPaths("macos", "/Users/me", sys)).toEqual(
      expect.arrayContaining(["/Library/Audio/Plug-Ins/CLAP", "/Users/me/Library/Audio/Plug-Ins/CLAP"]),
    )
    expect(getPluginPaths("linux", "/home/me")).toEqual(expect.arrayContaining(["/usr/lib/clap", "/home/me/.clap"]))
  })
})
