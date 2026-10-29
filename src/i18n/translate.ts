import type { LanguageSetting } from "@/core/settings/AppSettings"
import { en, type MessageKey } from "./en"
import { it } from "./it"

export type { MessageKey }
export type Language = "en" | "it"
export type TParams = Record<string, string | number>
export type TFunction = (key: MessageKey, params?: TParams) => string

export const dictionaries: Record<Language, Record<MessageKey, string>> = { en, it }

/** 'system' follows the browser/OS language: Italian if it starts with "it", English otherwise. */
export function resolveLanguage(
  setting: LanguageSetting,
  navigatorLanguage: string | undefined = typeof navigator === "undefined" ? undefined : navigator.language,
): Language {
  if (setting === "en" || setting === "it") return setting
  return navigatorLanguage?.toLowerCase().startsWith("it") ? "it" : "en"
}

/** Replaces `{name}` placeholders; unknown placeholders are left untouched. */
export function interpolate(template: string, params?: TParams): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
  )
}

export function makeT(language: Language): TFunction {
  const dict = dictionaries[language]
  return (key, params) => interpolate(dict[key] ?? en[key] ?? key, params)
}
