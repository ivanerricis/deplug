import type { PluginType } from "@/core/plugin/Plugin"

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
    <span className={`inline-flex h-[18px] shrink-0 items-center rounded px-1.5 text-[11px] font-semibold leading-none ${TAG[type]} ${className}`}>
      {type}
    </span>
  )
}

export function FormatDot({ type, className = "" }: { type: PluginType; className?: string }) {
  return <span aria-hidden className={`inline-block size-2 shrink-0 rounded-full ${DOT[type]} ${className}`} />
}
