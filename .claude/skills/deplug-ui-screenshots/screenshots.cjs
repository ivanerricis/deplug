// Screenshots of the Deplug UI against a mocked Tauri backend. See SKILL.md in this folder.
const { chromium } = require('/opt/node-tools/node_modules/playwright')
const env = process.env
const PORT = env.PORT || '5201'
const OUT = (env.OUT || '/tmp/deplug-shots').replace(/\/?$/, '/')
const WIDTHS = (env.WIDTHS || '900').split(',').map(Number)
const LANGS = (env.LANGS || 'en').split(',')
const SCHEMES = (env.SCHEMES || 'light,dark').split(',')
const ACTION = env.ACTION || 'none'
const FIRST_RUN = env.FIRST_RUN === '1'
const EMPTY = env.EMPTY === '1'
const UAS = {
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  linux: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
}
const UA = UAS[env.UA || 'windows']

const mock = `(() => {
  const FIRST_RUN = ${FIRST_RUN}, EMPTY = ${EMPTY}
  let settings = { version: 1, customScanPaths: [], language: 'system', theme: 'system', restorePointDefault: true,
    scanOnStartup: !FIRST_RUN, customScanDepth: 6, disabledSystemPaths: [], runAsAdmin: false, welcomeSeen: !FIRST_RUN }
  const PF = 'C:/Program Files', CF = 'C:/Program Files/Common Files'
  const dirs = EMPTY ? {} : {
    [PF + '/VstPlugins']: ['Serum.dll', 'Kontakt 7.dll', 'FabFilter Pro-Q 3.dll', 'Valhalla Room.dll', 'SPAN.dll'],
    [CF + '/VST3']: ['FabFilter Pro-Q 3.vst3', 'Serum.vst3', 'Valhalla VintageVerb.vst3', 'Pro-L 2.vst3', 'Kontakt.vst3', 'OTT.vst3'],
    [CF + '/Avid/Audio/Plug-Ins']: ['Pro-Q 3.aaxplugin', 'Serum.aaxplugin', 'SPAN.aaxplugin'],
    [CF + '/CLAP']: ['Surge XT.clap', 'Vital.clap', 'Pentagrit.clap', 'Dexed.clap'],
  }
  const norm = p => (p || '').split(String.fromCharCode(92)).join('/')
  window.__log = []
  window.__TAURI_INTERNALS__ = {
    metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main', windowLabel: 'main' } },
    transformCallback: cb => { const id = Math.floor(Math.random() * 1e9); window['_' + id] = cb; return id },
    convertFileSrc: p => p,
    invoke: async (cmd, args) => {
      window.__log.push(cmd)
      switch (cmd) {
        case 'get_settings': return settings
        case 'save_settings': settings = args.settings; return null
        case 'app_info': return { portable: false, dataDir: null, portableWarning: null, elevated: false, osInfo: 'x86_64 / windows' }
        case 'plugin:app|version': return '0.1.0'
        case 'system_paths': return { programFiles: 'C:/Program Files', programFilesX86: 'C:/Program Files (x86)', commonProgramFiles: 'C:/Program Files/Common Files', commonProgramFilesX86: 'C:/Program Files (x86)/Common Files', programData: 'C:/ProgramData', localAppData: 'C:/Users/ivan/AppData/Local' }
        case 'plugin:path|resolve_directory': return 'C:/Users/ivan'
        case 'plugin:fs|exists': return !!dirs[norm(args.path)]
        case 'plugin:fs|read_dir': return (dirs[norm(args.path)] || []).map(n => ({ name: n, isDirectory: /\.(vst3|aaxplugin)$/.test(n), isFile: !/\.(vst3|aaxplugin)$/.test(n), isSymlink: false }))
        case 'plugin_meta': return (args.paths || []).map(p => ({ path: p, size: 5e6, modified: 1.7e9, arch: 'x64', health: 'ok' }))
        default: return null
      }
    },
  }
})();`

;(async () => {
  const browser = await chromium.launch()
  for (const lang of LANGS) for (const scheme of SCHEMES) for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: 620 }, colorScheme: scheme, locale: lang, userAgent: UA })
    const page = await ctx.newPage()
    page.on('pageerror', e => console.log('PAGEERROR', e.message))
    await page.addInitScript(mock)
    await page.goto('http://localhost:' + PORT)
    await page.waitForTimeout(1200)
    if (ACTION.startsWith('settings:')) {
      await page.getByRole('button', { name: /^(Settings|Impostazioni)/ }).first().click()
      const tab = ACTION.split(':')[1]
      const names = { general: /General|Generale/, scan: /Scan|Scansione/, uninstall: /Uninstall|Disinstallazione/, about: /About|Informazioni/ }
      await page.getByRole('tab', { name: names[tab] }).click()
    } else if (ACTION.startsWith('tab:')) {
      await page.getByRole('tab', { name: new RegExp(ACTION.split(':')[1]) }).click()
    }
    await page.waitForTimeout(500)
    const name = [ACTION.replace(':', '-'), lang, scheme, width].join('-')
    await page.screenshot({ path: OUT + name + '.png' })
    await ctx.close()
  }
  await browser.close()
})()
