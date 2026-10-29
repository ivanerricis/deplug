import { Spinner } from "./components/ui/spinner"
import { useI18n } from "./i18n/I18nProvider"

export default function UpdatePage() {
    const { t } = useI18n()
    return (
        <div role="status" className="h-full w-full items-center justify-center flex flex-col text-muted-foreground">
            {t("loading.scanning")}
            <Spinner className="m-4" aria-hidden />
        </div>
    )
}