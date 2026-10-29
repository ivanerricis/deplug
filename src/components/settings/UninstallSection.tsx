import { useSettings } from "@/core/settings/SettingsContext"
import { useI18n } from "@/i18n/I18nProvider"
import { osLabel } from "@/core/plugin/Path"
import type { Platform } from "@/core/plugin/Path"
import { Switch } from "../ui/switch"
import { SettingRow } from "./SettingRow"

export default function UninstallSection({ platform }: { platform: Platform }) {
  const { t } = useI18n()
  const { settings, update } = useSettings()
  return (
    <div className="flex flex-col gap-4">
      <SettingRow label={t("settings.uninstall.restoreDefault")} hint={t("settings.uninstall.restoreDefaultHint")} labelId="set-rp" hintId="set-rp-h">
        <Switch
          checked={settings.restorePointDefault}
          onCheckedChange={v => update({ restorePointDefault: v })}
          aria-labelledby="set-rp"
          aria-describedby="set-rp-h"
        />
      </SettingRow>
      {platform === "windows" && (
        <SettingRow label={t("settings.uninstall.runAsAdmin")} hint={t("settings.uninstall.runAsAdminHint")} labelId="set-admin" hintId="set-admin-h">
          <Switch
            checked={settings.runAsAdmin}
            onCheckedChange={v => update({ runAsAdmin: v })}
            aria-labelledby="set-admin"
            aria-describedby="set-admin-h"
          />
        </SettingRow>
      )}
      {platform !== "windows" && (
        <p role="note" className="rounded bg-muted px-3 py-2 text-sm text-muted-foreground">
          {t("settings.uninstall.windowsOnly", { os: osLabel(platform) })}
        </p>
      )}
    </div>
  )
}
