# Per iniziare

Deplug è un'app desktop per Windows, macOS e Linux. Non richiede un account né una connessione a internet.

## Scaricare

Scarica l'ultima versione dalla [pagina delle Release](https://github.com/ivanerricis/deplug/releases). Ogni release elenca installer e versioni portatili tra i file allegati. I nomi dei file contengono il nome dell'app, la versione e l'architettura.

| Sistema | Installer | Portatile |
| --- | --- | --- |
| Windows | `.msi` o `.exe` | `Deplug_<version>_*_portable.zip` |
| macOS | `.dmg` (universale: Apple silicon e Intel) | `Deplug_<version>_*_portable.zip` |
| Linux | `.deb`, `.rpm` o `.AppImage` | `Deplug_<version>_*_portable.tar.gz` |

Le release il cui tag termina con `-rc.N` (ad esempio `v0.1.0-rc.1`) sono release candidate e sono segnate come pre-release. Usa una normale release `vX.Y.Z`, a meno che tu non voglia fare dei test.

::: warning Le build non sono firmate
Alla prima apertura di Deplug, Windows SmartScreen e macOS Gatekeeper mostreranno un avviso. È normale ed è spiegato nelle [FAQ](/it/faq#windows-says-the-app-is-from-an-unknown-publisher).
:::

## Installare

### Windows

Esegui il file `.msi` (o il setup `.exe`) e segui la procedura guidata. Se SmartScreen mostra "Windows ha protetto il PC", scegli **Ulteriori informazioni**, poi **Esegui comunque**.

### macOS

Apri il `.dmg` e trascina Deplug in **Applicazioni**. Al primo avvio macOS potrebbe rifiutarsi di aprirlo. Fai clic destro sull'app, scegli **Apri** e conferma. Se ancora non si apre, vedi le [FAQ](/it/faq#macos-says-the-app-is-damaged-or-cannot-be-opened).

### Linux

- Debian e Ubuntu: `sudo apt install ./deplug_*.deb`
- Fedora e openSUSE: `sudo dnf install ./deplug-*.rpm`
- Qualsiasi distribuzione: rendi eseguibile l'`.AppImage` e avvialo. Le AppImage richiedono `libfuse2`; vedi [Modalità portatile](/it/portable-mode#linux).

Preferisci non installare nulla? Usa la [versione portatile](/it/portable-mode).

## La prima scansione

1. Avvia Deplug. Analizza da solo le cartelle standard dei plugin e mostra un indicatore di caricamento finché non ha finito.
2. La barra degli strumenti mostra **quanti plugin sono stati trovati** e le schede di formato: Tutti, VST2, VST3, AAX, AU e CLAP.
3. I plugin sono elencati in una sezione comprimibile per ciascun formato. Espandi una sezione per vederne i plugin.
4. Cerca per nome con il campo nella barra degli strumenti (Ctrl+F o Cmd+F) e usa il pulsante di nuova scansione dopo aver installato o rimosso qualcosa al di fuori di Deplug.

Se l'elenco è vuoto o manca un plugin che ti aspetti, leggi [Non è stato trovato nulla](/it/faq#nothing-was-found) oppure aggiungi [una cartella personalizzata](/it/custom-folders).

Prossimo passo: [Usare Deplug](/it/using-deplug).
