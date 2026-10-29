import { Trash, X } from "lucide-react"
import { Button } from "./ui/button"
import { useI18n } from "@/i18n/I18nProvider"

type SelectionBarProps = {
  count: number
  onUninstall: () => void
  onClear: () => void
}

/** Floats at the bottom of the window while at least one plugin is selected. */
export default function SelectionBar({ count, onUninstall, onClear }: SelectionBarProps) {
  const { t } = useI18n()
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-20 flex justify-center px-3">
      <div
        role="region"
        aria-label={t("selection.bar")}
        className="pointer-events-auto flex max-w-full items-center gap-3 rounded-xl bg-foreground py-1.5 pl-4 pr-1.5 text-background shadow-lg ring-1 ring-background/10 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-150"
      >
        <span role="status" className="flex items-center gap-2 whitespace-nowrap text-sm font-medium tabular-nums">
          <span aria-hidden className="size-1.5 rounded-full bg-signal" />
          {t("selection.count", { count })}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-9 text-background hover:bg-background/15 hover:text-background dark:hover:bg-background/15"
          >
            <X aria-hidden />
            {t("selection.clear")}
          </Button>
          <Button
            size="sm"
            onClick={onUninstall}
            className="h-9 bg-background text-foreground hover:bg-background/90"
          >
            <Trash aria-hidden />
            {t("selection.uninstall")}
          </Button>
        </div>
      </div>
    </div>
  )
}
