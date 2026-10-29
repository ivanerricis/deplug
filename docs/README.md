# Deplug documentation

The site is built with [VitePress](https://vitepress.dev) and published to
<https://ivanerricis.github.io/deplug/> by `.github/workflows/docs.yml`.
This folder is self-contained: it has its own `package.json`.

```bash
cd docs
npm ci
npm run dev       # dev server with hot reload
npm run build     # production build into .vitepress/dist
npm run preview   # serve the production build
```

Requires Node 20+ (CI uses Node 24).

## Layout

- `index.md`, `getting-started.md`, ... are the English pages (root locale).
- `it/` mirrors the same structure in Italian. Keep file names identical.
- `.vitepress/config.mts` holds the shared config, both locales, nav and sidebar.
- `.vitepress/theme/` holds the brand overrides (Ink `#14161A`, Signal `#FF5C39`).
- `public/` holds the logo, favicon and hero image, copied from `assets/brand/`.

When you add a page, add it to the sidebar of both locales in `config.mts`.

## Publishing

Pushes to `main` that touch `docs/**` deploy automatically. The repository owner
must enable it once: Settings, Pages, Source = GitHub Actions.
