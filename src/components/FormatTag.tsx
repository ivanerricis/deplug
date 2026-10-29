import type { PluginType } from "@/core/plugin/Plugin"
import { Badge } from "./ui/badge"
import { cn } from "@/lib/utils"

/** Static class names so Tailwind can see them. Tones are desaturated; each passes AA on its tint. */
const TAG: Record<PluginType, string> = {
  VST2: "bg-fmt-vst2/12 text-fmt-vst2",
  VST3: "bg-fmt-vst3/12 text-fmt-vst3",
  AAX: "bg-fmt-aax/12 text-fmt-aax",
  AU: "bg-fmt-au/12 text-fmt-au",
}
const DOT: Record<PluginType, string> = {
  VST2: "bg-fmt-vst2",
  VST3: "bg-fmt-vst3",
  AAX: "bg-fmt-aax",
  AU: "bg-fmt-au",
}

export function FormatTag({ type, className = "" }: { type: PluginType; className?: string }) {
  return (
    <Badge variant="secondary" className={cn("h-[18px] border-transparent px-1.5 py-0 text-[11px] font-semibold leading-none", TAG[type], className)}>
      {type}
    </Badge>
  )
}

export function FormatDot({ type, className = "" }: { type: PluginType; className?: string }) {
  return <span aria-hidden className={`inline-block size-2 shrink-0 rounded-full ${DOT[type]} ${className}`} />
}
