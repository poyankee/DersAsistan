import { applyImport, parseDateCell, parseRows, planImport, rowsFromHtml } from './importSchedule'
import { emptyData } from './store'

const HTML = `<html><body><table><thead><tr><th>Gün</th><th>1. Saat</th><th>2. Saat</th><th>3. Saat</th></tr></thead><tbody>
<tr><td>11 Ekim 2026 Paz</td><td>478-H0811<br>09:20-10:00</td><td>478-K0811<br>10:10-10:50</td><td></td></tr>
<tr><td>17 Ekim 2026 Cmt</td><td>478-L0711<br>09:20-10:00</td><td>478-L0711<br>10:10-10:50</td><td></td></tr>
<tr><td>16 Kasım 2026 Pzt</td><td></td><td>478-H0821<br>10:10-10:50</td><td>478-H0821<br>11:00-11:40</td></tr>
</tbody></table></body></html>`

describe('kurum programı içe aktarma', () => {
  it('Türkçe tarihleri okur', () => {
    expect(parseDateCell('11 Ekim 2026 Paz')).toBe('2026-10-11')
    expect(parseDateCell('01 Kasım 2026 Paz')).toBe('2026-11-01')
    expect(parseDateCell('05 Şubat 2027 Cum')).toBe('2027-02-05')
    expect(parseDateCell('3.9.2026')).toBe('2026-09-03')
    expect(parseDateCell('Gün')).toBeNull()
  })

  it('HTML tabloyu ders saatlerine çevirir', () => {
    const r = parseRows(rowsFromHtml(HTML))
    expect(r.slots).toHaveLength(6)
    expect(r.slots[0]).toMatchObject({ date: '2026-10-11', start: '09:20', end: '10:00', groupCode: '478-H0811' })
    expect(r.minDate).toBe('2026-10-11')
    expect(r.maxDate).toBe('2026-11-16')
    expect(r.warnings).toHaveLength(0)
  })

  it('art arda gelen aynı sınıf saatlerini birleştirir ve tekrar yüklemede kopya oluşturmaz', () => {
    const parsed = parseRows(rowsFromHtml(HTML))
    const first = applyImport(emptyData(), parsed, '2026-11-10', false)
    expect(first.events).toHaveLength(4) // 11 Ekim: 2 ayrı sınıf, 17 Ekim: 1 blok, 16 Kasım: 1 blok
    const block = first.events.find((e) => e.date === '2026-10-17')!
    expect(block).toMatchObject({ start: '09:20', end: '10:50', hours: 2 })

    const again = applyImport(first, parsed, '2026-11-10', false)
    expect(again.events).toHaveLength(4)
    const plan = planImport(first, parsed, '2026-11-10')
    expect(plan.newSlotCount).toBe(0)
    expect(plan.existingCount).toBe(6)
  })

  it('yeni yayınlanan programdan sadece yeni dersleri ekler, değişen gelecek dersleri bulur', () => {
    const first = applyImport(emptyData(), parseRows(rowsFromHtml(HTML)), '2026-11-10', false)
    const html2 = HTML.replace('478-H0821<br>11:00-11:40', '').replace(
      '</tbody>',
      '<tr><td>18 Kasım 2026 Çar</td><td>478-K0811<br>08:30-09:10</td><td></td><td></td></tr></tbody>',
    )
    const parsed2 = parseRows(rowsFromHtml(html2))
    const plan = planImport(first, parsed2, '2026-11-10')
    expect(plan.newSlotCount).toBe(1)
    expect(plan.staleEvents).toHaveLength(1) // 16 Kasım bloğu değişti
    const applied = applyImport(first, parsed2, '2026-11-10', true)
    const nov16 = applied.events.filter((e) => e.date === '2026-11-16')
    expect(nov16).toHaveLength(1)
    expect(nov16[0]).toMatchObject({ start: '10:10', end: '10:50', hours: 1 })
    expect(applied.events.some((e) => e.date === '2026-11-18')).toBe(true)
  })

  it('kullanıcının sildiği dersi tekrar eklemez', () => {
    const parsed = parseRows(rowsFromHtml(HTML))
    const first = applyImport(emptyData(), parsed, '2026-11-10', false)
    const ev = first.events[0]
    const afterDelete = { ...first, events: first.events.slice(1), ignoredImportKeys: ev.importKeys! }
    expect(applyImport(afterDelete, parsed, '2026-11-10', false).events).toHaveLength(3)
  })
})

describe('zil saatleri', () => {
  it('başlıktaki ders saati numaralarından haftanın günlerine göre zil saatlerini öğrenir', async () => {
    const { learnBellTimes } = await import('./importSchedule')
    const r = parseRows(rowsFromHtml(HTML))
    expect(r.slots.find((s) => s.date === '2026-11-16' && s.start === '10:10')?.period).toBe(2)
    const bt = learnBellTimes(r.slots)
    expect(bt[0]).toEqual([{ n: 2, start: '10:10', end: '10:50' }, { n: 3, start: '11:00', end: '11:40' }]) // Pazartesi
    expect(bt[5]?.[0]).toEqual({ n: 1, start: '09:20', end: '10:00' }) // Cumartesi
  })
})

describe('değişiklik raporu', () => {
  it('mevcut günlerdeki değişiklikleri yeni günlerden ayırır ve taşınan dersi bulur', async () => {
    const { changeReport } = await import('./importSchedule')
    const first = applyImport(emptyData(), parseRows(rowsFromHtml(HTML)), '2026-11-10', false)
    const html2 = HTML.replace('<td>478-H0821<br>10:10-10:50</td><td>478-H0821<br>11:00-11:40</td>', '<td></td><td>478-H0821<br>14:00-14:40</td>').replace(
      '</tbody>',
      '<tr><td>18 Kasım 2026 Çar</td><td>478-K0811<br>08:30-09:10</td><td></td><td></td></tr></tbody>',
    )
    const parsed2 = parseRows(rowsFromHtml(html2))
    const plan = planImport(first, parsed2, '2026-11-10', true)
    const r = changeReport(first, plan, true)
    expect(r.changedDays).toHaveLength(1)
    expect(r.changedDays[0].date).toBe('2026-11-16')
    expect(r.changedDays[0].moved[0]).toMatchObject({ group: '478-H0821', from: '10:10–11:40', to: '14:00–14:40' })
    expect(r.newDays.map((d) => d.date)).toEqual(['2026-11-18'])
  })
})
