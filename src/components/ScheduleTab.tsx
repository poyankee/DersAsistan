import { useMemo, useState } from 'react'
import DateInput from './DateInput'
import TimePicker from './TimePicker'
import { CalendarRange, Pencil, Plus, Square } from 'lucide-react'
import type { CalEvent, Student } from '../lib/types'
import { deleteEvents, saveEvents, useData } from '../lib/store'
import { TR_DAYS, addDays, formatDMYDay, formatShort, fromMinutes, toMinutes, todayISO, weekdayIndex } from '../lib/date'
import { isFullHoliday } from '../lib/holidays'
import { showToast } from '../lib/toast'
import { uid } from '../lib/util'

interface Pattern {
  key: string
  events: CalEvent[]
  weekday: number
  start: string
  end: string
}

/** Öğrencinin haftalık ders düzenleri: toplu değiştirme, sonlandırma, yeni düzen */
export default function ScheduleTab({ student }: { student: Student }) {
  const data = useData()
  const today = todayISO()
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const patterns = useMemo(() => {
    const m = new Map<string, CalEvent[]>()
    for (const e of data.events) {
      if (e.studentId !== student.id || e.status !== 'planned' || e.date < today) continue
      const k = e.seriesId ?? `${weekdayIndex(e.date)}|${e.start}|${e.end}`
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(e)
    }
    const out: Pattern[] = []
    for (const [key, evs] of m) {
      evs.sort((a, b) => a.date.localeCompare(b.date))
      const f = evs[0]
      out.push({ key, events: evs, weekday: weekdayIndex(f.date), start: f.start, end: f.end })
    }
    return out.sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start))
  }, [data.events, student.id, today])
  // Tek seferlik dersler "Her … günü" diye gösterilmez; ayrı listelenir
  const weekly = patterns.filter((p) => p.events.length > 1)
  const singles = patterns.filter((p) => p.events.length === 1).map((p) => p.events[0]).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))

  return (
    <>
      <p className="muted small">Öğrencinin ileri tarihli planlı dersleri burada haftalık düzenler halinde görünür. Gün/saat kalıcı olarak değiştiğinde tek seferde güncelleyebilirsiniz.</p>
      {patterns.length === 0 && !adding && <p className="muted">Planlanmış ders yok.</p>}
      <div className="pattern-list">
        {weekly.map((p) => (
          <div key={p.key} className="pattern-card">
            <div className="row middle">
              <span className="pattern-ico"><CalendarRange size={18} /></span>
              <div className="grow">
                <b>Her {TR_DAYS[p.weekday]} {p.start}–{p.end}</b>
                <div className="muted small">{p.events.length} ders · {formatShort(p.events[0].date)} – {formatShort(p.events[p.events.length - 1].date)}</div>
              </div>
              <button className="btn small" onClick={() => setEditing(editing === p.key ? null : p.key)}><Pencil size={14} /> Değiştir</button>
              <EndButton p={p} />
            </div>
            {editing === p.key && <ChangeForm p={p} onDone={() => setEditing(null)} />}
          </div>
        ))}
      </div>
      {singles.length > 0 && (
        <>
          <h4>Tek seferlik dersler</h4>
          <ul className="single-list">
            {singles.map((e) => (
              <li key={e.id}>
                <b>{formatDMYDay(e.date)}</b> <span className="muted">{e.start}–{e.end}</span>
                <span className="grow" />
                <button
                  className="btn small ghost"
                  onClick={() => {
                    if (!confirm(`${formatDMYDay(e.date)} ${e.start} dersi silinsin mi? (30 gün çöp kutusunda kalır)`)) return
                    deleteEvents([e.id])
                  }}
                >
                  Sil
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {adding ? <NewPattern student={student} onDone={() => setAdding(false)} /> : (
        <button className="btn" style={{ marginTop: 12 }} onClick={() => setAdding(true)}><Plus size={15} /> Yeni haftalık düzen ekle</button>
      )}
    </>
  )
}

function EndButton({ p }: { p: Pattern }) {
  return (
    <button
      className="btn small danger"
      onClick={() => {
        const from = prompt('Hangi tarihten itibaren sonlandırılsın? (YYYY-AA-GG)', p.events[0].date)
        if (!from || !/^\d{4}-\d{2}-\d{2}$/.test(from)) return
        const rm = p.events.filter((e) => e.date >= from)
        if (!rm.length || !confirm(`${rm.length} planlı ders silinsin mi?`)) return
        const snapshot = rm.map((e) => ({ ...e }))
        deleteEvents(rm.map((e) => e.id))
        showToast(`${rm.length} ders kaldırıldı`, [{ label: 'Geri al', run: () => saveEvents(snapshot) }])
      }}
    ><Square size={13} /> Sonlandır</button>
  )
}

function ChangeForm({ p, onDone }: { p: Pattern; onDone: () => void }) {
  const [from, setFrom] = useState(p.events[0].date)
  const [wd, setWd] = useState(p.weekday)
  const [start, setStart] = useState(p.start)
  const [end, setEnd] = useState(p.end)
  const affected = p.events.filter((e) => e.date >= from)
  const apply = () => {
    if (toMinutes(end) <= toMinutes(start)) return alert('Bitiş saati başlangıçtan sonra olmalı.')
    const snapshot = affected.map((e) => ({ ...e }))
    saveEvents(affected.map((e) => ({ ...e, date: addDays(e.date, wd - weekdayIndex(e.date)), start, end })))
    showToast(`${affected.length} ders güncellendi: her ${TR_DAYS[wd]} ${start}–${end}`, [{ label: 'Geri al', run: () => saveEvents(snapshot) }])
    onDone()
  }
  return (
    <div className="pattern-form">
      <div className="row wrap">
        <label className="field"><span>Şu tarihten itibaren</span><DateInput value={from} onChange={(v) => setFrom(v)} /></label>
        <label className="field"><span>Yeni gün</span>
          <select value={wd} onChange={(e) => setWd(Number(e.target.value))}>{TR_DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select>
        </label>
        <div className="field"><span>Başlangıç</span><TimePicker label="Başlangıç" value={start} onChange={(v) => { setStart(v); setEnd(fromMinutes(toMinutes(v) + toMinutes(end) - toMinutes(start))) }} /></div>
        <div className="field"><span>Bitiş</span><TimePicker label="Bitiş" value={end} onChange={setEnd} /></div>
      </div>
      <div className="row middle">
        <span className="muted small grow">{affected.length} ders değişecek</span>
        <button className="btn" onClick={onDone}>Vazgeç</button>
        <button className="btn primary" disabled={!affected.length} onClick={apply}>Uygula</button>
      </div>
    </div>
  )
}

function NewPattern({ student, onDone }: { student: Student; onDone: () => void }) {
  const data = useData()
  const today = todayISO()
  const [wd, setWd] = useState(weekdayIndex(today))
  const [start, setStart] = useState('17:00')
  const [end, setEnd] = useState('18:00')
  const [from, setFrom] = useState(today)
  const [until, setUntil] = useState(addDays(today, 7 * 16))
  const [skip, setSkip] = useState(true)
  const dates = useMemo(() => {
    const first = addDays(from, (wd - weekdayIndex(from) + 7) % 7)
    const out: string[] = []
    let skipped = 0
    for (let d = first; d <= until; d = addDays(d, 7)) {
      if (skip && isFullHoliday(data, d)) skipped++
      else out.push(d)
    }
    return { out, skipped }
  }, [from, wd, until, skip, data])
  const create = () => {
    if (toMinutes(end) <= toMinutes(start)) return alert('Bitiş saati başlangıçtan sonra olmalı.')
    const seriesId = uid()
    const evs: CalEvent[] = dates.out.map((date) => ({
      id: uid(), kind: 'ozel', studentId: student.id, title: student.name, date, start, end, fee: student.fee, status: 'planned', seriesId, createdAt: Date.now(),
    }))
    saveEvents(evs)
    showToast(`${evs.length} ders eklendi`, [{ label: 'Geri al', run: () => deleteEvents(evs.map((e) => e.id), { trash: false }) }])
    onDone()
  }
  return (
    <div className="pattern-card pattern-form" style={{ marginTop: 12 }}>
      <b>Yeni haftalık düzen</b>
      <div className="row wrap">
        <label className="field"><span>Gün</span>
          <select value={wd} onChange={(e) => setWd(Number(e.target.value))}>{TR_DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select>
        </label>
        <div className="field"><span>Başlangıç</span><TimePicker label="Başlangıç" value={start} onChange={(v) => { setStart(v); setEnd(fromMinutes(toMinutes(v) + toMinutes(end) - toMinutes(start))) }} /></div>
        <div className="field"><span>Bitiş</span><TimePicker label="Bitiş" value={end} onChange={setEnd} /></div>
        <label className="field"><span>İlk hafta</span><DateInput value={from} onChange={(v) => setFrom(v)} /></label>
        <label className="field"><span>Bitiş tarihi</span><DateInput value={until} onChange={(v) => setUntil(v)} /></label>
      </div>
      <label className="check"><input type="checkbox" checked={skip} onChange={(e) => setSkip(e.target.checked)} /> Tatilleri atla</label>
      <div className="row middle">
        <span className="muted small grow">{dates.out.length} ders oluşturulacak{dates.skipped ? `, ${dates.skipped} tatil atlandı` : ''}{dates.out[0] ? ` · ilk ders ${formatShort(dates.out[0])}` : ''}</span>
        <button className="btn" onClick={onDone}>Vazgeç</button>
        <button className="btn primary" disabled={!dates.out.length} onClick={create}>Oluştur</button>
      </div>
    </div>
  )
}
