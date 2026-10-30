# Impostazioni

Apri le impostazioni con il pulsante a forma di ingranaggio a destra nella barra degli strumenti. La finestra ha quattro sezioni, elencate sul lato: **Generali**, **Scansione**, **Disinstallazione** e **Informazioni**. Le modifiche vengono salvate subito. Chiudi la finestra con il pulsante di chiusura o con Esc.

## Generali {#general}

- **Lingua**: *Predefinita di sistema*, *English* o *Italiano*. Cambia subito tutta l'interfaccia. *Predefinita di sistema* segue la lingua del sistema operativo e, se non è né inglese né italiano, usa l'inglese.
- **Tema**: *Sistema*, *Chiaro* o *Scuro*. *Sistema* segue l'impostazione chiaro o scuro del sistema operativo.
- **Elenco**: spunta le colonne facoltative dell'elenco dei plugin: **Percorso**, **Dimensione**, **Modificato** e **Architettura** (l'etichetta 32/64 bit accanto al nome). Il nome è sempre visibile. Le colonne nascoste perdono anche l'intestazione di ordinamento e il layout si adatta senza lasciare spazi vuoti. La **Densità delle righe** è *Comoda* (predefinita) o *Compatta*, che mostra più plugin sullo schermo.
- **Ricorda l'ultima scheda e l'ordinamento**: attiva di default. Deplug salva la scheda e l'ordinamento usati per ultimi e si riapre con quelli. Disattivala per aprire sempre con le due scelte qui sotto.
- **Scheda iniziale**: *Tutti*, *VST2*, *VST3*, *AAX* o *AU*; vale quando il ricordo è disattivato.
- **Ordinamento predefinito**: la colonna (*Nome*, *Percorso*, *Dimensione* o *Modificato*) e la direzione (*Crescente* o *Decrescente*) con cui parte ogni sezione quando il ricordo è disattivato.

## Scansione {#scan}

- **Scansione all'avvio**: attiva di default. Se la disattivi, Deplug si apre con la schermata "Pronto per la scansione"; premi **Scansiona ora** (o il pulsante di nuova scansione) quando vuoi l'elenco.
- **Profondità cartelle personalizzate**: quanti livelli di sottocartelle vengono cercati nelle cartelle che aggiungi, da 1 a 10 (predefinito 6). Non vale per le cartelle di sistema standard, che sono sempre analizzate fino a tre livelli.
- **Cartelle personalizzate**: cartelle aggiuntive da scansionare, per i plugin copiati a mano. Usa **Aggiungi cartella** per sceglierne una e la croce accanto a una cartella per rimuoverla. Rimuovere una cartella non tocca mai i suoi file. Vedi [Cartelle personalizzate](/it/custom-folders).
- **Esclusioni**: nomi da saltare durante la scansione. Scrivi uno schema e premi **Aggiungi**; la croce lo rimuove. Lo schema viene confrontato con il nome intero di un plugin o di una singola cartella, senza distinguere maiuscole e minuscole e mai con il percorso completo. `*` sta per qualsiasi testo: `*Demo*` salta tutto ciò che ha "demo" nel nome, `Backup` salta cartelle o plugin chiamati esattamente Backup, `old_*` salta i nomi che iniziano con "old_". Le cartelle corrispondenti non vengono esplorate e i plugin corrispondenti non compaiono. Non esiste altra sintassi. Puoi aggiungere fino a 50 schemi di al massimo 100 caratteri; spazi vuoti e duplicati vengono ignorati.
- **Cartelle di sistema**: le posizioni standard del tuo sistema operativo, ognuna con una casella. Deseleziona quelle che non vuoi scansionare.

L'elenco dei plugin si aggiorna quando chiudi le impostazioni, se qualcosa è cambiato.

## Disinstallazione {#uninstall}

- **Crea un punto di ripristino per impostazione predefinita**: stabilisce se la casella del punto di ripristino parte spuntata nella finestra di disinstallazione. Puoi comunque cambiarla a ogni disinstallazione. I punti di ripristino esistono solo su Windows; su macOS e Linux l'impostazione non ha effetto e la finestra lo segnala.
- **Metodo di eliminazione**: **Sposta nel cestino** (predefinito) mantiene recuperabili i plugin rimossi. **Elimina definitivamente** rimuove i file per sempre: non passano dal cestino e un punto di ripristino del sistema non li copre. Le cartelle residue che scegli di rimuovere seguono la stessa impostazione.
- **Chiedi conferma prima di disinstallare** (attiva per impostazione predefinita): se disattivata, Disinstalla parte subito con le tue impostazioni predefinite (punto di ripristino, metodo di eliminazione) e mostra la finestra del risultato. Il disinstallatore dell'editore e le cartelle residue non vengono mai scelti in automatico. Deplug chiede sempre conferma quando il metodo di eliminazione è **Elimina definitivamente**, qualunque sia questa impostazione.
- **Esegui sempre Deplug come amministratore** (solo Windows, attiva per impostazione predefinita): Windows chiede il permesso a ogni avvio di Deplug. I plugin nelle cartelle protette si possono poi rimuovere senza altre richieste, e anche i programmi avviati da Deplug (come il disinstallatore di un editore) vengono eseguiti con i diritti di amministratore. Ha effetto al prossimo avvio di Deplug. Disattivala se preferisci non vedere la richiesta di Windows a ogni avvio; se rifiuti la richiesta, Deplug si avvia normalmente senza diritti di amministratore. La sezione Informazioni mostra se la sessione attuale li ha.

## Informazioni {#about}

La sezione Informazioni mostra il nome dell'app, la **Versione** e la **Modalità** (*Standard* o *Portatile*). In modalità portatile indica anche la **Cartella dei dati** e un avviso se la modalità portatile non è partita, ad esempio perché la cartella è in sola lettura. Vedi [Modalità portatile](/it/portable-mode).

In **Aggiornamenti**:

- **Cerca aggiornamenti all'avvio** (disattivato per impostazione predefinita): al massimo una volta al giorno, dopo la prima scansione, Deplug chiede a GitHub se esiste una versione più recente. In caso positivo compare un piccolo punto sul pulsante delle impostazioni e un avviso in cima a questa sezione rimanda alla release; nulla viene scaricato o installato da solo. Gli errori sono silenziosi. L'ora dell'ultima verifica è salvata in `settings.json`, quindi funziona anche in modalità portatile.
- **Canale di aggiornamento**: *Stabile* (predefinito) propone solo le versioni definitive; *Pre-release* propone anche le release candidate. L'installazione automatica gestisce solo le versioni stabili, quindi per una pre-release Deplug mostra un suggerimento e il pulsante **Apri la pagina della release**.

**Controlla aggiornamenti** cerca una versione pubblicata più recente. Su una copia normale (installata) Deplug può poi scaricarla e installarla per te: premi **Scarica e installa**, segui la barra di avanzamento, poi premi **Riavvia ora**. Gli aggiornamenti sono verificati con una firma prima dell'installazione. Se l'aggiornamento nell'app non è disponibile per la tua installazione (ad esempio alcuni pacchetti Linux), oppure usi una copia [portatile](/it/portable-mode), che non si aggiorna mai da sola perché le copie portatili si sostituiscono a mano, il pulsante **Apri la pagina della release** ti porta al download.

Contiene inoltre:

- i collegamenti a **Pagina GitHub**, **Documentazione**, **Segnala un problema** e **Note di rilascio**, che si aprono nel browser;
- **Copia diagnostica**, che mette negli appunti versione dell'app, sistema operativo (nome, architettura e user agent della web view), modalità, diritti di amministratore (solo Windows), un riepilogo delle impostazioni (lingua, tema, opzioni di disinstallazione e aggiornamento), le cartelle analizzate, il numero di plugin per formato e architettura e gli ultimi 20 errori dell'app (ora, area e messaggio), pronti da incollare in una segnalazione. Non contiene nomi di plugin;
- l'avviso di licenza.

## Dove vengono salvate le impostazioni

Tutto quanto sopra sta in un unico file `settings.json`. La sua posizione, e come azzerarlo, sono nelle [FAQ](/it/faq#where-does-deplug-store-its-data).
