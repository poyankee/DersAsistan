import { useRef, useState } from 'react'
import { Download, Upload, CalendarDays } from 'lucide-react'
import { deleteHoliday, emptyData, normalize, saveGroup, saveHoliday, setData, useData } from '../lib/store'
import { holidaysBetween } from '../lib/holidays'
import { TR_DAYS, addDays, formatShort, todayISO } from '../lib/date'
import { uid } from '../lib/util'
import { buildICS } from '../lib/ics'
import { PALETTE, downloadFile } from '../lib/util'

export default function SettingsPage() {
  const data = useData()
  const fileRef = useRef<HTMLInputElement>(null)
  const groups = Object.values(data.groups).sort((a, b) => a.code.localeCompare(b.code))
  const setSetting = <K extends keyof typeof data.settings>(k: K, v: (typeof data.settings)[K]) =>
    setData((d) => ({ ...d, settings: { ...d.settings, [k]: v } }))

  const backup = () => downloadFile(`ders-asistani-yedek-${todayISO()}.json`, JSON.stringify(data, null, 2), 'application/json')

  const restore = async (f?: File) => {
    if (!f) return
    try {
      const parsed = normalize(JSON.parse(await f.text()))
      if (!Array.isArray(parsed.events)) throw new Error('Geçersiz dosya')
      if (confirm(`Yedek yüklensin mi? (${parsed.events.length} etkinlik, ${parsed.students.length} öğrenci)\nMevcut verilerin yerini alacak.`)) {
        setData(() => parsed)
        alert('Yedek yüklendi.')
      }
    } catch (e) {
      alert('Yedek okunamadı: ' + (e as Error).message)
    }
  }

  return (
    <div className="page">
      <div className="page-head"><h2>Ayarlar</h2></div>

      <section className="panel">
        <h3>Kurum sınıfları</h3>
        <p className="muted small">Kurum programındaki kodlara anlaşılır bir ad ve renk verin (ör. 478-H0811 → "8-H Matematik").</p>
        {groups.length === 0 ? <p className="muted">Program yüklediğinizde sınıflar burada listelenir.</p> : (
          <div className="group-list">
            {groups.map((g) => (
              <div key={g.code} className="group-row">
                <code>{g.code}</code>
                <input placeholder="Görünen ad (opsiyonel)" defaultValue={g.name ?? ''} onBlur={(e) => saveGroup({ ...g, name: e.target.value.trim() || undefined })} />
                <div className="swatches">
                  {PALETTE.map((c) => (
                    <button key={c} className={'swatch sm' + (g.color === c ? ' sel' : '')} style={{ background: c }} onClick={() => saveGroup({ ...g, color: c })} aria-label={c} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <HolidaysPanel />

      {data.settings.bellTimes && Object.keys(data.settings.bellTimes).length > 0 && (
        <section className="panel">
          <h3>Kurum zil saatleri</h3>
          <p className="muted small">Yüklediğiniz programlardan otomatik öğrenildi. Takvimde kurum dersi eklerken "3. saat" gibi seçebilirsiniz.</p>
          <div className="table-wrap">
            <table className="table bell-table">
              <thead><tr><th>Gün</th>{Array.from({ length: Math.max(...Object.values(data.settings.bellTimes).flat().map((b) => b.n)) }, (_, i) => <th key={i}>{i + 1}.</th>)}</tr></thead>
              <tbody>
                {Object.entries(data.settings.bellTimes).sort(([a], [b]) => Number(a) - Number(b)).map(([wd, list]) => (
                  <tr key={wd}>
                    <td><b>{TR_DAYS[Number(wd)]}</b></td>
                    {Array.from({ length: Math.max(...Object.values(data.settings.bellTimes!).flat().map((b) => b.n)) }, (_, i) => {
                      const b = list.find((x) => x.n === i + 1)
                      return <td key={i} className="small nowrap">{b ? `${b.start}–${b.end}` : <span className="muted">·</span>}</td>
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn small ghost" style={{ marginTop: 8 }} onClick={() => confirm('Öğrenilen zil saatleri silinsin mi? Bir sonraki program yüklemesinde yeniden öğrenilir.') && setSetting('bellTimes', undefined)}>Sıfırla</button>
        </section>
      )}

      <section className="panel">
        <h3>Genel</h3>
        <div className="row">
          <label className="field">
            <span>Kurum ek ders saat ücreti ({data.settings.currency})</span>
            <input type="number" min={0} value={data.settings.kurumHourlyRate ?? ''} onChange={(e) => setSetting('kurumHourlyRate', e.target.value === '' ? undefined : Number(e.target.value))} />
          </label>
          <label className="field">
            <span>Takvim başlangıç saati</span>
            <input type="number" min={0} max={23} value={data.settings.dayStart} onChange={(e) => setSetting('dayStart', Math.min(23, Math.max(0, Number(e.target.value))))} />
          </label>
          <label className="field">
            <span>Takvim bitiş saati</span>
            <input type="number" min={1} max={24} value={data.settings.dayEnd} onChange={(e) => setSetting('dayEnd', Math.min(24, Math.max(data.settings.dayStart + 1, Number(e.target.value))))} />
          </label>
        </div>
      </section>

      <section className="panel">
        <h3>Yedekleme</h3>
        <p className="muted small">
          Verileriniz sadece bu cihazda saklanır. Cihaz değiştirmeden, uygulamayı silmeden veya güncellemeden önce mutlaka yedek alın (yedeği Google Drive veya WhatsApp'a kaydedebilirsiniz).
        </p>
        <div className="row wrap">
          <button className="btn primary" onClick={backup}><Download size={16} /> Yedek indir (.json)</button>
          <button className="btn" onClick={() => fileRef.current?.click()}><Upload size={16} /> Yedekten geri yükle</button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => restore(e.target.files?.[0])} />
        </div>
      </section>

      <section className="panel">
        <h3>Google Takvim'e aktar</h3>
        <p className="muted small">
          .ics dosyasını indirip Google Takvim → Ayarlar → İçe aktar bölümünden yükleyebilirsiniz. (Tek seferlik aktarımdır; otomatik eşitleme ileride eklenebilir.)
        </p>
        <div className="row wrap">
          <button className="btn" onClick={() => downloadFile(`ders-takvimi-${todayISO()}.ics`, buildICS(data, todayISO()), 'text/calendar')}><CalendarDays size={16} /> Bugünden itibaren (.ics)</button>
          <button className="btn" onClick={() => downloadFile(`ders-takvimi-tumu.ics`, buildICS(data), 'text/calendar')}><CalendarDays size={16} /> Tümü (.ics)</button>
        </div>
      </section>

      <section className="panel danger-zone">
        <h3>Tehlikeli bölge</h3>
        <button
          className="btn danger"
          onClick={() => {
            if (confirm('TÜM veriler silinsin mi? Bu işlem geri alınamaz. Önce yedek almanız önerilir.') && confirm('Emin misiniz?')) setData(() => emptyData())
          }}
        >Tüm verileri sil</button>
      </section>
      <p className="muted small center">Ders Asistanı v0.5 · {data.events.length} etkinlik · {data.students.length} öğrenci</p>
    </div>
  )
}

function HolidaysPanel() {
  const data = useData()
  const today = todayISO()
  const [name, setName] = useState('')
  const [start, setStart] = useState(today)
  const [end, setEnd] = useState(today)
  const upcoming = holidaysBetween(data, today, addDays(today, 120)).filter((x) => x.h.builtin)
  const official = data.settings.showOfficialHolidays !== false
  return (
    <section className="panel">
      <h3>Tatiller</h3>
      <p className="muted small">Tatiller takvimde işaretlenir; tekrarlayan özel dersler oluşturulurken tam gün tatiller atlanır, boş saat aramasında da gösterilmez.</p>
      <label className="check">
        <input type="checkbox" checked={official} onChange={(e) => setData((d) => ({ ...d, settings: { ...d.settings, showOfficialHolidays: e.target.checked } }))} />
        Resmi tatilleri göster (bayramlar dahil)
      </label>
      {official && upcoming.length > 0 && (
        <p className="small muted">Yaklaşan: {upcoming.slice(0, 6).map((x) => `${formatShort(x.date)} ${x.h.name}`).join(' · ')}</p>
      )}
      <h4>Okul / kişisel tatiller</h4>
      {data.holidays.length > 0 && (
        <ul className="promise-list">
          {[...data.holidays].sort((a, b) => a.start.localeCompare(b.start)).map((h) => (
            <li key={h.id}>
              <span className="grow"><b>{h.name}</b> <span className="muted">{formatShort(h.start)}{h.end !== h.start ? ` – ${formatShort(h.end)}` : ''}</span></span>
              <button className="btn small ghost" onClick={() => deleteHoliday(h.id)}>Sil</button>
            </li>
          ))}
        </ul>
      )}
      <div className="row wrap">
        <label className="field grow"><span>Ad</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="ör. Ara tatil, Yarıyıl tatili" /></label>
        <label className="field"><span>Başlangıç</span><input type="date" value={start} onChange={(e) => { setStart(e.target.value); if (e.target.value > end) setEnd(e.target.value) }} /></label>
        <label className="field"><span>Bitiş</span><input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} /></label>
        <button className="btn primary" style={{ marginBottom: 10 }} disabled={!name.trim() || !start || !end} onClick={() => { saveHoliday({ id: uid(), name: name.trim(), start, end }); setName('') }}>Ekle</button>
      </div>
    </section>
  )
}
