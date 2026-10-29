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

describe("getPluginPaths", () => {
  it("uses the home dir on macOS and linux", () => {
    expect(getPluginPaths("macos", "/Users/me")).toContain("/Users/me/Library/Audio/Plug-Ins/VST3")
    expect(getPluginPaths("linux", "/home/me")).toContain("/home/me/.vst3")
  })
})
