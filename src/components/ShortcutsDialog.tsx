import { useI18n } from "@/i18n/I18nProvider"
import type { MessageKey } from "@/i18n/translate"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog"

/** Ctrl on Windows/Linux, Cmd on macOS. */
const MOD = typeof navigator !== "undefined" && /mac/i.test(navigator.platform) ? "Cmd" : "Ctrl"

const ROWS: { keys: string; label: MessageKey }[] = [
  { keys: `${MOD}+F`, label: "shortcuts.search" },
  { keys: `${MOD}+A`, label: "shortcuts.selectAll" },
  { keys: "Esc", label: "shortcuts.clear" },
  { keys: "Del", label: "shortcuts.uninstall" },
  { keys: `${MOD}+E`, label: "shortcuts.export" },
  { keys: `${MOD}+,`, label: "shortcuts.settings" },
  { keys: `F5, ${MOD}+R`, label: "shortcuts.rescan" },
  { keys: "?", label: "shortcuts.help" },
]

/** Small cheat sheet opened with the ? key. */
export default function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("shortcuts.title")}</DialogTitle>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-2 text-sm">
          {ROWS.map(row => (
            <div key={row.label} className="contents">
              <dt><kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">{row.keys}</kbd></dt>
              <dd className="text-muted-foreground">{t(row.label)}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  )
}
