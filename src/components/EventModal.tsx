import { useMemo, useState } from 'react'
import { CheckCircle2, Copy } from 'lucide-react'
import type { CalEvent, EventKind, LessonStatus } from '../lib/types'
import { deleteEvents, eventTitle, saveEvents, savePayment, useData } from '../lib/store'
import { studentFinance } from '../lib/finance'
import { holidayMap, isFullHoliday } from '../lib/holidays'
import FreeSlotsModal from './FreeSlotsModal'
import { applyShiftToSeries, conflictsOf, futureSeriesEvents } from '../lib/eventOps'
import { showToast } from '../lib/toast'
import { addDays, formatLong, formatShort, fromMinutes, isPast, toMinutes, todayISO, weekdayIndex } from '../lib/date'
import { money, uid } from '../lib/util'
import Modal from './Modal'

export const STATUS_LABEL: Record<LessonStatus, string> = {
  planned: 'Planlandı',
  done: 'Yapıldı',
  cancelled: 'İptal',
  postponed: 'Ertelendi',
}

const KIND_LABEL: Record<EventKind, string> = { kurum: 'Kurum dersi', ozel: 'Özel ders', diger: 'Diğer' }

export default function EventModal({ initial, onClose, onDuplicate }: { initial: CalEvent | Partial<CalEvent>; onClose: () => void; onDuplicate?: (ev: Partial<CalEvent>) => void }) {
  const data = useData()
  const isNew = !('id' in initial && initial.id && data.events.some((e) => e.id === initial.id))
  const [ev, setEv] = useState<CalEvent>(() => ({
    id: uid(),
    kind: 'diger',
    date: todayISO(),
    start: '10:00',
    end: '11:00',
    title: '',
    status: 'planned',
    createdAt: Date.now(),
    ...initial,
  } as CalEvent))
  const [repeat, setRepeat] = useState(false)
  const [repeatUntil, setRepeatUntil] = useState(() => addDays(ev.date, 7 * 12))
  const [error, setError] = useState('')
  const [feeReceived, setFeeReceived] = useState(false)
  const [skipHolidays, setSkipHolidays] = useState(true)
  const [makeupOpen, setMakeupOpen] = useState(false)
  const [bellSel, setBellSel] = useState<[number, number] | null>(null)

  const set = <K extends keyof CalEvent>(k: K, v: CalEvent[K]) => setEv((p) => ({ ...p, [k]: v }))
  const student = data.students.find((s) => s.id === ev.studentId)

  // Aynı sınıf/öğrencinin önceki dersleri: kaldığınız yeri hatırlatır
  const previous = useMemo(() => {
    const same = (e: CalEvent) =>
      e.id !== ev.id && e.topic && ((ev.groupCode && e.groupCode === ev.groupCode) || (ev.studentId && e.studentId === ev.studentId))
    return data.events
      .filter((e) => same(e) && (e.date + e.start) < (ev.date + ev.start))
      .sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start))
      .slice(0, 3)
  }, [data.events, ev.id, ev.groupCode, ev.studentId, ev.date, ev.start])

  const groupCodes = Object.keys(data.groups).sort()
  const conflicts = conflictsOf(data, ev)
  const holiday = holidayMap(data).get(ev.date)
  const bells = ev.kind === 'kurum' ? data.settings.bellTimes?.[weekdayIndex(ev.date)] ?? [] : []
  const pickBell = (n: number) => {
    const sel: [number, number] = !bellSel || bellSel[0] !== bellSel[1] ? [n, n] : [Math.min(bellSel[0], n), Math.max(bellSel[0], n)]
    const inRange = bells.filter((b) => b.n >= sel[0] && b.n <= sel[1])
    if (!inRange.length) return
    setBellSel(sel)
    setEv((p) => ({ ...p, start: inRange[0].start, end: inRange[inRange.length - 1].end, hours: inRange.length }))
  }
  const repeatDates = useMemo(() => {
    if (!isNew || !repeat) return { dates: [] as string[], skipped: 0 }
    const dates: string[] = []
    let skipped = 0
    for (let d = addDays(ev.date, 7); d <= repeatUntil; d = addDays(d, 7)) {
      if (skipHolidays && isFullHoliday(data, d)) skipped++
      else dates.push(d)
    }
    return { dates, skipped }
  }, [isNew, repeat, ev.date, repeatUntil, skipHolidays, data])
  const original = ev.makeupOf ? data.events.find((e) => e.id === ev.makeupOf) : undefined
  const makeups = !isNew ? data.events.filter((e) => e.makeupOf === ev.id) : []

  const planMakeup = (date: string, start: string, end: string) => {
    setMakeupOpen(false)
    const orig: CalEvent = { ...ev, status: ev.status === 'planned' ? 'postponed' : ev.status }
    const copy: CalEvent = {
      ...ev, id: uid(), date, start, end, status: 'planned', makeupOf: ev.id, topic: undefined, homework: undefined, notes: undefined,
      importKeys: undefined, seriesId: undefined, createdAt: Date.now(),
    }
    saveEvents([orig, copy])
    showToast(`Telafi dersi eklendi: ${formatShort(date)} ${start}–${end}`, [{ label: 'Geri al', run: () => { deleteEvents([copy.id]); saveEvents([initial as CalEvent]) } }])
    onClose()
  }
  const payState = student && !isNew ? studentFinance(data, student, todayISO()).lessonPay.get(ev.id) : undefined
  const canReceiveFee = ev.kind === 'ozel' && !!student && (ev.fee ?? 0) > 0 && payState !== 'paid' && ev.status !== 'cancelled' && ev.status !== 'postponed'
  const books = ev.studentId ? data.books.filter((b) => b.studentId === ev.studentId && (b.status !== 'bitti' || b.id === ev.bookId)) : []
  const series = ev.seriesId ? data.events.filter((e) => e.seriesId === ev.seriesId) : []

  const save = (markDone = false) => {
    if (toMinutes(ev.end) <= toMinutes(ev.start)) return setError('Bitiş saati başlangıçtan sonra olmalı.')
    if (ev.kind === 'ozel' && !ev.studentId) return setError('Lütfen öğrenci seçin.')
    if (ev.kind === 'kurum' && !ev.groupCode?.trim()) return setError('Lütfen sınıf/grup kodunu girin.')
    if (ev.kind === 'diger' && !ev.title.trim()) return setError('Lütfen bir başlık girin.')
    let status = ev.status
    if (markDone) status = 'done'
    else if (status === 'planned' && ev.topic?.trim() && isPast(ev.date, ev.start)) status = 'done'
    const base: CalEvent = {
      ...ev,
      status,
      groupCode: ev.kind === 'kurum' ? ev.groupCode?.trim() : undefined,
      studentId: ev.kind === 'ozel' ? ev.studentId : undefined,
      title: ev.kind === 'kurum' ? ev.groupCode!.trim() : ev.kind === 'ozel' ? student?.name ?? '' : ev.title.trim(),
    }
    const out: CalEvent[] = [base]
    if (isNew && repeat) {
      base.seriesId = uid()
      for (const d of repeatDates.dates) {
        out.push({ ...base, id: uid(), date: d, status: 'planned', topic: undefined, homework: undefined, notes: undefined })
      }
    }
    saveEvents(out)
    if (feeReceived && canReceiveFee && (status === 'done' || isPast(ev.date, ev.start))) {
      if (status !== 'done') saveEvents([{ ...base, status: 'done' }])
      savePayment({ id: uid(), studentId: base.studentId!, date: todayISO() < base.date ? base.date : todayISO(), amount: base.fee ?? 0, eventId: base.id, note: `${formatShort(base.date)} dersi` })
      showToast(`Ders ve ${money(base.fee ?? 0, data.settings.currency)} ödeme kaydedildi`)
    }
    // Tekrarlayan derste saat/gün değiştiyse sonrakilere de uygulamayı teklif et
    const before = initial as CalEvent
    if (!isNew && before.seriesId && (before.date !== base.date || before.start !== base.start || before.end !== base.end)) {
      const future = futureSeriesEvents(data, before)
      if (future.length && confirm(`Bu değişiklik serideki sonraki ${future.length} derse de uygulansın mı?\n(Gün farkı ve yeni saat ${base.start}–${base.end})`)) {
        const snapshot = future.map((e) => ({ ...e }))
        const n = applyShiftToSeries(before, base)
        showToast(`${n} ders daha güncellendi`, [{ label: 'Geri al', run: () => saveEvents(snapshot) }])
      }
    }
    onClose()
  }

  const remove = (scope: 'one' | 'future') => {
    const ids = scope === 'one' ? [ev.id] : series.filter((e) => e.date >= ev.date).map((e) => e.id)
    const msg = scope === 'one' ? 'Bu etkinlik silinsin mi?' : `Bu ve sonraki ${ids.length} tekrar silinsin mi?`
    if (confirm(msg + (ev.importKeys ? '\n(Kurum programını tekrar yüklediğinizde bu ders yeniden eklenmeyecek. Dersi iptal etmek istiyorsanız durumu "İptal" yapmanız önerilir.)' : ''))) {
      deleteEvents(ids)
      onClose()
    }
  }

  const past = isPast(ev.date, ev.start)

  return (
    <Modal
      title={isNew ? 'Yeni etkinlik' : eventTitle(data, ev)}
      onClose={onClose}
      footer={
        <>
          {!isNew && <button className="btn danger" onClick={() => remove('one')}>Sil</button>}
          {!isNew && series.length > 1 && <button className="btn danger ghost" onClick={() => remove('future')}>Sonrakileri sil</button>}
          {!isNew && onDuplicate && (
            <button
              className="btn ghost"
              title="Aynı dersi başka bir güne/saate kopyala"
              onClick={() => onDuplicate({ kind: ev.kind, groupCode: ev.groupCode, studentId: ev.studentId, fee: ev.fee, title: ev.title, date: ev.date, start: ev.start, end: ev.end, hours: ev.hours, bookId: ev.bookId })}
            ><Copy size={15} /> Çoğalt</button>
          )}
          <div className="spacer" />
          <button className="btn" onClick={onClose}>Vazgeç</button>
          {ev.kind !== 'diger' && past && ev.status === 'planned' && (
            <button className="btn success" onClick={() => save(true)}><CheckCircle2 size={16} /> Yapıldı olarak kaydet</button>
          )}
          <button className="btn primary" onClick={() => save()}>Kaydet</button>
        </>
      }
    >
      {error && <div className="error">{error}</div>}
      {!isNew && <p className="muted small">{formatLong(ev.date)} · {ev.start}–{ev.end}{ev.importKeys ? ' · kurum programından' : ''}</p>}

      <div className="seg">
        {(['kurum', 'ozel', 'diger'] as EventKind[]).map((k) => (
          <button key={k} className={ev.kind === k ? 'active' : ''} onClick={() => set('kind', k)} disabled={!isNew && !!ev.importKeys}>
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>

      {ev.kind === 'kurum' && (
        <label className="field">
          <span>Sınıf / grup kodu</span>
          <input list="group-codes" value={ev.groupCode ?? ''} onChange={(e) => set('groupCode', e.target.value)} placeholder="ör. 478-H0811" />
          <datalist id="group-codes">
            {groupCodes.map((c) => <option key={c} value={c}>{data.groups[c].name}</option>)}
          </datalist>
        </label>
      )}
      {ev.kind === 'ozel' && (
        <div className="row">
          <label className="field grow">
            <span>Öğrenci</span>
            <select
              value={ev.studentId ?? ''}
              onChange={(e) => {
                const s = data.students.find((x) => x.id === e.target.value)
                setEv((p) => ({ ...p, studentId: e.target.value || undefined, fee: s?.fee ?? p.fee }))
              }}
            >
              <option value="">Seçin…</option>
              {data.students.filter((s) => s.active || s.id === ev.studentId).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {data.students.length === 0 && <small className="muted">Önce "Özel Ders" sekmesinden öğrenci ekleyin.</small>}
          </label>
          <label className="field" style={{ width: 120 }}>
            <span>Ücret ({data.settings.currency})</span>
            <input type="number" min={0} value={ev.fee ?? ''} onChange={(e) => set('fee', e.target.value === '' ? undefined : Number(e.target.value))} />
          </label>
        </div>
      )}
      {ev.kind === 'diger' && (
        <label className="field">
          <span>Başlık</span>
          <input value={ev.title} onChange={(e) => set('title', e.target.value)} placeholder="ör. Zümre toplantısı" />
        </label>
      )}

      <div className="row">
        <label className="field grow">
          <span>Tarih</span>
          <input type="date" value={ev.date} onChange={(e) => e.target.value && set('date', e.target.value)} />
        </label>
        <label className="field">
          <span>Başlangıç</span>
          <input
            type="time"
            value={ev.start}
            onChange={(e) => {
              const v = e.target.value
              if (!v) return
              const dur = toMinutes(ev.end) - toMinutes(ev.start)
              setEv((p) => ({ ...p, start: v, end: fromMinutes(toMinutes(v) + Math.max(dur, 15)) }))
            }}
          />
        </label>
        <label className="field">
          <span>Bitiş</span>
          <input type="time" value={ev.end} onChange={(e) => e.target.value && set('end', e.target.value)} />
        </label>
      </div>

      {holiday && <div className="row-title" style={{ margin: '4px 0' }}><span className="hol-tag">{holiday.name}</span></div>}
      {original && <div className="makeup-tag">↺ Telafi dersi — asıl ders: {formatShort(original.date)} {original.start}</div>}
      {makeups.length > 0 && <div className="makeup-tag">↺ Telafisi planlandı: {makeups.map((m) => `${formatShort(m.date)} ${m.start}`).join(', ')}</div>}
      {bells.length > 0 && (
        <div className="field" style={{ marginBottom: 0 }}>
          <span>Kurum ders saatleri ({['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'][weekdayIndex(ev.date)]}) — art arda saatler için iki saate dokunun</span>
          <div className="bell-chips">
            {bells.map((b) => (
              <button key={b.n} className={'chip' + ((bellSel ? b.n >= bellSel[0] && b.n <= bellSel[1] : b.start >= ev.start && b.end <= ev.end) ? ' sel' : '')} onClick={() => pickBell(b.n)}>
                {b.n}. saat<small>{b.start}</small>
              </button>
            ))}
          </div>
        </div>
      )}
      {conflicts.length > 0 && (
        <div className="conflict">⚠️ Çakışma: {conflicts.map((c) => `${eventTitle(data, c)} (${c.start}–${c.end})`).join(', ')}</div>
      )}

      {isNew && (
        <div className="row middle">
          <label className="check">
            <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} /> Her hafta tekrarla
          </label>
          {repeat && (
            <label className="field inline">
              <span>Bitiş tarihi</span>
              <input type="date" value={repeatUntil} onChange={(e) => setRepeatUntil(e.target.value)} />
            </label>
          )}
          {repeat && (
            <label className="check"><input type="checkbox" checked={skipHolidays} onChange={(e) => setSkipHolidays(e.target.checked)} /> Tatilleri atla</label>
          )}
          {repeat && <span className="muted small">{repeatDates.dates.length + 1} ders oluşturulacak{repeatDates.skipped ? `, ${repeatDates.skipped} tatil günü atlandı` : ''}</span>}
        </div>
      )}

      {ev.kind !== 'diger' && (
        <>
          <div className="seg small">
            {(Object.keys(STATUS_LABEL) as LessonStatus[]).map((s) => (
              <button key={s} className={ev.status === s ? 'active st-' + s : ''} onClick={() => set('status', s)}>{STATUS_LABEL[s]}</button>
            ))}
          </div>

          {!isNew && (ev.status === 'cancelled' || ev.status === 'postponed') && makeups.length === 0 && (
            <button className="btn" onClick={() => setMakeupOpen(true)}>↺ Telafi dersi planla</button>
          )}

          {previous.length > 0 && (
            <div className="prev-box">
              <b>Önceki dersler</b>
              {previous.map((p) => (
                <div key={p.id}><span className="muted">{formatShort(p.date)}:</span> {p.topic}{p.homework ? <em> · Ödev: {p.homework}</em> : null}</div>
              ))}
            </div>
          )}

          <label className="field">
            <span>Ne işledim? (konu)</span>
            <textarea rows={3} value={ev.topic ?? ''} onChange={(e) => set('topic', e.target.value)} placeholder="ör. Üslü sayılar – negatif üs, 12 soru çözüldü" />
          </label>
          {ev.kind === 'ozel' && books.length > 0 && (
            <div className="row">
              <label className="field grow">
                <span>Kitap</span>
                <select value={ev.bookId ?? ''} onChange={(e) => set('bookId', e.target.value || undefined)}>
                  <option value="">—</option>
                  {books.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
                </select>
              </label>
              {ev.bookId && (
                <label className="field grow">
                  <span>İlerleme</span>
                  <input value={ev.bookProgress ?? ''} onChange={(e) => set('bookProgress', e.target.value)} placeholder="ör. s. 40–55, Test 3–5" />
                </label>
              )}
            </div>
          )}
          <label className="field">
            <span>Verilen ödev</span>
            <input value={ev.homework ?? ''} onChange={(e) => set('homework', e.target.value)} placeholder="ör. Test kitabı s. 34–36" />
          </label>
        </>
      )}
      <label className="field">
        <span>Notlar</span>
        <textarea rows={2} value={ev.notes ?? ''} onChange={(e) => set('notes', e.target.value)} placeholder={ev.kind === 'diger' ? '' : 'ör. Ali gelmedi, sınıf çok iyiydi…'} />
      </label>
      {ev.kind === 'ozel' && student && ev.fee !== undefined && (
        <div className="fee-box">
          {payState === 'paid' ? (
            <span className="pay-state paid">Bu dersin ücreti ödendi</span>
          ) : (
            <>
              {payState && <span className={'pay-state ' + payState}>{payState === 'partial' ? 'Kısmen ödendi' : 'Ücreti ödenmedi'}</span>}
              {canReceiveFee && (ev.status === 'done' || isPast(ev.date, ev.start)) && (
                <label className="check"><input type="checkbox" checked={feeReceived} onChange={(e) => setFeeReceived(e.target.checked)} /> Bu dersin ücreti alındı ({money(ev.fee ?? 0, data.settings.currency)})</label>
              )}
              {!(ev.status === 'done' || isPast(ev.date, ev.start)) && <span className="muted small">Ders yapılınca {student.name} hesabına {money(ev.fee, data.settings.currency)} eklenir.</span>}
            </>
          )}
        </div>
      )}
      {ev.kind !== 'diger' && <p className="muted small">İpucu: Geçmiş bir derse konu yazıp kaydettiğinizde ders otomatik "Yapıldı" olur.</p>}
      {makeupOpen && (
        <FreeSlotsModal
          title="Telafi için boş saat seç"
          initialDuration={toMinutes(ev.end) - toMinutes(ev.start)}
          from={addDays(todayISO(), 0)}
          ignoreId={ev.id}
          onClose={() => setMakeupOpen(false)}
          onPick={planMakeup}
        />
      )}
    </Modal>
  )
}
