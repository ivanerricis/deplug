# Usare Deplug

## Cosa viene analizzato {#what-gets-scanned}

All'avvio (a meno che tu non l'abbia disattivato nelle [Impostazioni](/it/settings#scan)) e ogni volta che premi il pulsante di nuova scansione, Deplug passa in rassegna le cartelle standard dei plugin del tuo sistema. Scende fino a tre livelli di sottocartelle, quindi le cartelle dei produttori sono incluse.

| Sistema | Cartelle |
| --- | --- |
| Windows | VST2: `Program Files\VstPlugins`, `Program Files (x86)\VstPlugins`, `Common Files\VST2` (entrambe), `Program Files\Steinberg\VSTPlugins`, `Program Files (x86)\Steinberg\VstPlugins`. VST3: `Common Files\VST3` (entrambe), `%LOCALAPPDATA%\Programs\Common\VST3`. AAX: `Common Files\Avid\Audio\Plug-Ins` (entrambe). Vedi sotto. |
| macOS | `/Library/Audio/Plug-Ins/VST`, `.../VST3`, `.../Components`, `/Library/Application Support/Avid/Audio/Plug-Ins`, e le stesse cartelle `VST`, `VST3` e `Components` in `~/Library/Audio/Plug-Ins` più `~/Library/Application Support/Avid/Audio/Plug-Ins` |
| Linux | `/usr/lib/vst`, `/usr/local/lib/vst`, `~/.vst`, `/usr/lib/vst3`, `/usr/local/lib/vst3`, `~/.vst3` |

Su Windows le radici sono lette dal sistema (le posizioni `ProgramFiles`, `ProgramFiles(x86)`, `CommonProgramFiles` e `CommonProgramFiles(x86)`), quindi funziona anche con Program Files spostata o localizzata. "Entrambe" indica la variante a 64 bit e quella a 32 bit (`Program Files (x86)`) della cartella.

Ogni [cartella personalizzata](/it/custom-folders) che aggiungi viene analizzata a sua volta, di default fino a sei livelli di profondità (puoi cambiarlo da 1 a 10 nelle [Impostazioni](/it/settings#scan)). Sempre lì puoi disattivare singole cartelle standard.

## Formati

| Formato | Riconosciuto come | Su |
| --- | --- | --- |
| VST2 | `.dll` / `.vst` / `.so` | Windows / macOS / Linux |
| VST3 | `.vst3` | tutti |
| AAX | `.aaxplugin` | tutti |
| AU (Audio Units) | `.component` | solo macOS |

Un bundle di plugin (una cartella come `Qualcosa.vst3`) è elencato come un solo plugin; Deplug non guarda al suo interno.

## AAX, 32 bit e 64 bit

I plugin **AAX** (Pro Tools) sono bundle `.aaxplugin` e hanno una sezione propria che funziona come le altre: ordinamento, selezione, duplicati e disinstallazione. Su Windows stanno in `Common Files\Avid\Audio\Plug-Ins`, su macOS in `/Library/Application Support/Avid/Audio/Plug-Ins` e nella stessa cartella dentro la tua home. AU esiste solo su macOS.

Deplug legge l'architettura di ogni file di plugin. Accanto al nome può comparire una piccola etichetta:

- **32 bit** (ambra): il plugin non si carica in una DAW a 64 bit senza un bridge. Tipico dei plugin in `Program Files (x86)`.
- **ARM64**, **Universal** (Intel e ARM) e **Misto** (un bundle con architetture diverse), in grigio tenue.
- I plugin a 64 bit, la norma, non mostrano etichette, e neppure quelli di cui non si è potuta determinare l'architettura.

Il menu **Architettura** nella barra degli strumenti (Tutte, 64 bit, 32 bit, ARM64) restringe l'elenco a una sola architettura. Funziona insieme a ricerca, caselle dei formati e filtro dei duplicati, e i conteggi li seguono. Con un'architettura specifica scelta, i plugin di architettura sconosciuta restano nascosti. Il menu compare quando almeno un'architettura è nota. L'architettura è mostrata anche nella finestra di disinstallazione e nella diagnostica copiata.

## Filtrare per formato

Le schede nella barra degli strumenti (Tutti, VST2, VST3, AAX, AU) mostrano tutti i formati insieme oppure uno solo, ognuna con il numero di plugin. Il filtro cambia solo ciò che vedi e non ripete la scansione. Ogni sezione si può anche comprimere da sola, e un formato senza plugin non ha sezione.

## Cercare

Il campo di ricerca nella barra degli strumenti filtra l'elenco mentre scrivi. Confronta nome e percorso del plugin, senza distinguere maiuscole e accenti. Premi **Ctrl+F** (**Cmd+F** su macOS) per raggiungerlo da qualsiasi punto della finestra. **Esc** cancella la ricerca, come la croce dentro il campo. Se nessun plugin corrisponde, il pulsante **Azzera i filtri** ripristina in un colpo solo la ricerca, i filtri di duplicati, architettura e formato.

## Esportare l'elenco

Il pulsante di download nella barra degli strumenti salva l'elenco dei plugin in un file. Esporta ciò che vedi nella scheda attiva, dopo i filtri di ricerca, duplicati e architettura. Se hai selezionato alcuni plugin, viene esportata solo la selezione; il menu indica quale dei due casi vale e quanti plugin sono. Scegli **CSV** per un foglio di calcolo (colonne: formato, nome, percorso, dimensione in byte, data di modifica in ISO 8601, architettura; UTF-8, si apre correttamente in Excel) oppure **testo semplice** per un percorso completo per riga. Una finestra di salvataggio propone `deplug-plugins-AAAA-MM-GG` e un messaggio conferma dove è finito il file, o perché è fallito. Dimensione, data e architettura restano vuote per i plugin i cui dettagli non sono ancora stati letti.

## Ordinare

Ogni sezione ha le intestazioni di colonna **Nome** e **Percorso**. Fai clic su una per ordinare, e di nuovo per invertire l'ordine. L'ordinamento è naturale, quindi "Plug 2" viene prima di "Plug 10", e ogni sezione di formato mantiene il proprio.

## Duplicati

Un plugin presente più volte riceve il badge **Duplicato**. Due voci sono considerate lo stesso plugin quando i nomi coincidono dopo aver tolto l'estensione e un eventuale `x64` finale, senza distinguere maiuscole. Così vengono riconosciuti lo stesso plugin in più formati (VST2 e VST3), in più cartelle, o entrambi. Passa il mouse sul badge per vedere dove si trovano le altre copie.

La casella **Mostra solo i duplicati** nella barra degli strumenti tiene soltanto questi plugin e ne indica il numero. È un buon punto di partenza per fare pulizia. Deplug si limita a segnalarli: quale copia tenere lo decidi tu.

## Plugin danneggiati

Un plugin che non può essere caricato riceve il badge **Danneggiato**. Deplug segnala un file plugin da zero byte, una cartella plugin vuota e un bundle (`.vst3`, `.aaxplugin`, `.component`, `.vst`) il cui binario dentro `Contents` manca o ha dimensione zero. Passa il mouse sul badge per vedere il motivo. Vengono controllate solo le dimensioni dei file, mai il loro contenuto.

La casella **Mostra solo i plugin danneggiati** nella barra degli strumenti tiene soltanto questi plugin e ne indica il numero. Si possono selezionare e disinstallare come qualsiasi altro plugin.

## Selezionare più plugin

Ogni riga ha una casella nella prima colonna.

- Fai clic sulla casella per selezionare un plugin. Con la casella a fuoco, **Spazio** fa lo stesso.
- **Maiusc+clic** su una seconda casella seleziona (o deseleziona) l'intero intervallo tra le due, all'interno di una sezione.
- La casella nell'intestazione di una sezione seleziona tutti i plugin mostrati in quel momento nella sezione. I plugin nascosti (da ricerca, formato o duplicati) non vengono mai selezionati.
- **Esc** annulla la selezione.

Finché qualcosa è selezionato, una barra in basso mostra "Selezionati: N" con **Disinstalla selezionati** e **Deseleziona**.

## Aprire la cartella di un plugin

Ogni riga inizia con un pulsante a forma di cartella. Apre nel file manager la cartella che contiene il plugin. Usalo per controllare cosa c'è prima di disinstallare.

## Disinstallare un plugin {#uninstall-a-plugin}

1. Premi il pulsante del cestino sulla riga del plugin, oppure seleziona più plugin e premi **Disinstalla selezionati**. Si apre una finestra di conferma con il nome del plugin (o l'elenco dei plugin).
2. Su Windows, decidi se creare un punto di ripristino (sezione successiva).
3. Premi **Sposta nel cestino**. I plugin finiscono nel cestino di sistema e l'elenco si aggiorna.

Non succede nulla finché non confermi, e **Annulla** (o Esc) chiude la finestra senza toccare niente.

Deplug rimuove soltanto il file o il bundle del plugin. Non elimina preset, file di licenza, campioni o impostazioni che l'installer del plugin ha messo altrove. È voluto: spesso sono condivisi con altri prodotti o servono se reinstalli in seguito.

### Disinstallare più plugin insieme

Con più plugin, Deplug crea **un solo** punto di ripristino per l'intero gruppo, poi sposta i plugin nel cestino uno dopo l'altro. Se uno non riesce, gli altri proseguono. Alla fine la finestra elenca l'esito di ogni plugin (**Spostato nel cestino** oppure **Non riuscito**, con il motivo), con quelli falliti in cima. Chiudila e l'elenco si aggiorna.

Per annullare, apri il cestino e ripristina l'elemento nella posizione originale, poi premi aggiorna in Deplug.

### Il disinstallatore del produttore e le cartelle residue

Quando disinstalli **un solo** plugin, Deplug cerca in background anche due extra facoltativi. Se non trova nulla (o la ricerca fallisce, o sei su Linux) la finestra resta identica a prima. Le cartelle residue sono proposte solo per un singolo plugin; il disinstallatore del produttore è proposto anche nelle disinstallazioni multiple (vedi sotto).

- **Il disinstallatore del produttore.** Se il plugin è stato installato con un normale installer, la finestra lo segnala e ti lascia scegliere tra **Sposta solo i file nel cestino** (predefinito) ed **Esegui il disinstallatore del produttore**. La seconda scelta mostra prima il comando esatto e il pulsante di conferma diventa **Esegui il disinstallatore**. Avvia un programma del produttore, che può chiedere i permessi di amministratore e rimuovere più del solo plugin; Deplug ne attende la fine. Su macOS, se il plugin viene da un pacchetto di installazione, la finestra mostra solo l'id del pacchetto: Deplug non può eseguirlo, quindi i file vengono spostati nel cestino.
- **Cartelle residue.** Una sezione compressa **Cartelle residue** elenca le cartelle di dati che il produttore potrebbe aver lasciato (preset, licenze, impostazioni), con la dimensione. **Nessuna è selezionata in partenza.** Spunta quelle che vuoi eliminare: vengono spostate nel cestino prima della rimozione del plugin. Attenzione: possono contenere preset o licenze che ti servono ancora.

Se qualcosa non riesce, la finestra termina con un riepilogo di cosa è stato fatto e cosa no. Se il disinstallatore del produttore termina ma il plugin è ancora presente, Deplug te lo dice e non lo tocca.

**Nelle disinstallazioni multiple.** Deplug cerca il disinstallatore del produttore per ogni plugin selezionato. I plugin che portano allo stesso disinstallatore vengono raggruppati e ogni gruppo è proposto una sola volta, ad esempio **Esegui il disinstallatore del produttore per Voxengo SPAN (3 plugin selezionati)**; il comando esatto compare quando lo selezioni. In partenza nulla è selezionato e tutto viene spostato nel cestino come prima. Per ogni gruppo selezionato Deplug esegue quel disinstallatore una volta, un gruppo dopo l'altro, e ne attende la fine. Poi controlla i plugin del gruppo: un plugin risulta rimosso solo se non c'è più, altrimenti compare come **Ancora presente** e non viene toccato. Se il disinstallatore non riesce, tutti i plugin del suo gruppo risultano non riusciti. I plugin che non hai selezionato vengono spostati nel cestino.

## Punto di ripristino su Windows

Su Windows la finestra ha una casella attiva di default (il valore iniziale si cambia nelle [Impostazioni](/it/settings#uninstall)): **Crea un punto di ripristino di sistema prima di disinstallare**. È la stessa rete di sicurezza offerta da Revo Uninstaller. Se dopo aver rimosso un plugin qualcosa nel sistema non va, puoi tornare indietro con Ripristino configurazione di sistema di Windows.

Windows chiede i permessi di amministratore per creare un punto di ripristino (richiesta UAC), perché è una modifica a livello di sistema. La casella non compare su macOS e Linux.

### Perché la creazione può non riuscire {#why-creating-a-restore-point-can-fail}

Se non riesce, Deplug mostra il motivo e chiede se **continuare senza punto di ripristino**. Decidi tu: niente viene rimosso di nascosto.

- **L'UAC è stato rifiutato o annullato.** La richiesta di amministratore è stata chiusa o negata. Ripeti la disinstallazione e accettala.
- **La Protezione sistema è disattivata.** Windows crea punti di ripristino solo per le unità con la Protezione sistema attiva. Apri "Crea un punto di ripristino" dal menu Start, seleziona l'unità di sistema, premi **Configura** e attiva la protezione.
- **Windows ne ha già creato uno nelle ultime 24 ore.** Per impostazione predefinita Windows consente un solo punto di ripristino automatico ogni 24 ore e Deplug non può aggirare il limite. Se rimuovi i plugin in momenti separati, il primo punto di ripristino copre il resto della giornata: continua senza crearne un altro.

Con più plugin la domanda è una sola: se il punto di ripristino non riesce, decidi se continuare per tutti i plugin selezionati.

Per gli altri errori viene mostrato il messaggio restituito da Windows PowerShell.
