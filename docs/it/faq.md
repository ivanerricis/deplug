# FAQ e risoluzione problemi

## Windows dice che l'app proviene da un editore sconosciuto {#windows-says-the-app-is-from-an-unknown-publisher}

Le build di Deplug non sono firmate digitalmente, perché i certificati costano e questo è un progetto indipendente. Per questo Windows SmartScreen mostra "Windows ha protetto il PC".

Scegli **Ulteriori informazioni**, poi **Esegui comunque**. Scarica solo dalla [pagina ufficiale delle Release](https://github.com/ivanerricis/deplug/releases).

## macOS dice che l'app è danneggiata o non può essere aperta {#macos-says-the-app-is-damaged-or-cannot-be-opened}

Stesso motivo: l'app non è firmata né notarizzata da Apple, quindi Gatekeeper la blocca, a volte con il fuorviante messaggio "è danneggiata".

1. Sposta l'app in **Applicazioni**.
2. Fai clic destro, scegli **Apri** e conferma; oppure
3. rimuovi il flag di quarantena dal Terminale:

```bash
xattr -dr com.apple.quarantine "/Applications/Deplug.app"
```

Puoi anche consentirla in **Impostazioni di Sistema, Privacy e sicurezza** subito dopo un avvio bloccato.

## Non è stato trovato nulla {#nothing-was-found}

- Deplug guarda solo nelle [cartelle standard](/it/using-deplug#what-gets-scanned). Se i tuoi plugin sono altrove, aggiungi [una cartella personalizzata](/it/custom-folders).
- Controlla i filtri di formato nella barra degli strumenti: un formato senza spunta è nascosto.
- I formati dipendono dal sistema: `.component` (AU) viene cercato solo su macOS, il VST2 è `.dll` su Windows, `.vst` su macOS e `.so` su Linux.
- Premi il pulsante di aggiornamento dopo aver installato o spostato dei plugin.
- Se una cartella richiede permessi speciali, Deplug salta ciò che non riesce a leggere, senza errori. Su macOS verifica in **Privacy e sicurezza** che Deplug possa accedere a quella posizione.

## Un plugin è in uso o non si riesce a rimuovere

Se il tuo DAW (o un host di plugin) ha caricato il plugin, il sistema operativo può tenere il file bloccato e lo spostamento nel cestino fallisce. Chiudi il DAW e qualsiasi scanner di plugin, poi riprova. Deplug mostra l'errore del sistema.

Cartelle come `C:\Program Files` possono richiedere anche i diritti di amministratore. Se la rimozione viene rifiutata per questo motivo, avvia Deplug come amministratore oppure elimina quel singolo file dal file manager.

## La creazione del punto di ripristino è fallita

Vedi [Punto di ripristino su Windows](/it/using-deplug#why-creating-a-restore-point-can-fail): UAC rifiutato, Protezione sistema disattivata o limite di 24 ore.

## La disinstallazione elimina anche preset e file di licenza?

No. Deplug rimuove solo il file o il bundle del plugin che hai selezionato. Vedi [Usare Deplug](/it/using-deplug#uninstall-a-plugin).

## Dove salva i dati Deplug? {#where-does-deplug-store-its-data}

Un solo file: `settings.json`, che contiene le cartelle di scansione personalizzate (e, dalla 0.1.0, le tue preferenze).

| Modalità | Posizione |
| --- | --- |
| Installato, Windows | `%APPDATA%\<identificatore app>\settings.json` |
| Installato, macOS | `~/Library/Application Support/<identificatore app>/settings.json` |
| Installato, Linux | `~/.config/<identificatore app>/settings.json` |
| [Portatile](/it/portable-mode) | `PluginUninstaller-data/settings.json` accanto all'app |

`<identificatore app>` è la cartella con l'identificatore dell'applicazione. Elimina il file per tornare ai valori predefiniti. L'elenco dei plugin non viene mai salvato: si ricostruisce a ogni scansione.

## Viene inviato qualcosa in rete?

No. Vedi [Sicurezza e privacy](/it/safety-and-privacy).

## Dove segnalo un bug?

Apri una issue su [GitHub](https://github.com/ivanerricis/deplug/issues) indicando il sistema, la versione di Deplug e cosa hai fatto.
