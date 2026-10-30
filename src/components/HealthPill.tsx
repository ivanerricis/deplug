import { useI18n } from "@/i18n/I18nProvider"
import type { PluginHealth } from "@/core/plugin/Meta"
import { Badge } from "./ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip"

const HINT = {
  empty: "health.emptyHint",
  "missing-binary": "health.missingBinaryHint",
} as const

/** "Damaged" badge for empty plugins and bundles without their binary; healthy or unknown plugins render nothing. */
export default function HealthPill({ health }: { health: PluginHealth | null | undefined }) {
  const { t } = useI18n()
  if (health !== "empty" && health !== "missing-binary") return null
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className="h-[18px] cursor-help rounded border-transparent bg-destructive/10 px-1.5 py-0 text-[11px] leading-none text-destructive"
        >
          {t("health.damaged")}
          <span className="sr-only">. {t(HINT[health])}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{t(HINT[health])}</TooltipContent>
    </Tooltip>
  )
}
