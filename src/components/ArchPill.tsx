import { useI18n } from "@/i18n/I18nProvider"
import type { PluginArch } from "@/core/plugin/Meta"

const HINT = {
  x86: "arch.x86Hint",
  arm64: "arch.arm64Hint",
  universal: "arch.universalHint",
  mixed: "arch.mixedHint",
} as const

/**
 * Small architecture pill. Only informative values render one: 32-bit (amber, a heads-up),
 * and ARM64 / Universal / Mixed (muted). 64-bit is the norm and unknown says nothing, so both render nothing.
 */
export default function ArchPill({ arch }: { arch: PluginArch | null | undefined }) {
  const { t } = useI18n()
  if (!arch || arch === "x64" || arch === "unknown") return null
  const tone = arch === "x86" ? "bg-caution/15 text-caution" : "bg-secondary text-muted-foreground"
  return (
    <span
      title={t(HINT[arch])}
      className={`inline-flex h-[18px] shrink-0 cursor-help items-center rounded px-1.5 text-[11px] font-medium leading-none ${tone}`}
    >
      {t(`arch.${arch}`)}
      <span className="sr-only">. {t(HINT[arch])}</span>
    </span>
  )
}
