// Uçtan uca testler: gerçek tarayıcıda ana akışlar. Çalıştırma: npm run build && npm run e2e
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { cpSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

const PORT = 4188
const BASE = `http://localhost:${PORT}/`
const FIXTURE = fileURLToPath(new URL('./fixtures/program.xls', import.meta.url))
const ICS = fileURLToPath(new URL('./fixtures/google.ics', import.meta.url))

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
const stop = () => server.kill()
process.on('exit', stop)

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE)).ok) return
    } catch {
      /* henüz hazır değil */
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error('Önizleme sunucusu başlamadı')
}

// Eşitleme testi için gerçek PHP sunucusu (PHP yoksa o test atlanır)
const SYNC_PORT = 4189
let php = null
let SYNC_DIR = ''
try {
  execSync('php -r "exit(in_array(\'sqlite\', PDO::getAvailableDrivers()) ? 0 : 1);"', { stdio: 'ignore' })
  const dir = mkdtempSync(join(tmpdir(), 'ders-sunucu-'))
  SYNC_DIR = dir
  cpSync(fileURLToPath(new URL('../server', import.meta.url)), dir, { recursive: true })
  writeFileSync(join(dir, 'ayarlar.php'), `<?php\n$DATA_DIR = ${JSON.stringify(join(dir, 'veri'))};\n$ALLOWED_ORIGINS[] = 'http://localhost:${PORT}';\n`)
  php = spawn('php', ['-S', `127.0.0.1:${SYNC_PORT}`, '-t', dir], { stdio: 'ignore' })
  process.on('exit', () => php?.kill())
} catch {
  php = null
}

const tests = []
const test = (name, fn) => tests.push({ name, fn })

async function open(browser) {
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.clock.install({ time: new Date('2026-11-16T12:00:00') })
  await page.goto(BASE)
  await page.getByRole('button', { name: 'Başlayalım' }).click()
  const nav = (label) => page.locator('.side-nav button', { hasText: label }).first().click()
  return { page, errors, nav }
}

async function importProgram(page, nav) {
  await nav('Takvim')
  await page.getByRole('button', { name: 'Diğer seçenekler' }).click()
  await page.getByRole('button', { name: /Kurum programını yükle/ }).click()
  await page.setInputFiles('.filepick input', FIXTURE)
  await page.waitForSelector('.import-summary')
}

test('kurum programı içe aktarılır, tekrar yüklenince kopya oluşmaz', async (browser) => {
  const { page, errors, nav } = await open(browser)
  await importProgram(page, nav)
  assert.match(await page.locator('.stats').innerText(), /6\s*dosyadaki ders saati\s*6\s*yeni eklenecek/)
  await page.locator('.modal-foot .btn.primary').click()
  await page.waitForSelector('.ev')
  assert.equal(await page.locator('.ev').count(), 4) // art arda saatler birleşir: A(2 saat), B, B(2 saat), A
  await importProgram(page, nav)
  assert.match(await page.locator('.stats').innerText(), /0\s*yeni eklenecek\s*6\s*zaten kayıtlı/)
  assert.equal(await page.locator('.modal-foot .btn.primary').isDisabled(), true)
  assert.deepEqual(errors, [])
})

test('öğrenci dosyası: ders kaydı, otomatik borç, ödeme; listede tutar görünmez', async (browser) => {
  const { page, errors, nav } = await open(browser)
  await nav('Öğrenciler')
  await page.getByRole('button', { name: /Öğrenci ekle/ }).click()
  await page.locator('.modal input').first().fill('Deneme Öğrenci')
  await page.locator('.modal input[type=number]').fill('750')
  await page.getByRole('button', { name: 'Kaydet' }).click()
  assert.equal((await page.locator('.cards').innerText()).includes('₺'), false)
  await page.locator('.card').first().click()
  await page.locator('.quick-entry textarea').fill('Üslü ifadeler')
  await page.locator('.quick-entry input[placeholder="ör. Test 7"]').fill('Test 3')
  await page.locator('.quick-entry .btn.primary').click()
  assert.match(await page.locator('.log-item').first().innerText(), /16\.11\.2026[\s\S]*Üslü ifadeler[\s\S]*Ödev: Test 3/)
  // aynı güne ikinci kayıt üzerine yazmaz
  await page.locator('.quick-entry textarea').fill('Ek alıştırma')
  await page.locator('.quick-entry .btn.primary').click()
  assert.equal(await page.locator('.log-item').count(), 1)
  assert.match(await page.locator('.log-item').first().innerText(), /Üslü ifadeler[\s\S]*Ek alıştırma/)
  // ders bitince (saat ilerleyince) borç yazılır
  await page.clock.setFixedTime(new Date('2026-11-16T20:00:00'))
  await page.locator('.tabs-seg button', { hasText: 'Ödeme' }).click()
  assert.match(await page.locator('.fin-banner').innerText(), /750 ₺ borç/)
  await page.getByRole('button', { name: /Ödeme al/ }).click()
  await page.locator('.modal .chip', { hasText: 'Tüm borç' }).click()
  await page.locator('.modal-foot .btn.primary').click()
  assert.match(await page.locator('.fin-banner').innerText(), /Hesap kapalı/)
  assert.deepEqual(errors, [])
})

test('takvimde sürükleyerek taşıma ve geri alma', async (browser) => {
  const { page, errors, nav } = await open(browser)
  await importProgram(page, nav)
  await page.locator('.modal-foot .btn.primary').click()
  const ev = page.locator('.ev[title*="11:40–12:20"]').first()
  await ev.scrollIntoViewIfNeeded()
  const box = await ev.boundingBox()
  const fri = await page.locator('.tg-col').nth(4).boundingBox()
  await page.mouse.move(box.x + 20, box.y + 8)
  await page.mouse.down()
  await page.mouse.move(box.x + 40, box.y + 20, { steps: 3 })
  await page.mouse.move(fri.x + 30, box.y + 8, { steps: 8 })
  await page.mouse.up()
  assert.match(await page.locator('.toast').first().innerText(), /taşındı: 20 Kas Cum 11:40–12:20/)
  assert.equal(await page.locator('.tg-col').nth(4).locator('.ev').count(), 1)
  await page.locator('.toast button', { hasText: 'Geri al' }).click()
  assert.equal(await page.locator('.tg-col').nth(4).locator('.ev').count(), 0)
  assert.deepEqual(errors, [])
})

test('sınıf dosyasına kayıt ve genel arama', async (browser) => {
  const { page, errors, nav } = await open(browser)
  await importProgram(page, nav)
  await page.locator('.modal-foot .btn.primary').click()
  await nav('Öğrenciler')
  await page.locator('.people-tabs button', { hasText: 'Kurum' }).click()
  await page.locator('.card', { hasText: 'TEST-A' }).click()
  await page.locator('.quick-entry textarea').fill('Olasılığa giriş')
  await page.locator('.quick-entry .btn.primary').click()
  assert.match(await page.locator('.log-item').first().innerText(), /Olasılığa giriş/)
  await page.locator('.side-search').click()
  await page.locator('.search-box.big input').fill('olasil giris')
  await page.waitForSelector('.hit-list li')
  assert.match(await page.locator('.hit-list').innerText(), /Olasılığa giriş[\s\S]*16\.11\.2026/)
  assert.deepEqual(errors, [])
})

test('veri sayfa yenilenince korunur; bozuk kayıt açılışı engellemez', async (browser) => {
  const { page, errors, nav } = await open(browser)
  await importProgram(page, nav)
  await page.locator('.modal-foot .btn.primary').click()
  await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('ders-asistan-v1'))
    d.events.push({ id: 'bozuk', kind: 'kurum', date: 'yanlış', start: '09:00', end: '10:00' })
    localStorage.setItem('ders-asistan-v1', JSON.stringify(d))
  })
  await page.reload()
  await nav('Takvim')
  await page.waitForSelector('.ev')
  assert.equal(await page.locator('.ev').count(), 4)
  assert.deepEqual(errors, [])
})

test('Google Takvim yedeği içe aktarılır, tekrar yüklenince kopya oluşmaz', async (browser) => {
  const { page, errors, nav } = await open(browser)
  const load = async () => {
    await nav('Takvim')
    await page.getByRole('button', { name: 'Diğer seçenekler' }).click()
    await page.getByRole('button', { name: /Google Takvim'den içe aktar/ }).click()
    await page.setInputFiles('.filepick input', ICS)
    await page.waitForSelector('.ics-cals')
  }
  await load()
  assert.match(await page.locator('.ics-cals').innerText(), /Yüksek lisans[\s\S]*4 yeni/)
  await page.locator('.modal-foot .btn.primary').click()
  await page.waitForSelector('.ev')
  assert.match(await page.locator('.calendar-page').innerText(), /Seminer dersi[\s\S]*Danışman görüşmesi|Danışman görüşmesi[\s\S]*Seminer dersi/)
  await load()
  assert.match(await page.locator('.ics-cals').innerText(), /0 yeni · 4 zaten var/)
  assert.equal(await page.locator('.modal-foot .btn.primary').isDisabled(), true)
  assert.deepEqual(errors, [])
})

test('Görevler sekmesi ve Ödemelerim', async (browser) => {
  const { page, errors, nav } = await open(browser)
  await nav('Görevler')
  await page.locator('.todo-add input').first().fill('Yazılıları oku')
  await page.keyboard.press('Enter')
  assert.match(await page.locator('.page').innerText(), /Yazılıları oku/)
  await nav('Raporlar')
  await page.locator('.tabs-seg button', { hasText: 'Ödemelerim' }).click()
  await page.locator('.bills .btn.primary', { hasText: 'Ödeme kalemi' }).click()
  await page.locator('.modal input').first().fill('İş Bankası kredi kartı')
  await page.locator('.modal input[type=number]').nth(0).fill('20')
  await page.locator('.modal input[type=number]').nth(1).fill('4500')
  await page.locator('.modal-foot .btn.primary').click()
  assert.match(await page.locator('.bill-list').innerText(), /İş Bankası kredi kartı[\s\S]*20\.11\.2026/)
  await page.locator('.bill-check').first().click()
  await page.waitForSelector('.bill-check.on')
  assert.match(await page.locator('.bills .kpis').innerText(), /Ödenen\s*4\.500/)
  await page.locator('.bills .seg button', { hasText: 'Toplu görünüm' }).click()
  assert.match(await page.locator('.bill-table').innerText(), /İş Bankası kredi kartı/)
  assert.deepEqual(errors, [])
})

test('ay görünümünde güne dokununca yan panel, Güne git gün görünümünü açar', async (browser) => {
  const { page, errors, nav } = await open(browser)
  await importProgram(page, nav)
  await page.locator('.modal-foot .btn.primary').click()
  await page.locator('.cal-views button, .seg button', { hasText: /^Ay$/ }).first().click()
  await page.waitForSelector('.day-panel')
  await page.getByRole('button', { name: 'Güne git' }).click()
  await page.waitForSelector('.ev')
  assert.equal(await page.locator('.day-panel').count(), 0)
  assert.deepEqual(errors, [])
})

test('görevler: yeni görev üstte, kategori filtresi, alt adımlar, yazarken liste yeniden oluşmaz', async (browser) => {
  const { page, errors, nav } = await open(browser)
  await nav('Görevler')
  const add = async (t) => {
    await page.locator('.todo-add input').first().fill(t)
    await page.keyboard.press('Enter')
  }
  await add('Birinci görev')
  await page.clock.runFor(1000)
  await add('İkinci görev')
  assert.deepEqual(await page.locator('.todo-list .todo-text > span').allInnerTexts(), ['İkinci görev', 'Birinci görev'])
  // Yazarken mevcut satırlar yerinde kalır (yeniden oluşturulmaz)
  await page.locator('.todo-list li').first().evaluate((el) => (el.dataset.mark = '1'))
  await page.locator('.todo-add input').first().type('abc')
  assert.equal(await page.locator('.todo-list li[data-mark="1"]').count(), 1)
  await page.locator('.todo-add input').first().fill('')
  // Kategori filtresi
  await page.locator('.cat-chip', { hasText: 'Yüksek lisans' }).click()
  assert.equal(await page.locator('.todo-list li').count(), 0)
  await add('Tez taslağı')
  assert.deepEqual(await page.locator('.todo-list .todo-text > span').allInnerTexts(), ['Tez taslağı'])
  await page.locator('.cat-chip', { hasText: 'Tümü' }).click()
  assert.equal(await page.locator('.todo-list li').count(), 3)
  // Alt adım
  await page.locator('.todo-text', { hasText: 'Tez taslağı' }).click()
  await page.locator('.step-add input').fill('Giriş bölümü')
  await page.keyboard.press('Enter')
  await page.locator('.modal-foot .btn.primary').click()
  assert.match(await page.locator('.todo-list li', { hasText: 'Tez taslağı' }).innerText(), /0\/1/)
  // Sıralama: A → Z
  await page.locator('.todo-sort select').selectOption('az')
  assert.deepEqual(await page.locator('.todo-list .todo-text > span').allInnerTexts(), ['Birinci görev', 'İkinci görev', 'Tez taslağı'])
  assert.deepEqual(errors, [])
})

test('takvimi yazdırma / PDF ekranı haftanın derslerini gösterir', async (browser) => {
  const { page, errors, nav } = await open(browser)
  await importProgram(page, nav)
  await page.locator('.modal-foot .btn.primary').click()
  await page.getByRole('button', { name: 'Diğer seçenekler' }).click()
  await page.getByRole('button', { name: /PDF olarak al/ }).click()
  await page.waitForSelector('.print-page')
  assert.match(await page.locator('.print-page').innerText(), /Haftalık program[\s\S]*TEST-A[\s\S]*TEST-B/)
  await page.locator('.ps-bar .inline-seg button', { hasText: 'Ay' }).click()
  assert.match(await page.locator('.print-page').innerText(), /Aylık program[\s\S]*Kasım 2026/)
  await page.keyboard.press('Escape')
  assert.equal(await page.locator('.print-sheet').count(), 0)
  assert.deepEqual(errors, [])
})

test('iki cihaz kendi sunucu üzerinden eşitlenir (şifreli)', async (browser) => {
  if (!php) {
    console.log('  (PHP yok, eşitleme testi atlandı)')
    return
  }
  const srv = `http://127.0.0.1:${SYNC_PORT}`
  const connectDevice = async (newAccount, name) => {
    const d = await open(browser)
    await d.nav('Ayarlar')
    const panel = d.page.locator('.panel', { has: d.page.locator('h3', { hasText: 'Eşitleme (telefon' }) })
    await panel.locator('input').first().fill(srv)
    await panel.getByRole('button', { name: 'Devam' }).click()
    await panel.locator('input[type=password]').first().waitFor()
    await panel.locator('.field', { hasText: 'Bu cihazın adı' }).locator('input').fill(name)
    const pw = panel.locator('input[type=password]')
    await pw.nth(0).fill('cok-gizli-parola')
    if (newAccount) {
      await pw.nth(1).fill('cok-gizli-parola')
      const kod = /\n([A-Z2-9]{10})\n/.exec(readFileSync(join(SYNC_DIR, 'veri', 'KURULUM-KODU.txt'), 'utf8'))[1]
      await panel.locator('.field', { hasText: 'Kurulum kodu' }).locator('input').fill(kod)
    }
    await panel.getByRole('button', { name: newAccount ? /Hesap oluştur/ : /Giriş yap/ }).click()
    await panel.locator('.sync-status', { hasText: 'Eşitlendi' }).waitFor({ timeout: 20000 })
    return d
  }
  const addTask = async (d, title) => {
    await d.nav('Görevler')
    await d.page.locator('.todo-add input').first().fill(title)
    await d.page.keyboard.press('Enter')
  }
  const syncAndOpenTasks = async (d) => {
    await d.nav('Ayarlar')
    const panel = d.page.locator('.panel', { has: d.page.locator('h3', { hasText: 'Eşitleme (telefon' }) })
    await panel.getByRole('button', { name: 'Şimdi eşitle' }).click()
    await panel.locator('.sync-status', { hasText: 'Eşitlendi' }).waitFor({ timeout: 20000 })
    await d.nav('Görevler')
    return d.page.locator('.todo-list').innerText().catch(() => '')
  }

  const phone = await connectDevice(true, 'Telefon')
  await addTask(phone, 'Telefondan görev')
  await syncAndOpenTasks(phone)

  const tablet = await connectDevice(false, 'Tablet')
  assert.match(await syncAndOpenTasks(tablet), /Telefondan görev/)
  await addTask(tablet, 'Tabletten görev')
  await syncAndOpenTasks(tablet)
  assert.match(await syncAndOpenTasks(phone), /Tabletten görev[\s\S]*Telefondan görev/)

  // Silme de eşitlenir
  await phone.page.locator('.todo-text', { hasText: 'Telefondan görev' }).click()
  await phone.page.locator('.modal-foot .btn.danger').click()
  await syncAndOpenTasks(phone)
  const t = await syncAndOpenTasks(tablet)
  assert.doesNotMatch(t, /Telefondan görev/)
  assert.match(t, /Tabletten görev/)

  // Sunucuda içerik şifreli durur: görev adları veritabanı dosyalarında geçmez
  const vdir = join(SYNC_DIR, 'veri')
  const blob = readdirSync(vdir).filter((f) => f.startsWith('ders-')).map((f) => readFileSync(join(vdir, f)).toString('latin1')).join('')
  assert.ok(blob.length > 0)
  assert.ok(!blob.includes('Tabletten') && !blob.includes('Telefondan'), 'sunucuda düz metin bulundu')
  assert.deepEqual(phone.errors, [])
  assert.deepEqual(tablet.errors, [])
})

await waitForServer()
const browser = await chromium.launch()
let failed = 0
for (const t of tests) {
  const started = Date.now()
  try {
    await t.fn(browser)
    console.log(`✓ ${t.name} (${Date.now() - started} ms)`)
  } catch (e) {
    failed++
    console.error(`✗ ${t.name}\n  ${String(e.message ?? e).split('\n').slice(0, 6).join('\n  ')}`)
  }
}
await browser.close()
stop()
console.log(failed ? `\n${failed} test başarısız` : `\n${tests.length} testin hepsi geçti`)
process.exit(failed ? 1 : 0)
