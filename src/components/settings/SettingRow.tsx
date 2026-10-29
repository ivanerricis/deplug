import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type SettingRowProps = {
  label: string
  hint?: string
  /** id of the label element, for aria-labelledby on the control. */
  labelId: string
  hintId?: string
  children: ReactNode
  className?: string
}

/** A label + hint on the left and its control on the right. */
export function SettingRow({ label, hint, labelId, hintId, children, className }: SettingRowProps) {
  return (
    <div className={cn("flex items-center justify-between gap-6 py-3", className)}>
      <div className="min-w-0 flex-1">
        <div id={labelId} className="text-sm font-medium">{label}</div>
        {hint && <p id={hintId} className="mt-0.5 text-sm text-muted-foreground">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

export function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {hint && <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  )
}
