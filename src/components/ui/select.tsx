import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

type SelectProps = React.ComponentProps<"select">

/** Styled native select: keeps keyboard and screen reader behaviour for free. */
export function Select({ className, children, ...props }: SelectProps) {
  return (
    <div className="relative inline-flex">
      <select
        className={cn(
          "h-9 min-w-44 cursor-pointer appearance-none rounded border border-input bg-background py-1 pl-3 pr-9 text-sm text-foreground outline-none",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}
