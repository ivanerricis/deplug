import { describe, expect, it } from "vitest"
import { OSApi, DirEntry } from "../os/OSApi"
import { PluginScanner, pluginTypeOf } from "./PluginScanner"
import { getPluginPaths } from "./Path"

function fakeOS(tree: Record<string, DirEntry[]>): OSApi {
  return {
    readDir: async (p) => {
      if (!(p in tree)) throw new Error("not found")
      return tree[p]
    },
    pathExists: async (p) => p in tree,
  }
}
const file = (dir: string, name: string): DirEntry => ({ name, path: `${dir}/${name}`, isDirectory: false })
const folder = (dir: string, name: string): DirEntry => ({ name, path: `${dir}/${name}`, isDirectory: true })

describe("pluginTypeOf", () => {
  it("matches by extension, not substring", () => {
    expect(pluginTypeOf("Serum.dll", "windows")).toBe("VST2")
    expect(pluginTypeOf("Serum.vst3", "windows")).toBe("VST3")
    expect(pluginTypeOf("Pro.aaxplugin", "windows")).toBe("AAX")
    expect(pluginTypeOf("readme.txt", "windows")).toBeNull()
    expect(pluginTypeOf("vstlib-notes.txt", "windows")).toBeNull()
    expect(pluginTypeOf("Foo.dll", "linux")).toBeNull()
    expect(pluginTypeOf("Foo.vst", "macos")).toBe("VST2")
    expect(pluginTypeOf("Foo.component", "macos")).toBe("AU")
    expect(pluginTypeOf("Foo.component", "windows")).toBeNull()
  })
})

describe("PluginScanner", () => {
  it("recurses into vendor folders and skips missing roots", async () => {
    const root = "/vst"
    const os = fakeOS({
      [root]: [folder(root, "Vendor"), file(root, "a.dll")],
      [`${root}/Vendor`]: [file(`${root}/Vendor`, "b.dll"), file(`${root}/Vendor`, "notes.txt")],
    })
    const res = await new PluginScanner(os, [root, "/missing"], "windows").search()
    expect(res.all.map(p => p.name).sort()).toEqual(["a.dll", "b.dll"])
    expect(res.vst2).toHaveLength(2)
  })

  it("does not descend into vst3 bundles and deduplicates overlapping roots", async () => {
    const os = fakeOS({
      "/v3": [folder("/v3", "X.vst3")],
      "/v3/X.vst3": [file("/v3/X.vst3", "inner.dll")],
    })
    const res = await new PluginScanner(os, ["/v3", "/v3"], "windows").search()
    expect(res.vst3.map(p => p.name)).toEqual(["X.vst3"])
    expect(res.all).toHaveLength(1)
  })

  it("survives unreadable directories", async () => {
    const os: OSApi = { readDir: async () => { throw new Error("denied") }, pathExists: async () => true }
    expect((await new PluginScanner(os, ["/x"], "linux").search()).all).toEqual([])
  })
})

describe("custom paths", () => {
  it("scans manually added folders deeper than system ones", async () => {
    const d = (n: number) => Array.from({ length: n }, (_, i) => `/c${"/x".repeat(i)}`)
    const tree: Record<string, DirEntry[]> = {}
    for (let i = 0; i < 5; i++) {
      const dir = d(5)[i]
      tree[dir] = [folder(dir, "x")]
    }
    tree["/c/x/x/x/x"] = [file("/c/x/x/x/x", "deep.dll")]
    tree["/c/x/x/x"] = [folder("/c/x/x/x", "x")]
    const system = await new PluginScanner(fakeOS(tree), ["/c"], "windows").search()
    expect(system.all).toHaveLength(0)
    const custom = await new PluginScanner(fakeOS(tree), [], "windows", ["/c"]).search()
    expect(custom.vst2.map(p => p.name)).toEqual(["deep.dll"])
  })
})

describe("scanner options", () => {
  const tree: Record<string, DirEntry[]> = {
    "/sys": [file("/sys", "a.dll")],
    "/c": [folder("/c", "x")],
    "/c/x": [folder("/c/x", "y")],
    "/c/x/y": [file("/c/x/y", "deep.dll")],
  }

  it("skips disabled system paths but still scans custom ones", async () => {
    const scanner = new PluginScanner(fakeOS(tree), ["/sys"], "windows", [], { disabledPaths: ["/sys"] })
    expect((await scanner.search()).all).toHaveLength(0)
    const enabled = new PluginScanner(fakeOS(tree), ["/sys"], "windows", [], { disabledPaths: ["/other"] })
    expect((await enabled.search()).all).toHaveLength(1)
  })

  it("honours customDepth for custom folders only", async () => {
    const shallow = new PluginScanner(fakeOS(tree), [], "windows", ["/c"], { customDepth: 1 })
    expect((await shallow.search()).all).toHaveLength(0)
    const deep = new PluginScanner(fakeOS(tree), [], "windows", ["/c"], { customDepth: 2 })
    expect((await deep.search()).all.map(p => p.name)).toEqual(["deep.dll"])
    const asSystem = new PluginScanner(fakeOS(tree), ["/c"], "windows", [], { customDepth: 1 })
    expect((await asSystem.search()).all).toHaveLength(1)
  })
})

describe("scanner exclusions", () => {
  const tree: Record<string, DirEntry[]> = {
    "/r": [folder("/r", "Backup"), folder("/r", "Vendor"), file("/r", "Reverb Demo.dll"), file("/r", "Good.dll")],
    "/r/Backup": [file("/r/Backup", "Old.dll")],
    "/r/Vendor": [folder("/r/Vendor", "old_stuff"), file("/r/Vendor", "Synth.vst3")],
    "/r/Vendor/old_stuff": [file("/r/Vendor/old_stuff", "Legacy.dll")],
  }

  it("does not descend into excluded folders or list excluded plugins", async () => {
    const scanner = new PluginScanner(fakeOS(tree), ["/r"], "windows", [], { exclusions: ["backup", "old_*", "*Demo*"] })
    expect((await scanner.search()).all.map(p => p.name).sort()).toEqual(["Good.dll", "Synth.vst3"])
  })

  it("lists everything without exclusions", async () => {
    const scanner = new PluginScanner(fakeOS(tree), ["/r"], "windows")
    expect((await scanner.search()).all).toHaveLength(5)
  })
})

describe("getPluginPaths", () => {
  it("uses the home dir on macOS and linux", () => {
    expect(getPluginPaths("macos", "/Users/me")).toContain("/Users/me/Library/Audio/Plug-Ins/VST3")
    expect(getPluginPaths("macos", "/Users/me")).toContain("/Library/Audio/Plug-Ins/Components")
    expect(getPluginPaths("linux", "/home/me")).toContain("/home/me/.vst3")
  })
})

describe("AAX and 32-bit Windows scenarios", () => {
  const cpf = "C:/Program Files/Common Files/Avid/Audio/Plug-Ins"
  it("classifies an .aaxplugin bundle in a Windows path as AAX without descending into it", async () => {
    const os = fakeOS({
      [cpf]: [folder(cpf, "Delay.aaxplugin"), file(cpf, "readme.txt")],
      [`${cpf}/Delay.aaxplugin`]: [folder(`${cpf}/Delay.aaxplugin`, "Contents")],
    })
    const res = await new PluginScanner(os, [cpf], "windows").search()
    expect(res.aax).toEqual([{ name: "Delay.aaxplugin", installPath: cpf, type: "AAX" }])
    expect(res.vst2).toEqual([])
    expect(res.au).toEqual([])
  })

  it("finds plugins under Program Files (x86) via the default Windows list", async () => {
    const x86 = "C:/Program Files (x86)/VstPlugins"
    const x86Common = "C:/Program Files (x86)/Common Files/VST3"
    const os = fakeOS({
      [x86]: [file(x86, "Old32.dll")],
      [x86Common]: [folder(x86Common, "Legacy.vst3")],
    })
    const res = await new PluginScanner(os, getPluginPaths("windows", ""), "windows").search()
    expect(res.vst2.map(p => p.installPath)).toEqual([x86])
    expect(res.vst3.map(p => p.installPath)).toEqual([x86Common])
  })
})
