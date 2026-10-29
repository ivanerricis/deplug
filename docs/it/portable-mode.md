# Modalità portatile

La modalità portatile permette di usare Deplug senza installarlo e di tenere i suoi dati accanto all'app, ad esempio su una chiavetta USB.

Si attiva con un file marcatore chiamato `portable.txt` posto accanto all'eseguibile. Ogni download portatile lo contiene già. Elimina il file per tornare al salvataggio normale nel profilo di sistema.

Quando la modalità portatile è attiva:

- le impostazioni vengono salvate in una cartella `PluginUninstaller-data` accanto all'app;
- l'app sposta in quella cartella i dati e le cache della web view, dove la piattaforma lo permette;
- il pannello delle impostazioni mostra "Modalità portatile" e il percorso della cartella dati.

Se la cartella accanto all'app non è scrivibile (disco in sola lettura, posizione protetta), Deplug torna al salvataggio normale e mostra un avviso.

## Windows

1. Scarica `*_portable.zip` dalle [Release](https://github.com/ivanerricis/deplug/releases).
2. Estrailo dove vuoi, anche su una chiavetta USB.
3. Avvia l'`.exe` all'interno. `portable.txt` deve restare nella stessa cartella.

## Linux {#linux}

1. Scarica `*_portable.tar.gz` ed estrailo. La cartella contiene un'`.AppImage` (già eseguibile) e `portable.txt`.
2. Avvia l'`.AppImage`.

Le AppImage richiedono **FUSE 2**. Se non parte, installa `libfuse2` (su Ubuntu 24.04 il pacchetto è `libfuse2t64`), oppure avviala senza FUSE:

```bash
./Deplug*.AppImage --appimage-extract-and-run
```

## macOS

1. Scarica `*_portable.zip` ed estrailo. Tieni l'app e `portable.txt` nella stessa cartella.
2. L'app non è notarizzata, quindi rimuovi una volta il flag di quarantena:

```bash
xattr -dr com.apple.quarantine "Deplug.app"
```

Senza questo passaggio macOS esegue l'app tramite **App Translocation**: la copia in una posizione casuale in sola lettura, dove `portable.txt` non si trova, quindi Deplug parte in modalità normale e mostra un avviso.

## Cosa lascia comunque delle tracce

La modalità portatile tiene i dati di Deplug in un solo posto, ma non può controllare il sistema operativo:

- **Windows:** WebView2 può comunque scrivere dump di crash fuori dalla cartella dati.
- **macOS:** le cache e l'archiviazione di WebKit di sistema stanno nella libreria dell'utente.
- **Tutti i sistemi:** i file spostati nel cestino restano nel cestino di sistema finché non lo svuoti, e su Windows il punto di ripristino è conservato dal sistema, non dall'app.
- Su Windows e macOS, in modalità portatile posizione e dimensione della finestra non vengono ricordate, perché si scriverebbe fuori dalla cartella dati.
