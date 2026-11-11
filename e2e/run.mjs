// Uçtan uca testler: gerçek tarayıcıda ana akışlar. Çalıştırma: npm run build && npm run e2e
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const PORT = 4188
const BASE = `http://localhost:${PORT}/`
const FIXTURE = fileURLToPath(new URL('./fixtures/program.xls', import.meta.url))

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
  const ev = page.locator('.ev', { hasText: '11:40–12:20' }).first()
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
