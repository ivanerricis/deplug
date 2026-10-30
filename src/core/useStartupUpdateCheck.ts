import { useEffect, useRef, useState } from "react"
import { getVersion } from "@tauri-apps/api/app"
import { checkForUpdate, startupCheckDue } from "./update"
import { useSettings } from "./settings/SettingsContext"

export interface StartupUpdate {
  latest: string
  url: string
  prerelease: boolean
}

/**
 * Opt-in update check that runs once, after the first scan has finished, at most every 24 hours.
 * It never blocks anything and fails silently; a failed check does not count as done, so it is retried next start.
 */
export function useStartupUpdateCheck(ready: boolean): StartupUpdate | null {
  const { settings, update } = useSettings()
  const [found, setFound] = useState<StartupUpdate | null>(null)
  const ran = useRef(false)
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  useEffect(() => {
    if (!ready || ran.current) return
    ran.current = true
    const s = settingsRef.current
    if (!startupCheckDue(s, Date.now())) return
    void (async () => {
      try {
        const current = await getVersion()
        const result = await checkForUpdate(current, { channel: s.updateChannel })
        if (result.status === "error") return
        update({ lastUpdateCheck: Date.now() })
        if (result.status === "available") setFound({ latest: result.latest, url: result.url, prerelease: result.prerelease })
      } catch {
        // Silent at startup.
      }
    })()
  }, [ready, update])

  return found
}
