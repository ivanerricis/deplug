import { useSettings } from "@/core/settings/SettingsContext"
import type { LanguageSetting, ThemeSetting } from "@/core/settings/AppSettings"
import { useI18n } from "@/i18n/I18nProvider"
import { Select } from "../ui/select"
import { SettingRow } from "./SettingRow"
import { cn } from "@/lib/utils"

const THEMES: ThemeSetting[] = ["system", "light", "dark"]

export default function GeneralSection() {
  const { t } = useI18n()
  const { settings, update } = useSettings()
  return (
    <div className="flex flex-col divide-y divide-border">
      <SettingRow label={t("settings.general.language")} hint={t("settings.general.languageHint")} labelId="set-lang" hintId="set-lang-h">
        <Select
          aria-labelledby="set-lang"
          aria-describedby="set-lang-h"
          value={settings.language}
          onChange={e => update({ language: e.target.value as LanguageSetting })}
        >
          <option value="system">{t("settings.language.system")}</option>
          <option value="en">{t("settings.language.en")}</option>
          <option value="it">{t("settings.language.it")}</option>
        </Select>
      </SettingRow>
      <SettingRow label={t("settings.general.theme")} hint={t("settings.general.themeHint")} labelId="set-theme" hintId="set-theme-h">
        <div role="radiogroup" aria-labelledby="set-theme" aria-describedby="set-theme-h" className="inline-flex rounded border border-input p-0.5">
          {THEMES.map(value => {
            const active = settings.theme === value
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                tabIndex={active ? 0 : -1}
                onClick={() => update({ theme: value })}
                onKeyDown={e => {
                  const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0
                  if (!step) return
                  e.preventDefault()
                  const next = THEMES[(THEMES.indexOf(value) + step + THEMES.length) % THEMES.length]
                  update({ theme: next })
                  ;(e.currentTarget.parentElement?.querySelector(`[data-theme="${next}"]`) as HTMLElement | null)?.focus()
                }}
                data-theme={value}
                className={cn(
                  "h-8 cursor-pointer rounded-sm px-3 text-sm outline-none transition-colors",
                  "focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {t(`settings.theme.${value}`)}
              </button>
            )
          })}
        </div>
      </SettingRow>
    </div>
  )
}
