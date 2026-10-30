import { ScanSearch, ShieldCheck, ListChecks, type LucideIcon } from "lucide-react"
import { Button } from "./ui/button"
import BrandMark from "./BrandMark"
import { useI18n } from "@/i18n/I18nProvider"
import type { MessageKey } from "@/i18n/translate"

const ITEMS: { icon: LucideIcon; text: MessageKey }[] = [
  { icon: ScanSearch, text: "welcome.item.find" },
  { icon: ShieldCheck, text: "welcome.item.safe" },
  { icon: ListChecks, text: "welcome.item.choose" },
]

/** First-run screen: what Deplug does, then an explicit button to start the first scan. */
export default function Welcome({ onScan, onSettings }: { onScan: () => void; onSettings: () => void }) {
  const { t } = useI18n()
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-6 py-8 text-center">
      <BrandMark className="size-20 shrink-0 text-foreground/80" />
      <div className="max-w-md">
        <h1 className="text-xl font-semibold">{t("welcome.title")}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t("welcome.purpose")}</p>
      </div>
      <ul className="flex max-w-md flex-col gap-3 text-left text-sm">
        {ITEMS.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-start gap-3">
            <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-signal" />
            <span>{t(text)}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button size="lg" onClick={onScan}>{t("welcome.scan")}</Button>
        <Button variant="link" onClick={onSettings}>{t("welcome.settings")}</Button>
      </div>
      <p className="max-w-md text-xs text-muted-foreground">{t("welcome.note")}</p>
    </div>
  )
}
