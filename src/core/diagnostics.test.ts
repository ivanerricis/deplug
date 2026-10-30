import { describe, expect, it } from "vitest"
import { buildDiagnostics, type DiagnosticsInput } from "./diagnostics"
import { makeT } from "@/i18n/translate"
import { DEFAULT_SETTINGS } from "./settings/AppSettings"

const base = (over: Partial<DiagnosticsInput> = {}): DiagnosticsInput => ({
  t: makeT("en"),
  version: "1.2.3",
  osName: "Windows",
  osInfo: "x86_64 / windows",
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  portable: false,
  elevated: true,
  settings: DEFAULT_SETTINGS,
  scanFolders: ["C:\\Program Files\\Common Files\\VST3", "D:\\Plugins"],
  formatCounts: { VST2: 0, VST3: 120, AAX: 3, AU: 0 },
  archCounts: { x64: 100, arm64: 5 },
  errors: [],
  ...over,
})

describe("buildDiagnostics", () => {
  it("reports version, OS, settings, counts and an empty error list", () => {
    const text = buildDiagnostics(base())
    expect(text).toContain("Version: 1.2.3")
    expect(text).toContain("OS: Windows x86_64 / windows")
    expect(text).toContain("Mozilla/5.0")
    expect(text).toContain("Language: system")
    expect(text).toContain("Scan folders: \n  - C:\\Program Files\\Common Files\\VST3\n  - D:\\Plugins")
    expect(text).toContain("Plugins found: 123 (VST3 120, AAX 3)")
    expect(text).toContain("Recent errors: none")
  })

  it("lists the recent errors", () => {
    const text = buildDiagnostics(base({ errors: [{ time: "2026-01-01T00:00:00.000Z", source: "scan", message: "boom" }] }))
    expect(text).toContain("  - 2026-01-01T00:00:00.000Z [scan] boom")
    expect(text).not.toContain("Recent errors: none")
  })

  it("hides the administrator lines outside Windows and handles an unknown version", () => {
    const text = buildDiagnostics(base({ elevated: undefined, version: null, osInfo: undefined, userAgent: undefined }))
    expect(text).not.toContain("Administrator")
    expect(text).toContain("Version: Unknown")
    expect(text).toContain("OS: Windows\n")
  })

  it("lists the scan folders and the portable data folder but never plugin names", () => {
    const text = buildDiagnostics(base({ portable: true, dataDir: "E:\\Deplug\\Deplug-data" }))
    expect(text).toContain("D:\\Plugins")
    expect(text).toContain("E:\\Deplug\\Deplug-data")
  })
})
