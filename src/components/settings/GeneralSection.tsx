import { useSettings } from "@/core/settings/SettingsContext"
import {
  COLUMN_KEYS,
  SORT_KEYS,
  TAB_SETTINGS,
  type ColumnKey,
  type DensitySetting,
  type LanguageSetting,
  type SortSetting,
  type TabSetting,
  type ThemeSetting,
} from "@/core/settings/AppSettings"
import { useI18n } from "@/i18n/I18nProvider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group"
import { Checkbox } from "../ui/checkbox"
import { Separator } from "../ui/separator"
import { Switch } from "../ui/switch"
import { Group, Rows, SettingRow } from "./SettingRow"

const THEMES: ThemeSetting[] = ["system", "light", "dark"]
const LANGUAGES: LanguageSetting[] = ["system", "en", "it"]

const DENSITIES: DensitySetting[] = ["comfortable", "compact"]

export default function GeneralSection() {
  const { t } = useI18n()
  const { settings, update } = useSettings()
  const toggleColumn = (column: ColumnKey, on: boolean) =>
    update({ visibleColumns: COLUMN_KEYS.filter(c => (c === column ? on : settings.visibleColumns.includes(c))) })
  const setSort = (patch: Partial<SortSetting>) => update({ defaultSort: { ...settings.defaultSort, ...patch } })
  return (
    <div className="flex flex-col gap-4">
      <Group title={t("settings.group.appearance")}>
      <Rows>
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
      <SettingRow label={t("settings.general.theme")} hint={t("settings.general.themeHint")} labelId="set-theme" wide hintId="set-theme-h">
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
      </Rows>
      </Group>

      <Separator />

      <Group title={t("settings.general.list")} hint={t("settings.general.listHint")}>
        <ul className="flex flex-wrap gap-x-6 gap-y-1">
          {COLUMN_KEYS.map(column => {
            const id = `col-${column}`
            return (
              <li key={column} className="flex items-center gap-2 py-1.5">
                <Checkbox id={id} checked={settings.visibleColumns.includes(column)} onCheckedChange={v => toggleColumn(column, v === true)} />
                <label htmlFor={id} className="cursor-pointer text-sm">{t(`settings.col.${column}`)}</label>
              </li>
            )
          })}
        </ul>
        <Rows>
        <SettingRow label={t("settings.general.density")} hint={t("settings.general.densityHint")} labelId="set-density" wide hintId="set-density-h">
          <ToggleGroup
            type="single"
            variant="outline"
            value={settings.density}
            onValueChange={v => { if (v) update({ density: v as DensitySetting }) }}
            aria-labelledby="set-density"
            aria-describedby="set-density-h"
          >
            {DENSITIES.map(value => (
              <ToggleGroupItem key={value} value={value} className="px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                {t(`settings.density.${value}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </SettingRow>
        </Rows>
      </Group>

      <Separator />

      <Group title={t("settings.group.view")}>
        <Rows>
        <SettingRow label={t("settings.general.remember")} hint={t("settings.general.rememberHint")} labelId="set-remember" hintId="set-remember-h">
          <Switch
            checked={settings.rememberView}
            onCheckedChange={v => update({ rememberView: v })}
            aria-labelledby="set-remember"
            aria-describedby="set-remember-h"
          />
        </SettingRow>
        <SettingRow label={t("settings.general.startTab")} labelId="set-tab">
          <Select value={settings.defaultTab} onValueChange={v => update({ defaultTab: v as TabSetting })}>
            <SelectTrigger aria-labelledby="set-tab" className="min-w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="end">
              {TAB_SETTINGS.map(value => (
                <SelectItem key={value} value={value}>{value === "all" ? t("settings.tab.all") : value}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow label={t("settings.general.defaultSort")} labelId="set-sort" wide>
          <div className="flex items-center gap-2">
            <Select value={settings.defaultSort.key} onValueChange={v => setSort({ key: v as SortSetting["key"] })}>
              <SelectTrigger aria-label={t("settings.general.sortKey")} className="min-w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" align="end">
                {SORT_KEYS.map(value => (
                  <SelectItem key={value} value={value}>{t(`section.${value}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={settings.defaultSort.dir} onValueChange={v => setSort({ dir: v as SortSetting["dir"] })}>
              <SelectTrigger aria-label={t("settings.general.sortDir")} className="min-w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" align="end">
                {(["asc", "desc"] as const).map(value => (
                  <SelectItem key={value} value={value}>{t(`settings.sortDir.${value}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </SettingRow>
        </Rows>
      </Group>
    </div>
  )
}
