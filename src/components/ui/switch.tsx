import { cn } from "@/lib/utils"

type SwitchProps = {
  checked: boolean
  onCheckedChange: (value: boolean) => void
  id?: string
  disabled?: boolean
  "aria-labelledby"?: string
  "aria-describedby"?: string
  "aria-label"?: string
}

/** Accessible on/off toggle (role=switch). */
export function Switch({ checked, onCheckedChange, className, ...rest }: SwitchProps & { className?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-input p-0.5 outline-none transition-colors",
        "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary border-primary" : "bg-muted",
        className,
      )}
      {...rest}
    >
      <span
        aria-hidden
        className={cn(
          "block size-4.5 rounded-full transition-transform motion-reduce:transition-none",
          checked ? "translate-x-5 bg-primary-foreground" : "translate-x-0 bg-muted-foreground",
        )}
      />
    </button>
  )
}
