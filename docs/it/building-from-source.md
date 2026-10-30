# Compilare dai sorgenti

Deplug è un'app [Tauri 2](https://tauri.app) con front end React e TypeScript e back end Rust.

## Prerequisiti

- **Node.js 24** o successivo, con npm.
- **Rust** (stable), tramite [rustup](https://rustup.rs).
- I [prerequisiti di Tauri](https://tauri.app/start/prerequisites/) per il tuo sistema:
  - Windows: Microsoft C++ Build Tools e WebView2.
  - macOS: Xcode Command Line Tools.
  - Linux: `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf` e una toolchain C.

## Ottenere il codice

```bash
git clone https://github.com/ivanerricis/deplug.git
cd deplug
npm ci
```

## Script

| Comando | Cosa fa |
| --- | --- |
| `npm run dev` | Solo il front end, nel browser (le API Tauri non sono disponibili) |
| `npm run tauri dev` | L'app desktop completa con ricarica a caldo |
| `npm run typecheck` | Controllo TypeScript senza generare file |
| `npm test` | Test unitari del front end (Vitest) |
| `npm run build` | Controllo dei tipi e build di produzione del front end in `dist/` |
| `npm run tauri build` | Installer di produzione per il tuo sistema |

I test Rust stanno accanto al codice:

```bash
cargo test --manifest-path src-tauri/portable-core/Cargo.toml
cd src-tauri && cargo test && cargo clippy --all-targets -- -D warnings
```

## Integrazione continua

`.github/workflows/ci.yml` gira a ogni pull request e a ogni push su `main`:

1. front end: typecheck, test e build Vite;
2. Tauri su Ubuntu, Windows e macOS: build del front end e Clippy con gli avvisi trattati come errori;
3. il crate `portable-core`: test e `cargo fmt --check`.

## Release

Il push di un tag `vX.Y.Z` avvia `.github/workflows/release.yml`. Per prima cosa verifica che le versioni in `package.json`, `src-tauri/Cargo.toml` e `src-tauri/tauri.conf.json` coincidano con il tag, poi compila gli installer per Windows, macOS (universale) e Linux, prepara le versioni portatili e allega tutto a una release **bozza**. I tag con suffisso come `v0.1.0-rc.1` creano una pre-release. Controlla la bozza e pubblicala a mano.

### Aggiornamenti nell'app (configurazione una tantum)

Le copie installate si aggiornano con l'updater di Tauri. Le build di release firmano gli artefatti dell'updater, quindi il repository ha bisogno di una coppia di chiavi:

1. Esegui `npx tauri signer generate` (senza password). Tieni la chiave privata fuori dal repository.
2. Salva la chiave privata nel secret del repository `TAURI_SIGNING_PRIVATE_KEY`. `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` serve solo se hai impostato una password.
3. Inserisci la chiave pubblica in `plugins.updater.pubkey` in `src-tauri/tauri.conf.json`.

Il workflow di release si ferma subito con un messaggio chiaro se il secret manca e carica `latest.json` e i file `.sig` insieme agli installer. L'app legge `https://github.com/ivanerricis/deplug/releases/latest/download/latest.json`, che esiste solo per le release **pubblicate**: una bozza o una pre-release non viene proposta dall'updater (il controllo manuale in Informazioni elenca comunque le pre-release). Pubblica la bozza per distribuire l'aggiornamento. Perdere o sostituire la chiave significa che le copie già installate non potranno più verificare i nuovi aggiornamenti e andranno reinstallate a mano.

## Questa documentazione

Il sito della documentazione si trova in `docs/` ed è costruito con VitePress. Vedi `docs/README.md`.
