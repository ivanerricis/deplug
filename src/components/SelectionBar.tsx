import { Trash, X } from "lucide-react"
import { Button } from "./ui/button"
import { useI18n } from "@/i18n/I18nProvider"

type SelectionBarProps = {
  count: number
  onUninstall: () => void
  onClear: () => void
}

/** Pinned under the list while at least one plugin is selected. */
export default function SelectionBar({ count, onUninstall, onClear }: SelectionBarProps) {
  const { t } = useI18n()
  return (
    <div
      role="region"
      aria-label={t("selection.bar")}
      className="mt-2 flex flex-none items-center justify-between gap-3 border-2 border-foreground/50 border-t-signal bg-card px-3 py-2"
    >
      <span role="status" className="text-sm font-medium tabular-nums">{t("selection.count", { count })}</span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onClear}>
          <X aria-hidden />
          {t("selection.clear")}
        </Button>
        <Button variant="destructive" size="sm" onClick={onUninstall}>
          <Trash aria-hidden />
          {t("selection.uninstall")}
        </Button>
      </div>
    </div>
  )
}
