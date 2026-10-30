import { ScanSearch, ShieldCheck, ListChecks, Search, type LucideIcon } from "lucide-react"
import { Button } from "./ui/button"
import BrandMark from "./BrandMark"
import { useI18n } from "@/i18n/I18nProvider"
import type { MessageKey } from "@/i18n/translate"

const ITEMS: { icon: LucideIcon; text: MessageKey }[] = [
  { icon: ScanSearch, text: "welcome.item.find" },
  { icon: ShieldCheck, text: "welcome.item.safe" },
  { icon: ListChecks, text: "welcome.item.choose" },
]

/**
 * First-run screen. The scan is the one thing to do: the button comes first, large and focused so
 * Enter starts it, with a line that scanning only reads folders; what the app does follows below.
 */
export default function Welcome({ onScan, onSettings, folderCount }: { onScan: () => void; onSettings: () => void; folderCount: number }) {
  const { t } = useI18n()
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-6 py-8 text-center">
      <BrandMark className="size-16 shrink-0 text-foreground/80" />
      <div className="max-w-md">
        <h1 className="text-xl font-semibold">{t("welcome.title")}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t("welcome.purpose")}</p>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Button size="lg" autoFocus onClick={onScan} className="h-11 gap-2 px-8 text-base">
          <Search aria-hidden className="size-5" />
          {t("welcome.scan")}
        </Button>
        <p className="max-w-sm text-xs text-muted-foreground">{t("welcome.scanHint")}</p>
        <p className="text-xs text-muted-foreground">
          {t(folderCount === 1 ? "welcome.foldersOne" : "welcome.folders", { count: folderCount })}{" "}
          <Button variant="link" size="sm" onClick={onSettings} className="h-auto p-0 text-xs">{t("welcome.settings")}</Button>
        </p>
      </div>
      <ul className="flex max-w-md flex-col gap-3 text-left text-sm">
        {ITEMS.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-start gap-3">
            <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-signal" />
            <span>{t(text)}</span>
          </li>
        ))}
      </ul>
      <p className="max-w-md text-xs text-muted-foreground">{t("welcome.note")}</p>
    </div>
  )
}
