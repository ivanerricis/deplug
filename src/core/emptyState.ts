import type { PluginType } from "./plugin/Plugin"

/** Why the list area has nothing to show; null when there is a list to render. */
export type EmptyStateKind = "welcome" | "idle" | "none" | "tab-empty" | "no-match"

export type EmptyStateInput = {
  /** First run: the welcome screen has not been dismissed and no scan has run. */
  welcome: boolean
  /** A scan has completed in this session. */
  scanned: boolean
  /** Plugins found per format, before any filter. */
  counts: Record<PluginType, number>
  tab: "all" | PluginType
  /** Plugins left on screen after search and filters, across the visible tabs. */
  shown: number
}

export function emptyStateKind({ welcome, scanned, counts, tab, shown }: EmptyStateInput): EmptyStateKind | null {
  if (welcome) return "welcome"
  const total = counts.VST2 + counts.VST3 + counts.AAX + counts.AU + counts.CLAP
  if (total === 0) return scanned ? "none" : "idle"
  // A format tab with no plugins at all is not a filter problem: say so, and offer All.
  if (tab !== "all" && counts[tab] === 0) return "tab-empty"
  if (shown === 0) return "no-match"
  return null
}
