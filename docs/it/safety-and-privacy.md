# Sicurezza e privacy

## Niente lascia il tuo computer da solo

Deplug non ha account, né analisi d'uso, né telemetria, né controllo automatico degli aggiornamenti. Analizza cartelle locali e te ne mostra il risultato. L'unica richiesta di rete che può fare è il pulsante **Controlla aggiornamenti** in Impostazioni → Informazioni, che parte solo quando lo premi e legge soltanto l'elenco pubblico delle release su GitHub; non viene inviato nulla sul tuo computer o sui tuoi plugin. Se poi scegli di installare un aggiornamento, l'installer firmato viene scaricato da GitHub e la firma è verificata prima dell'esecuzione. L'unica cosa che scrive è un piccolo `settings.json` ([dove](/it/faq#where-does-deplug-store-its-data)).

## I file vanno nel cestino

La disinstallazione usa il cestino del sistema operativo: Cestino su Windows, Cestino su macOS, il cestino del desktop su Linux. Deplug non elimina nulla in modo definitivo. Per annullare una rimozione, ripristina l'elemento dal cestino.

## Ogni rimozione va confermata

Deplug non rimuove mai nulla in blocco o in background. Scegli un plugin, leggi il suo percorso completo nella finestra e confermi.

## I percorsi vengono validati

Prima di spostare qualcosa nel cestino, il backend ricontrolla il percorso e lo rifiuta a meno che **tutte** queste condizioni siano vere:

- è un percorso assoluto senza parti `..`;
- non è la radice del file system né la tua cartella utente, e non è sospettosamente corto;
- il nome termina con un'estensione di plugin: `.dll`, `.vst`, `.vst3`, `.aaxplugin`, `.component` o `.so`;
- esiste ancora.

Quindi, anche se una cartella personalizzata punta a qualcosa di grande, Deplug può mettere nel cestino solo un singolo file o bundle di plugin, mai una cartella dei tuoi documenti.

## Il disinstallatore del produttore e i residui

Per un singolo plugin Deplug può proporre di eseguire il **disinstallatore che il produttore ha registrato** nel sistema. È l'unico caso in cui Deplug avvia un altro programma, e non succede mai da solo: la finestra mostra il comando esatto, spiega che il programma può chiedere i permessi di amministratore e lo esegue solo se scegli quell'opzione e premi **Esegui il disinstallatore**. Deplug non esegue comandi che ritiene non sicuri.

Le **cartelle residue** sono solo suggerimenti trovati in un insieme fisso di posizioni dati per utente e condivise. Sono deselezionate in partenza e vanno nel cestino come tutto il resto; il backend rifiuta qualsiasi cartella che non abbia ricavato lui stesso per quel plugin.

## Punti di ripristino

Su Windows il punto di ripristino facoltativo è creato da `Checkpoint-Computer` di Windows PowerShell in un processo con privilegi elevati, dopo la consueta richiesta UAC. La descrizione viene ripulita prima di essere passata. Deplug chiede l'elevazione solo per questo passaggio e non conserva mai i diritti di amministratore.

## Build non firmate

Le release sono compilate da workflow pubblici di GitHub Actions a partire dal sorgente taggato, ma non sono firmate digitalmente. Vedi le [FAQ](/it/faq#windows-says-the-app-is-from-an-unknown-publisher) per gli avvisi che ne derivano. Scarica solo dalla pagina ufficiale delle Release.
