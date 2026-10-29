# Cartelle personalizzate

Molti plugin non vengono installati da un installer. Scarichi uno ZIP, copi un `.vst3` o un `.dll` in una cartella qualsiasi (`D:\Audio\Plugins`, `~/Musica/Plugins`, la cartella di un progetto) e indichi quella cartella al tuo DAW. Questi plugin sono invisibili alla scansione delle cartelle standard.

Una **cartella di scansione personalizzata** dice a Deplug di guardare anche lì.

## Aggiungere una cartella

1. Apri le **Impostazioni** (il pulsante a forma di ingranaggio nella barra degli strumenti) e vai su **Scansione**.
2. In **Cartelle personalizzate** premi **Aggiungi cartella** e sceglila nella finestra di sistema.
3. Chiudi le impostazioni. Deplug ripete la scansione e i plugin trovati nella nuova cartella compaiono nelle sezioni dei rispettivi formati.

Per togliere una cartella usa la croce accanto ad essa. La cartella e i suoi file non vengono mai toccati: Deplug smette soltanto di cercarvi.

## Come vengono analizzate

- Le sottocartelle sono esplorate di default fino a **sei livelli**, più dei tre usati per le cartelle standard, perché le librerie organizzate a mano sono spesso molto annidate. Si cambia con **Profondità cartelle personalizzate** nelle Impostazioni, da 1 a 10, e vale per tutte le cartelle personalizzate.
- Un plugin trovato sia da una cartella standard sia da una personalizzata compare una volta sola.
- Una cartella personalizzata che non esiste più (ad esempio un disco scollegato) viene saltata senza errori.
- Valgono le stesse regole sui formati: `.vst3` e `.aaxplugin` ovunque, `.dll` su Windows, `.vst` e `.component` su macOS, `.so` su Linux.

## Dove viene salvato l'elenco

Le cartelle sono memorizzate nel file `settings.json` di Deplug, nel profilo di sistema per un'installazione normale oppure nella cartella dati accanto all'app in [modalità portatile](/it/portable-mode). Vedi [dove vengono salvati i dati](/it/faq#where-does-deplug-store-its-data).

## Disinstallare da una cartella personalizzata

Funziona come per qualsiasi altro plugin: conferma e poi cestino di sistema. Deplug rifiuta i percorsi che non sono un file o un bundle di plugin, quindi una cartella personalizzata puntata per errore su qualcosa di grande, come la tua cartella utente, non può essere cancellata. Vedi [Sicurezza e privacy](/it/safety-and-privacy).
