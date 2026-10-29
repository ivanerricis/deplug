import { defineConfig, type DefaultTheme } from 'vitepress'

const repo = 'https://github.com/ivanerricis/deplug'

type Labels = {
  guide: string
  usage: string
  reference: string
  gettingStarted: string
  using: string
  customFolders: string
  portable: string
  settings: string
  faq: string
  safety: string
  building: string
}

function sidebar(prefix: string, l: Labels): DefaultTheme.Sidebar {
  return [
    {
      text: l.guide,
      items: [
        { text: l.gettingStarted, link: `${prefix}/getting-started` },
        { text: l.using, link: `${prefix}/using-deplug` },
        { text: l.customFolders, link: `${prefix}/custom-folders` },
        { text: l.portable, link: `${prefix}/portable-mode` },
        { text: l.settings, link: `${prefix}/settings` },
      ],
    },
    {
      text: l.reference,
      items: [
        { text: l.faq, link: `${prefix}/faq` },
        { text: l.safety, link: `${prefix}/safety-and-privacy` },
        { text: l.building, link: `${prefix}/building-from-source` },
      ],
    },
  ]
}

const en: Labels = {
  guide: 'Guide',
  usage: 'Using Deplug',
  reference: 'Reference',
  gettingStarted: 'Getting started',
  using: 'Using Deplug',
  customFolders: 'Custom folders',
  portable: 'Portable mode',
  settings: 'Settings',
  faq: 'FAQ and troubleshooting',
  safety: 'Safety and privacy',
  building: 'Building from source',
}

const it: Labels = {
  guide: 'Guida',
  usage: 'Usare Deplug',
  reference: 'Riferimenti',
  gettingStarted: 'Per iniziare',
  using: 'Usare Deplug',
  customFolders: 'Cartelle personalizzate',
  portable: 'Modalità portatile',
  settings: 'Impostazioni',
  faq: 'FAQ e risoluzione problemi',
  safety: 'Sicurezza e privacy',
  building: 'Compilare dai sorgenti',
}

export default defineConfig({
  title: 'Deplug',
  base: '/deplug/',
  cleanUrls: true,
  lastUpdated: false,
  srcExclude: ['README.md'],
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/deplug/favicon.svg' }],
    ['meta', { name: 'theme-color', content: '#14161A' }],
  ],
  sitemap: { hostname: 'https://ivanerricis.github.io/deplug/' },

  themeConfig: {
    logo: { light: '/logo-light.svg', dark: '/logo-dark.svg', alt: 'Deplug' },
    socialLinks: [{ icon: 'github', link: repo }],
    search: { provider: 'local' },
    editLink: { pattern: `${repo}/edit/main/docs/:path` },
    footer: { message: '', copyright: '© 2026 Ivan Erricis. All rights reserved.' },
  },

  locales: {
    root: {
      label: 'English',
      lang: 'en',
      description:
        'Find installed audio plugins (VST2, VST3, AAX, AU) and uninstall them safely, to the system trash.',
      themeConfig: {
        nav: [
          { text: 'Guide', link: '/getting-started', activeMatch: '^/(getting-started|using-deplug|custom-folders|portable-mode|settings)' },
          { text: 'FAQ', link: '/faq' },
          { text: 'Releases', link: `${repo}/releases` },
        ],
        sidebar: sidebar('', en),
        editLink: { pattern: `${repo}/edit/main/docs/:path`, text: 'Edit this page on GitHub' },
      },
    },
    it: {
      label: 'Italiano',
      lang: 'it',
      link: '/it/',
      description:
        'Trova i plugin audio installati (VST2, VST3, AAX, AU) e disinstallali in sicurezza, nel cestino di sistema.',
      themeConfig: {
        nav: [
          { text: 'Guida', link: '/it/getting-started', activeMatch: '^/it/(getting-started|using-deplug|custom-folders|portable-mode|settings)' },
          { text: 'FAQ', link: '/it/faq' },
          { text: 'Release', link: `${repo}/releases` },
        ],
        sidebar: sidebar('/it', it),
        editLink: { pattern: `${repo}/edit/main/docs/:path`, text: 'Modifica questa pagina su GitHub' },
        docFooter: { prev: 'Pagina precedente', next: 'Pagina successiva' },
        outline: { label: 'In questa pagina' },
        returnToTopLabel: 'Torna su',
        sidebarMenuLabel: 'Menu',
        darkModeSwitchLabel: 'Aspetto',
        lightModeSwitchTitle: 'Passa al tema chiaro',
        darkModeSwitchTitle: 'Passa al tema scuro',
        langMenuLabel: 'Cambia lingua',
        skipToContentLabel: 'Vai al contenuto',
        notFound: {
          title: 'Pagina non trovata',
          quote: 'Questa pagina non esiste (più).',
          linkLabel: 'Torna alla home',
          linkText: 'Torna alla home',
        },
        search: {
          provider: 'local',
          options: {
            translations: {
              button: { buttonText: 'Cerca', buttonAriaLabel: 'Cerca' },
              modal: {
                noResultsText: 'Nessun risultato per',
                resetButtonTitle: 'Cancella la ricerca',
                backButtonTitle: 'Chiudi la ricerca',
                displayDetails: 'Mostra i dettagli',
                footer: {
                  selectText: 'per selezionare',
                  navigateText: 'per spostarsi',
                  closeText: 'per chiudere',
                },
              },
            },
          },
        },
      },
    },
  },
})
