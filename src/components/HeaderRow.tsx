import { ChevronDown } from "lucide-react"
import { Label } from "@radix-ui/react-label"
import { Button } from "./ui/button"
import { useI18n } from "@/i18n/I18nProvider"

type HeaderRowProps = {
  type: string
  expanded: boolean
  onToggle: () => void
  className?: string
}

export default function HeaderRow({ type, expanded, onToggle, className }: HeaderRowProps) {
  const { t } = useI18n()
  return (
    <div className={`flex gap-2 items-center h-full ${className ?? ""}`}>
      <div className="flex gap-2 items-center justify-between p-1 border-r-2 border-foreground/50 w-24">
        <div className="flex items-center gap-2 pr-2">
          <Button variant={"outline"} size={"sm"} onClick={onToggle} aria-expanded={expanded} aria-label={t(expanded ? "section.collapse" : "section.expand", { type })}>
            <ChevronDown aria-hidden className={`transition-transform ${expanded === false ? "-rotate-90" : ""}`} />
          </Button>
          <Label>
            {type}
          </Label>
        </div>
      </div>
      <div className="flex items-center border-r-2 border-foreground/50 h-full w-sm">
        <Label className="p-2">{t("section.name")}</Label>
      </div>
      <div className="flex items-center border-foreground/50 h-full flex-1">
        <Label className="p-2">{t("section.path")}</Label>
      </div>
    </div>
  )
}
