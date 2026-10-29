# Usare Deplug

::: info La lingua dell'interfaccia
La versione attuale mostra l'interfaccia in italiano. L'interfaccia in inglese e italiano, con un selettore della lingua nelle Impostazioni, arriva con la 0.1.0.
:::

## Cosa viene analizzato {#what-gets-scanned}

All'avvio, e ogni volta che premi aggiorna, Deplug passa in rassegna le cartelle standard dei plugin del tuo sistema. Scende fino a tre livelli di sottocartelle, quindi le cartelle dei produttori sono incluse.

| Sistema | Cartelle |
| --- | --- |
| Windows | `C:\Program Files\Common Files\VST2`, `C:\Program Files\Steinberg\VSTPlugins`, `C:\Program Files (x86)\Steinberg\VstPlugins`, `C:\Program Files\Common Files\VST3`, `C:\Program Files\Common Files\Avid\Audio\Plug-Ins` |
| macOS | `/Library/Audio/Plug-Ins/VST`, `.../VST3`, `.../Components`, `/Library/Application Support/Avid/Audio/Plug-Ins`, e le stesse cartelle `VST`, `VST3` e `Components` in `~/Library/Audio/Plug-Ins` |
| Linux | `/usr/lib/vst`, `/usr/local/lib/vst`, `~/.vst`, `/usr/lib/vst3`, `/usr/local/lib/vst3`, `~/.vst3` |

Ogni [cartella personalizzata](/it/custom-folders) che aggiungi viene analizzata a sua volta, fino a sei livelli di profondità.

## Formati

| Formato | Riconosciuto come | Su |
| --- | --- | --- |
| VST2 | `.dll` / `.vst` / `.so` | Windows / macOS / Linux |
| VST3 | `.vst3` | tutti |
| AAX | `.aaxplugin` | tutti |
| AU (Audio Units) | `.component` | solo macOS |

Un bundle di plugin (una cartella come `Qualcosa.vst3`) è elencato come un solo plugin; Deplug non guarda al suo interno.

## Filtrare per formato

Le quattro caselle nella barra degli strumenti (VST2, VST3, AAX, AU) mostrano o nascondono la sezione di quel formato. Il filtro cambia solo ciò che vedi e non ripete la scansione. Ogni sezione si può anche comprimere da sola, e un formato senza plugin non ha sezione.

## Aprire la cartella di un plugin

Ogni riga inizia con un pulsante a forma di cartella. Apre nel file manager la cartella che contiene il plugin. Usalo per controllare cosa c'è prima di disinstallare.

## Disinstallare un plugin {#uninstall-a-plugin}

1. Premi il pulsante del cestino sulla riga del plugin. Si apre una finestra di conferma con il nome del plugin e il suo percorso completo.
2. Su Windows, decidi se creare un punto di ripristino (sezione successiva).
3. Premi **Sposta nel cestino**. Il plugin finisce nel cestino di sistema e l'elenco si aggiorna.

Non succede nulla finché non confermi, e **Annulla** (o Esc) chiude la finestra senza toccare niente.

Deplug rimuove soltanto il file o il bundle del plugin. Non elimina preset, file di licenza, campioni o impostazioni che l'installer del plugin ha messo altrove. È voluto: spesso sono condivisi con altri prodotti o servono se reinstalli in seguito.

Per annullare, apri il cestino e ripristina l'elemento nella posizione originale, poi premi aggiorna in Deplug.

## Punto di ripristino su Windows

Su Windows la finestra ha una casella attiva di default: **Crea un punto di ripristino di sistema prima di disinstallare**. È la stessa rete di sicurezza offerta da Revo Uninstaller. Se dopo aver rimosso un plugin qualcosa nel sistema non va, puoi tornare indietro con Ripristino configurazione di sistema di Windows.

Windows chiede i permessi di amministratore per creare un punto di ripristino (richiesta UAC), perché è una modifica a livello di sistema. La casella non compare su macOS e Linux.

### Perché la creazione può non riuscire {#why-creating-a-restore-point-can-fail}

Se non riesce, Deplug mostra il motivo e chiede se **continuare senza punto di ripristino**. Decidi tu: niente viene rimosso di nascosto.

- **L'UAC è stato rifiutato o annullato.** La richiesta di amministratore è stata chiusa o negata. Ripeti la disinstallazione e accettala.
- **La Protezione sistema è disattivata.** Windows crea punti di ripristino solo per le unità con la Protezione sistema attiva. Apri "Crea un punto di ripristino" dal menu Start, seleziona l'unità di sistema, premi **Configura** e attiva la protezione.
- **Windows ne ha già creato uno nelle ultime 24 ore.** Per impostazione predefinita Windows consente un solo punto di ripristino automatico ogni 24 ore e Deplug non può aggirare il limite. Se rimuovi più plugin, la prima disinstallazione copre il resto della giornata: continua senza crearne un altro.

Per gli altri errori viene mostrato il messaggio restituito da Windows PowerShell.
