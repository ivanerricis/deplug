import { useSettings } from "@/core/settings/SettingsContext"
import type { LanguageSetting, ThemeSetting } from "@/core/settings/AppSettings"
import { useI18n } from "@/i18n/I18nProvider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group"
import { Separator } from "../ui/separator"
import { SettingRow } from "./SettingRow"

const THEMES: ThemeSetting[] = ["system", "light", "dark"]
const LANGUAGES: LanguageSetting[] = ["system", "en", "it"]

export default function GeneralSection() {
  const { t } = useI18n()
  const { settings, update } = useSettings()
  return (
    <div className="flex flex-col">
      <SettingRow label={t("settings.general.language")} hint={t("settings.general.languageHint")} labelId="set-lang" hintId="set-lang-h">
        <Select value={settings.language} onValueChange={v => update({ language: v as LanguageSetting })}>
          <SelectTrigger aria-labelledby="set-lang" aria-describedby="set-lang-h" className="min-w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" align="end">
            {LANGUAGES.map(value => (
              <SelectItem key={value} value={value}>{t(`settings.language.${value}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>
      <Separator />
      <SettingRow label={t("settings.general.theme")} hint={t("settings.general.themeHint")} labelId="set-theme" hintId="set-theme-h">
        <ToggleGroup
          type="single"
          variant="outline"
          value={settings.theme}
          // Radix reports "" when the active item is clicked again; a theme is always required.
          onValueChange={v => { if (v) update({ theme: v as ThemeSetting }) }}
          aria-labelledby="set-theme"
          aria-describedby="set-theme-h"
        >
          {THEMES.map(value => (
            <ToggleGroupItem
              key={value}
              value={value}
              className="px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              {t(`settings.theme.${value}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </SettingRow>
    </div>
  )
}
