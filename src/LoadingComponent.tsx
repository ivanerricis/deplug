import BrandMark from "./components/BrandMark"
import { useI18n } from "./i18n/I18nProvider"

export default function UpdatePage() {
    const { t } = useI18n()
    return (
        <div role="status" className="flex h-full w-full flex-col items-center justify-center gap-5 text-muted-foreground">
            <BrandMark className="loading-mark size-16 text-foreground/80" />
            <span className="text-sm">{t("loading.scanning")}</span>
        </div>
    )
}
