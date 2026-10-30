import { useSettings } from "@/core/settings/SettingsContext"
import { useI18n } from "@/i18n/I18nProvider"
import { osLabel } from "@/core/plugin/Path"
import type { Platform } from "@/core/plugin/Path"
import type { DeleteMethodSetting } from "@/core/settings/AppSettings"
import { Switch } from "../ui/switch"
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group"
import { SettingRow } from "./SettingRow"

const DELETE_METHODS: DeleteMethodSetting[] = ["trash", "permanent"]

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
      <SettingRow label={t("settings.uninstall.deleteMethod")} hint={t("settings.uninstall.deleteMethodHint")} labelId="set-del" hintId="set-del-h">
        <ToggleGroup
          type="single"
          variant="outline"
          value={settings.deleteMethod}
          // Radix reports "" when the active item is clicked again; a method is always required.
          onValueChange={v => { if (v) update({ deleteMethod: v as DeleteMethodSetting }) }}
          aria-labelledby="set-del"
          aria-describedby="set-del-h"
        >
          {DELETE_METHODS.map(value => (
            <ToggleGroupItem
              key={value}
              value={value}
              className="px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              {t(`settings.uninstall.deleteMethod.${value}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </SettingRow>
      <SettingRow label={t("settings.uninstall.confirmUninstall")} hint={t("settings.uninstall.confirmUninstallHint")} labelId="set-confirm" hintId="set-confirm-h">
        <Switch
          checked={settings.confirmUninstall}
          onCheckedChange={v => update({ confirmUninstall: v })}
          aria-labelledby="set-confirm"
          aria-describedby="set-confirm-h"
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
