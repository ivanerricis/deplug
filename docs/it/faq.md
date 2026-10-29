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
- Controlla i filtri di formato, il campo di ricerca e **Mostra solo i duplicati** nella barra degli strumenti: ciò che è filtrato è nascosto.
- Controlla **Impostazioni, Scansione**: una cartella standard deselezionata, o la **Scansione all'avvio** disattivata, dà anch'essa un elenco vuoto.
- I formati dipendono dal sistema: `.component` (AU) viene cercato solo su macOS, il VST2 è `.dll` su Windows, `.vst` su macOS e `.so` su Linux.
- Premi il pulsante di nuova scansione dopo aver installato o spostato dei plugin.
- Se una cartella richiede permessi speciali, Deplug salta ciò che non riesce a leggere, senza errori. Su macOS verifica in **Privacy e sicurezza** che Deplug possa accedere a quella posizione.

## Un plugin è in uso o non si riesce a rimuovere

Se il tuo DAW (o un host di plugin) ha caricato il plugin, il sistema operativo può tenere il file bloccato e lo spostamento nel cestino fallisce. Chiudi il DAW e qualsiasi scanner di plugin, poi riprova. Deplug mostra l'errore del sistema.

Cartelle come `C:\Program Files` possono richiedere anche i diritti di amministratore. Se la rimozione viene rifiutata per questo motivo, avvia Deplug come amministratore oppure elimina quel singolo file dal file manager.

## La disinstallazione fallisce con "servono i permessi di amministratore"

I plugin nelle cartelle protette come `C:\Program Files\Common Files\VST2`, `VST3` o `Avid` si possono modificare solo con i permessi di amministratore, e Deplug di norma funziona senza, quindi Windows nega lo spostamento nel Cestino. In questo caso l'elenco dei risultati mostra un avviso e il pulsante **Riprova con permessi di amministratore**. Premilo e approva l'unica richiesta di autorizzazione di Windows (UAC): tutti i plugin negati vengono ritentati insieme. I file finiscono comunque nel Cestino, quindi puoi ripristinarli. Se annulli la richiesta non cambia nulla e puoi premere di nuovo il pulsante.

Se preferisci non doverlo fare ogni volta, hai due possibilità: usare il pulsante di nuovo tentativo quando compare, oppure attivare **Esegui sempre Deplug come amministratore** in Impostazioni > Disinstallazione, così Deplug si avvia sempre con i diritti di amministratore. Se è già in esecuzione come amministratore e lo spostamento viene comunque negato, c'è qualcos'altro che blocca il file, ad esempio un altro programma che lo sta usando.

## La creazione del punto di ripristino è fallita

Vedi [Punto di ripristino su Windows](/it/using-deplug#why-creating-a-restore-point-can-fail): UAC rifiutato, Protezione sistema disattivata o limite di 24 ore.

## La disinstallazione elimina anche preset e file di licenza?

No. Deplug rimuove solo il file o il bundle del plugin che hai selezionato. Vedi [Usare Deplug](/it/using-deplug#uninstall-a-plugin).

## Dove salva i dati Deplug? {#where-does-deplug-store-its-data}

Un solo file: `settings.json`. Contiene le tue preferenze (lingua, tema, opzioni di scansione, punto di ripristino predefinito) e le cartelle di scansione personalizzate.

| Modalità | Posizione |
| --- | --- |
| Installato, Windows | `%APPDATA%\com.ivane.deplug\settings.json` |
| Installato, macOS | `~/Library/Application Support/com.ivane.deplug/settings.json` |
| Installato, Linux | `~/.config/com.ivane.deplug/settings.json` |
| [Portatile](/it/portable-mode) | `Deplug-data/settings.json` accanto all'app |

`com.ivane.deplug` è la cartella con l'identificatore dell'applicazione. Elimina il file (con Deplug chiuso) per tornare ai valori predefiniti: viene ricreato alla modifica successiva. Il file è JSON semplice, con chiavi come `language`, `theme`, `scanOnStartup`, `customScanDepth`, `customScanPaths`, `disabledSystemPaths` e `restorePointDefault`, ma per cambiarle conviene usare la finestra Impostazioni. L'elenco dei plugin non viene mai salvato: si ricostruisce a ogni scansione.

## Viene inviato qualcosa in rete?

Solo quando lo chiedi tu: **Impostazioni → Informazioni → Controlla aggiornamenti** contatta le API delle release di GitHub (`api.github.com`) per leggere l'elenco delle versioni pubblicate. Non viene inviato altro e il controllo non parte mai da solo. L'elenco dei plugin, i percorsi e le impostazioni restano sul tuo computer. Vedi [Sicurezza e privacy](/it/safety-and-privacy).

## Dove segnalo un bug?

Apri una issue su [GitHub](https://github.com/ivanerricis/deplug/issues) indicando il sistema, la versione di Deplug e cosa hai fatto.
