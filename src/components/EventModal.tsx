import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import type { CalEvent, EventKind, LessonStatus } from '../lib/types'
import { deleteEvents, eventTitle, saveCategory, saveEvents, useData } from '../lib/store'
import { addDays, formatDMY, fromMinutes, toMinutes, todayISO } from '../lib/date'
import { PALETTE, uid } from '../lib/util'
import { applyShiftToSeries, conflictsOf, futureSeriesEvents } from '../lib/eventOps'
import { isFullHoliday } from '../lib/holidays'
import { showToast } from '../lib/toast'
import Modal from './Modal'
import TimePicker from './TimePicker'
import DateInput from './DateInput'

export const STATUS_LABEL: Record<LessonStatus, string> = {
  planned: 'Planlandı',
  done: 'Yapıldı',
  cancelled: 'İptal',
  postponed: 'Ertelendi',
}

const KIND_LABEL: Record<EventKind, string> = { ozel: 'Özel ders', kurum: 'Kurum dersi', diger: 'Kişisel' }
const DURATIONS = [40, 60, 90, 120]

/** Sade etkinlik formu: ne, ne zaman, tekrar. Konu/ödev/ücret burada yok (öğrenci/sınıf dosyasında). */
export default function EventModal({ initial, onClose }: { initial: CalEvent | Partial<CalEvent>; onClose: () => void }) {
  const data = useData()
  const isNew = !('id' in initial && initial.id && data.events.some((e) => e.id === initial.id))
  const [ev, setEv] = useState<CalEvent>(() => ({
    id: uid(),
    kind: data.students.length ? 'ozel' : 'diger',
    date: todayISO(),
    start: '17:00',
    end: '18:00',
    title: '',
    status: 'planned',
    createdAt: Date.now(),
    ...initial,
  } as CalEvent))
  const [repeat, setRepeat] = useState(false)
  const [until, setUntil] = useState(() => addDays(ev.date, 7 * 16))
  const [error, setError] = useState('')
  const [newCat, setNewCat] = useState<string | null>(null)

  const set = <K extends keyof CalEvent>(k: K, v: CalEvent[K]) => setEv((p) => ({ ...p, [k]: v }))
  const dur = toMinutes(ev.end) - toMinutes(ev.start)
  const setDur = (m: number) => setEv((p) => ({ ...p, end: fromMinutes(Math.min(24 * 60 - 1, toMinutes(p.start) + m)) }))
  const conflicts = conflictsOf(data, ev)
  const series = ev.seriesId ? data.events.filter((e) => e.seriesId === ev.seriesId) : []
  const lockedKind = !isNew && !!ev.importKeys
  const groups = Object.values(data.groups).sort((a, b) => a.code.localeCompare(b.code))
  const activeStudents = data.students.filter((s) => s.active || s.id === ev.studentId).sort((a, b) => a.name.localeCompare(b.name, 'tr'))

  const repeatDates = useMemo(() => {
    if (!isNew || !repeat) return { dates: [] as string[], skipped: 0 }
    const dates: string[] = []
    let skipped = 0
    for (let d = addDays(ev.date, 7); d <= until; d = addDays(d, 7)) {
      if (isFullHoliday(data, d)) skipped++
      else dates.push(d)
    }
    return { dates, skipped }
  }, [isNew, repeat, ev.date, until, data])

  const save = () => {
    if (toMinutes(ev.end) <= toMinutes(ev.start)) return setError('Bitiş saati başlangıçtan sonra olmalı.')
    if (ev.kind === 'ozel' && !ev.studentId) return setError('Lütfen öğrenci seçin.')
    if (ev.kind === 'kurum' && !ev.groupCode) return setError('Lütfen sınıf seçin.')
    if (ev.kind === 'diger' && !ev.title.trim()) return setError('Lütfen bir başlık yazın.')
    const student = data.students.find((s) => s.id === ev.studentId)
    const base: CalEvent = {
      ...ev,
      groupCode: ev.kind === 'kurum' ? ev.groupCode : undefined,
      studentId: ev.kind === 'ozel' ? ev.studentId : undefined,
      categoryId: ev.kind === 'diger' ? ev.categoryId : undefined,
      // Ücret formda sorulmaz: öğrencinin kayıtlı ücretinden gelir
      fee: ev.kind === 'ozel' ? (isNew || ev.studentId !== (initial as CalEvent).studentId ? student?.fee : ev.fee) : undefined,
      title: ev.kind === 'kurum' ? ev.groupCode! : ev.kind === 'ozel' ? student?.name ?? '' : ev.title.trim(),
    }
    const out: CalEvent[] = [base]
    if (isNew && repeat) {
      base.seriesId = uid()
      for (const d of repeatDates.dates) out.push({ ...base, id: uid(), date: d, status: 'planned' })
    }
    saveEvents(out)
    const before = initial as CalEvent
    if (!isNew && before.seriesId && (before.date !== base.date || before.start !== base.start || before.end !== base.end)) {
      const future = futureSeriesEvents(data, before)
      if (future.length && confirm(`Bu değişiklik sonraki ${future.length} derse de uygulansın mı?`)) {
        const snapshot = future.map((e) => ({ ...e }))
        const n = applyShiftToSeries(before, base)
        showToast(`${n} ders daha güncellendi`, [{ label: 'Geri al', run: () => saveEvents(snapshot) }])
      }
    }
    if (isNew) showToast(out.length > 1 ? `${out.length} ders eklendi` : `${eventTitle(data, base)} eklendi`, [{ label: 'Geri al', run: () => deleteEvents(out.map((e) => e.id), { trash: false }) }])
    onClose()
  }

  const remove = (scope: 'one' | 'future') => {
    const ids = scope === 'one' ? [ev.id] : series.filter((e) => e.date >= ev.date).map((e) => e.id)
    if (!confirm(scope === 'one' ? 'Bu etkinlik silinsin mi?' : `Bu ve sonraki ${ids.length} tekrar silinsin mi?`)) return
    deleteEvents(ids)
    showToast(`${ids.length} etkinlik silindi (Ayarlar → Çöp kutusu'ndan geri alınabilir)`)
    onClose()
  }

  const addCategory = () => {
    if (!newCat?.trim()) return
    const used = new Set(data.categories.map((c) => c.color))
    const c = { id: uid(), name: newCat.trim(), color: PALETTE.find((x) => !used.has(x)) ?? PALETTE[0] }
    saveCategory(c)
    set('categoryId', c.id)
    setNewCat(null)
  }

  return (
    <Modal
      title={isNew ? 'Yeni etkinlik' : 'Etkinliği düzenle'}
      onClose={onClose}
      footer={
        <>
          {!isNew && <button className="btn danger" onClick={() => remove('one')}>Sil</button>}
          {!isNew && series.filter((e) => e.date >= ev.date).length > 1 && <button className="btn danger ghost" onClick={() => remove('future')}>Sonrakileri de sil</button>}
          <div className="spacer" />
          <button className="btn" onClick={onClose}>Vazgeç</button>
          <button className="btn primary" onClick={save}>Kaydet</button>
        </>
      }
    >
      {error && <div className="error">{error}</div>}

      {!lockedKind && (
        <div className="seg">
          {(['ozel', 'kurum', 'diger'] as EventKind[]).filter((k) => k !== 'kurum' || groups.length || ev.kind === 'kurum').map((k) => (
            <button key={k} className={ev.kind === k ? 'active' : ''} onClick={() => set('kind', k)}>{KIND_LABEL[k]}</button>
          ))}
        </div>
      )}

      {ev.kind === 'ozel' && (
        <label className="field">
          <span>Öğrenci</span>
          <select value={ev.studentId ?? ''} onChange={(e) => set('studentId', e.target.value || undefined)}>
            <option value="">Seçin…</option>
            {activeStudents.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {data.students.length === 0 && <small className="muted">Önce "Öğrenciler" sekmesinden öğrenci ekleyin.</small>}
        </label>
      )}
      {ev.kind === 'kurum' && (
        lockedKind ? <p className="muted small" style={{ margin: '0 0 6px' }}>Kurum programından · {data.groups[ev.groupCode ?? '']?.name ?? ev.groupCode}</p> : (
          <label className="field">
            <span>Sınıf</span>
            <select value={ev.groupCode ?? ''} onChange={(e) => set('groupCode', e.target.value || undefined)}>
              <option value="">Seçin…</option>
              {groups.map((g) => <option key={g.code} value={g.code}>{g.name ? `${g.name} (${g.code})` : g.code}</option>)}
            </select>
          </label>
        )
      )}
      {ev.kind === 'diger' && (
        <>
          <label className="field">
            <span>Başlık</span>
            <input value={ev.title} onChange={(e) => set('title', e.target.value)} placeholder="ör. Eğitim Yönetimi dersi" />
          </label>
          <div className="chips cat-chips">
            {data.categories.map((c) => (
              <button key={c.id} className={'chip' + (ev.categoryId === c.id ? ' sel' : '')} onClick={() => set('categoryId', ev.categoryId === c.id ? undefined : c.id)}>
                <i className="dot" style={{ background: c.color }} />{c.name}
              </button>
            ))}
            {newCat === null ? (
              <button className="chip" onClick={() => setNewCat('')}><Plus size={13} /> Kategori</button>
            ) : (
              <span className="row middle" style={{ minHeight: 0, gap: 4 }}>
                <input className="mini-input" style={{ width: 130 }} autoFocus value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCategory()} placeholder="ör. Spor" />
                <button className="btn small" onClick={addCategory}>Ekle</button>
              </span>
            )}
          </div>
        </>
      )}

      <div className="row wrap">
        <div className="field"><span>Tarih</span><DateInput value={ev.date} onChange={(v) => set('date', v)} /></div>
        <div className="field">
          <span>Başlangıç</span>
          <TimePicker label="Başlangıç" value={ev.start} onChange={(v) => setEv((p) => ({ ...p, start: v, end: fromMinutes(Math.min(24 * 60 - 1, toMinutes(v) + Math.max(dur, 15))) }))} />
        </div>
        <div className="field"><span>Bitiş</span><TimePicker label="Bitiş" value={ev.end} onChange={(v) => set('end', v)} /></div>
      </div>
      <div className="chips" style={{ marginTop: -2 }}>
        {DURATIONS.map((m) => <button key={m} className={'chip' + (dur === m ? ' sel' : '')} onClick={() => setDur(m)}>{m < 60 ? `${m} dk` : m % 60 ? `${Math.floor(m / 60)},5 saat` : `${m / 60} saat`}</button>)}
      </div>

      {isNew && (
        <div className="repeat-box">
          <label className="check"><input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} /> Her hafta tekrarla</label>
          {repeat && (
            <div className="row middle wrap" style={{ minHeight: 0 }}>
              <span className="muted small">Son tarih</span>
              <DateInput value={until} min={ev.date} onChange={setUntil} />
              <span className="muted small">{repeatDates.dates.length + 1} etkinlik{repeatDates.skipped ? ` · ${repeatDates.skipped} tatil atlandı` : ''}</span>
            </div>
          )}
        </div>
      )}

      {conflicts.length > 0 && (
        <div className="conflict">Bu saatte başka etkinlik var: {conflicts.map((c) => `${eventTitle(data, c)} (${c.start}–${c.end})`).join(', ')}</div>
      )}
      {!isNew && ev.status === 'cancelled' && <p className="muted small">Bu etkinlik iptal edilmiş ({formatDMY(ev.date)}).</p>}
    </Modal>
  )
}
