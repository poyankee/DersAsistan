// Uygulama içi güncelleme için arayüz paketi (web-N.zip) ve sürüm dosyası (surum.json) üretir.
// Kullanım: GITHUB_RUN_NUMBER=36 node scripts/make-update.mjs <çıktı klasörü>
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { zipSync } from 'fflate'

const out = process.argv[2] ?? 'update'
const build = Number(process.env.GITHUB_RUN_NUMBER ?? 0)
if (!build) throw new Error('GITHUB_RUN_NUMBER yok')

const version = readFileSync('src/lib/version.ts', 'utf8')
const appVersion = version.match(/APP_VERSION = '([^']+)'/)[1]
const nativeLevel = Number(version.match(/NATIVE_LEVEL = (\d+)/)[1])
const javaLevel = Number(readFileSync('android/app/src/main/java/com/dersasistani/app/UpdaterPlugin.java', 'utf8').match(/NATIVE_LEVEL = (\d+)/)[1])
if (nativeLevel !== javaLevel) throw new Error(`NATIVE_LEVEL uyuşmuyor: arayüz ${nativeLevel}, Android ${javaLevel}`)
// Sürüm notları: CHANGELOG'daki ilk sürümün maddeleri
const notes = [...(version.split("items: [")[1] ?? '').split(']')[0].matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1].replace(/\\'/g, "'"))

const files = {}
const walk = (dir) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) walk(p)
    else files[relative('dist', p).split('\\').join('/')] = readFileSync(p)
  }
}
walk('dist')
if (!files['index.html']) throw new Error('dist/index.html yok; önce npm run build')
const zip = zipSync(files, { level: 9 })
mkdirSync(out, { recursive: true })
const webFile = `web-${build}.zip`
writeFileSync(join(out, webFile), zip)
const manifest = {
  build,
  version: `${appVersion}.${build}`,
  tag: `v${appVersion}.${build}`,
  nativeLevel,
  web: { file: webFile, sha256: createHash('sha256').update(zip).digest('hex'), size: zip.length },
  apk: { file: 'DersAsistani.apk' },
  notes,
}
writeFileSync(join(out, 'surum.json'), JSON.stringify(manifest, null, 2))
console.log(`Güncelleme paketi: ${webFile} (${Math.round(zip.length / 1024)} KB), sürüm ${manifest.version}, yerel düzey ${nativeLevel}`)
