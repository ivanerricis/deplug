import { Spinner } from "./components/ui/spinner";

export default function UpdatePage() {
    return (
        <div className="h-full w-full items-center justify-center flex flex-col">
            Ricerca dei plugins in corso...
            <Spinner className="m-4" />
        </div>
    )
}