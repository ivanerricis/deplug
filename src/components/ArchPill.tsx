import { useI18n } from "@/i18n/I18nProvider"
import type { PluginArch } from "@/core/plugin/Meta"
import { Badge } from "./ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip"

const HINT = {
  x86: "arch.x86Hint",
  arm64: "arch.arm64Hint",
  universal: "arch.universalHint",
  mixed: "arch.mixedHint",
} as const

/**
 * Small architecture badge. Only informative values render one: 32-bit (amber, a heads-up),
 * and ARM64 / Universal / Mixed (muted). 64-bit is the norm and unknown says nothing, so both render nothing.
 */
export default function ArchPill({ arch }: { arch: PluginArch | null | undefined }) {
  const { t } = useI18n()
  if (!arch || arch === "x64" || arch === "unknown") return null
  const tone =
    arch === "x86"
      ? "border-transparent bg-caution/15 text-caution"
      : "border-transparent bg-secondary text-muted-foreground"
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className={`h-[18px] cursor-help rounded px-1.5 py-0 text-[11px] leading-none ${tone}`}>
          {t(`arch.${arch}`)}
          <span className="sr-only">. {t(HINT[arch])}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{t(HINT[arch])}</TooltipContent>
    </Tooltip>
  )
}
