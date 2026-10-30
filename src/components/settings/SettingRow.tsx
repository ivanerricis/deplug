import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type SettingRowProps = {
  label: string
  hint?: string
  /** id of the label element, for aria-labelledby on the control. */
  labelId: string
  hintId?: string
  children: ReactNode
  /** A bulky control (wide toggle group, several selects): stacks under the text in a narrow pane. */
  wide?: boolean
  className?: string
}

/** Hints longer than this run under the label across the full row instead of beside the control. */
const LONG_HINT = 90

/**
 * A label + hint with its control on the right. A short hint sits under the label beside the control; a long
 * one, or any hint in a narrow pane, spans the whole row below. It follows the width of the pane (container
 * query), not the window.
 */
export function SettingRow({ label, hint, labelId, hintId, children, wide, className }: SettingRowProps) {
  const long = (hint?.length ?? 0) > LONG_HINT
  return (
    <div className="@container">
      <div className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-8 gap-y-1 py-3.5", className)}>
        <div id={labelId} className={cn("col-start-1 row-start-1 text-sm font-medium", wide && "col-span-2 @xl:col-span-1")}>{label}</div>
        {hint && (
          <p
            id={hintId}
            className={cn(
              "col-span-2 row-start-2 max-w-[46rem] text-sm text-muted-foreground",
              !long && "@xl:col-span-1",
            )}
          >
            {hint}
          </p>
        )}
        <div
          className={cn(
            "col-start-2 row-start-1",
            wide && "col-span-2 col-start-1 row-start-3 mt-2 justify-self-start @xl:col-span-1 @xl:col-start-2 @xl:row-start-1 @xl:mt-0 @xl:justify-self-auto",
            hint && !long && "@xl:row-span-2",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

/** A settings section: a small heading, an optional description and the rows below it. */
export function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {hint && <p className="mt-0.5 max-w-[46rem] text-sm text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

/** Rows of one section, divided by hairlines. */
export function Rows({ children }: { children: ReactNode }) {
  return <div className="flex flex-col divide-y divide-border">{children}</div>
}
