import { describe, expect, it } from "vitest"
import { csvField, exportFileName, exportPlugins, pluginsToCsv, pluginsToText } from "./Export"
import type { Plugin } from "./Plugin"
import type { MetaMap } from "./Meta"

const p = (name: string, installPath = "/vst3", type: Plugin["type"] = "VST3"): Plugin => ({ name, installPath, type })

describe("csvField", () => {
  it("leaves plain values alone", () => {
    expect(csvField("Serum.vst3")).toBe("Serum.vst3")
  })
  it("quotes commas, quotes and line breaks", () => {
    expect(csvField("a,b")).toBe('"a,b"')
    expect(csvField('say "hi"')).toBe('"say ""hi"""')
    expect(csvField("a\nb")).toBe('"a\nb"')
    expect(csvField("a\rb")).toBe('"a\rb"')
  })
})

describe("pluginsToCsv", () => {
  it("starts with a BOM and the header, and ends with CRLF", () => {
    const csv = pluginsToCsv([])
    expect(csv).toBe("\uFEFFformat,name,path,size,modified,architecture,vendor\r\n")
  })
  it("writes metadata, ISO dates and architecture", () => {
    const meta: MetaMap = new Map([["/vst3/Serum.vst3", { path: "/vst3/Serum.vst3", size: 1234, modified: 0, arch: "x64" }]])
    const lines = pluginsToCsv([p("Serum.vst3")], meta).split("\r\n")
    expect(lines[1]).toBe("VST3,Serum.vst3,/vst3/Serum.vst3,1234,1970-01-01T00:00:00.000Z,x64,")
  })
  it("writes the producer column, empty when unknown", () => {
    const meta: MetaMap = new Map([
      ["/vst3/A.vst3", { path: "/vst3/A.vst3", size: 1, modified: 0, vendor: " Acme, Inc. " }],
      ["/vst3/B.vst3", { path: "/vst3/B.vst3", size: 1, modified: 0, vendor: null }],
    ])
    const lines = pluginsToCsv([p("A.vst3"), p("B.vst3")], meta).split("\r\n")
    expect(lines[1]).toBe('VST3,A.vst3,/vst3/A.vst3,1,1970-01-01T00:00:00.000Z,,"Acme, Inc."')
    expect(lines[2]).toBe("VST3,B.vst3,/vst3/B.vst3,1,1970-01-01T00:00:00.000Z,,")
  })
  it("leaves unknown metadata empty", () => {
    const meta: MetaMap = new Map([["/vst3/A.vst3", { path: "/vst3/A.vst3", size: null, modified: null, arch: "unknown" }]])
    expect(pluginsToCsv([p("A.vst3"), p("B.vst3")], meta).split("\r\n").slice(1, 3)).toEqual([
      "VST3,A.vst3,/vst3/A.vst3,,,,",
      "VST3,B.vst3,/vst3/B.vst3,,,,",
    ])
  })
  it("escapes names and paths with special characters", () => {
    const csv = pluginsToCsv([p('Odd, "One".vst3', "/a,b")])
    expect(csv).toContain('VST3,"Odd, ""One"".vst3","/a,b/Odd, ""One"".vst3",,,,')
  })
  it("ignores an invalid timestamp", () => {
    const meta: MetaMap = new Map([["/vst3/A.vst3", { path: "/vst3/A.vst3", size: 1, modified: Number.MAX_VALUE }]])
    expect(pluginsToCsv([p("A.vst3")], meta).split("\r\n")[1]).toBe("VST3,A.vst3,/vst3/A.vst3,1,,,")
  })
})

describe("pluginsToText", () => {
  it("writes one full path per line", () => {
    expect(pluginsToText([p("A.vst3"), p("B.dll", "C:\\VST", "VST2")])).toBe("/vst3/A.vst3\nC:\\VST\\B.dll\n")
  })
  it("is empty for an empty list", () => {
    expect(pluginsToText([])).toBe("")
  })
})

describe("exportPlugins / exportFileName", () => {
  it("picks the serializer by format", () => {
    expect(exportPlugins("txt", [p("A.vst3")])).toBe("/vst3/A.vst3\n")
    expect(exportPlugins("csv", [p("A.vst3")]).startsWith("\uFEFF")).toBe(true)
  })
  it("builds a dated default name", () => {
    expect(exportFileName("csv", new Date(2026, 0, 5))).toBe("deplug-plugins-2026-01-05.csv")
    expect(exportFileName("txt", new Date(2026, 9, 30))).toBe("deplug-plugins-2026-10-30.txt")
  })
})
