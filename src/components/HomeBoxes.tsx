import { useMemo, useState } from 'react'
import { AlarmClock, BarChart3, BellRing, CalendarClock, Check, ChevronRight, Clock4, GraduationCap, NotebookPen, Plus, Receipt, Search, Wallet } from 'lucide-react'
import type { OpenEvent } from '../App'
import type { CalEvent, Exam } from '../lib/types'
import { saveEvents, savedToast, subSuffix, useData, eventColor } from '../lib/store'
import { TR_DAYS_SHORT, addDays, formatDMY, fromISO, fromMinutes, nowHM, startOfWeek, toMinutes, todayISO } from '../lib/date'
import { isOff } from '../lib/status'
import { findFreeGaps } from '../lib/freeSlots'
import { upcomingBills } from '../lib/bills'
import { usePayReminders } from './PayReminders'

type Data = ReturnType<typeof useData>

const nameOf = (d: Data, e: CalEvent) =>
  e.kind === 'kurum' && e.groupCode ? ((d.groups[e.groupCode]?.name || e.groupCode) + subSuffix(e, d.groups[e.groupCode]?.name || e.groupCode))
  : e.kind === 'ozel' && e.studentId ? d.students.find((s) => s.id === e.studentId)?.name ?? e.title
  : e.title

const daysTo = (from: string, to: string) => Math.round((fromISO(to).getTime() - fromISO(from).getTime()) / 864e5)
const ago = (n: number) => (n === 0 ? 'Bugün' : n === 1 ? 'Dün' : `${n} gün önce`)

/** Ders kaydı bekleyenler: yapılmış ama konusu yazılmamış dersler (son 7 gün); konu doğrudan buradan yazılır */
export function PendingBox({ openEvent }: { openEvent: OpenEvent }) {
  const data = useData()
  const today = todayISO()
  const now = nowHM()
  const list = useMemo(
    () =>
      data.events
        .filter((e) => e.kind !== 'diger' && !isOff(e) && !e.topic && e.status !== 'done' && e.date >= addDays(today, -7) && (e.date < today || (e.date === today && e.end <= now)))
        .sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start)),
    [data.events, today, now],
  )
  const [text, setText] = useState<Record<string, string>>({})
  const save = (e: CalEvent, topic?: string) => {
    saveEvents([{ ...e, status: 'done', topic: topic?.trim() || e.topic }])
    savedToast(topic?.trim() ? `${nameOf(data, e)}: konu kaydedildi` : `${nameOf(data, e)} yapıldı olarak işaretlendi`)
    setText((t) => ({ ...t, [e.id]: '' }))
  }
  return (
    <section className="hcard pending-card" id="kayit-bekleyen">
      <div className="hcard-head">
        <h3><NotebookPen size={20} /> Ders Defteri</h3>
        {list.length > 0 && <span className="count-pill">{list.length} kayıt bekliyor</span>}
      </div>
      {list.length === 0 ? (
        <div className="all-done"><span>✍️</span><p className="muted small">Son dersler yazıldı. Ders bitince konusunu buradan hızlıca yazabilirsin.</p></div>
      ) : (
        <ul className="pending-list">
          {list.slice(0, 4).map((e) => (
            <li key={e.id} style={{ ['--ev' as string]: eventColor(data, e) }}>
              <button className="pl-name" onClick={() => openEvent(e)}>
                <i />
                <b>{nameOf(data, e)}</b>
                <small>{ago(daysTo(e.date, today))} · {e.start}</small>
              </button>
              <div className="pl-input">
                <input
                  value={text[e.id] ?? ''}
                  onChange={(ev) => setText((t) => ({ ...t, [e.id]: ev.target.value }))}
                  onKeyDown={(ev) => ev.key === 'Enter' && (text[e.id] ?? '').trim() && save(e, text[e.id])}
                  placeholder="Ne işlendi? (Enter)"
                  aria-label={`${nameOf(data, e)} dersinde işlenen konu`}
                />
                <button className="pl-ok" onClick={() => save(e, text[e.id])} aria-label={(text[e.id] ?? '').trim() ? 'Konuyu kaydet' : 'Konusuz yapıldı say'} title={(text[e.id] ?? '').trim() ? 'Kaydet' : 'Konusuz "yapıldı" say'}><Check size={16} /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {list.length > 4 && <small className="muted">+{list.length - 4} ders daha · derse dokunarak da yazabilirsin</small>}
    </section>
  )
}

/** Seçili günün boş saatleri; dokununca o saate ders eklenir */
export function FreeBox({ day, onNew, onFind }: { day: string; onNew: (date: string, start: string, end: string) => void; onFind: () => void }) {
  const data = useData()
  const today = todayISO()
  const gaps = useMemo(() => {
    const s = data.settings
    const all = findFreeGaps(data, day, 1, 45, { dayStart: s.dayStart, dayEnd: s.dayEnd })
    const now = toMinutes(nowHM())
    return all
      .map((g) => ({ ...g, from: day === today ? Math.max(toMinutes(g.start), Math.ceil(now / 15) * 15) : toMinutes(g.start), to: toMinutes(g.end) }))
      .filter((g) => g.to - g.from >= 45)
      .slice(0, 6)
  }, [data, day, today])
  const len = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} sa${m % 60 ? ` ${m % 60} dk` : ''}` : `${m} dk`)
  return (
    <section className="hcard">
      <div className="hcard-head">
        <h3><Clock4 size={20} /> Boş Saatler</h3>
        <button className="link-head" onClick={onFind}><Search size={14} /> Başka gün</button>
      </div>
      {gaps.length === 0 ? <p className="muted small">{day === today ? 'Bugün için boş aralık kalmadı.' : 'Bu gün boş aralık yok.'}</p> : (
        <div className="free-list">
          {gaps.map((g) => (
            <button key={g.from} className="free-chip" onClick={() => onNew(day, fromMinutes(g.from), fromMinutes(Math.min(g.to, g.from + 60)))} title="Bu saate ders ekle">
              <b>{fromMinutes(g.from)} – {fromMinutes(g.to)}</b>
              <small>{len(g.to - g.from)}</small>
              <Plus size={15} />
            </button>
          ))}
        </div>
      )}
      <small className="muted free-hint">Ayarlar'daki gün başlangıç ve bitiş saatine göre (en az 45 dk).</small>
    </section>
  )
}

/** Yaklaşan sınavlar ve kalan gün */
export function ExamsBox({ onOpenExam, onAddExam }: { onOpenExam: (x: Exam) => void; onAddExam: () => void }) {
  const data = useData()
  const today = todayISO()
  const list = data.exams.filter((x) => x.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4)
  return (
    <section className="hcard">
      <div className="hcard-head">
        <h3><GraduationCap size={20} /> Sınavlar</h3>
        <button className="icon-btn" onClick={onAddExam} aria-label="Sınav ekle"><Plus size={20} /></button>
      </div>
      {list.length === 0 ? <p className="muted small">Yaklaşan sınav yok. Sınıf ya da öğrenci sınavlarını ekleyince geri sayım burada görünür.</p> : (
        <ul className="exam-count">
          {list.map((x) => {
            const n = daysTo(today, x.date)
            const who = x.groupCode ? data.groups[x.groupCode]?.name ?? x.groupCode : x.studentId ? data.students.find((s) => s.id === x.studentId)?.name : undefined
            return (
              <li key={x.id}>
                <button onClick={() => onOpenExam(x)}>
                  <span className={'ec-days' + (n <= 3 ? ' soon' : '')}><b>{n === 0 ? 'Bugün' : n}</b>{n > 0 && <small>gün</small>}</span>
                  <span className="grow"><b>{x.title}</b><small className="muted">{formatDMY(x.date)}{who && !x.title.includes(who) ? ` · ${who}` : ''}</small></span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/** Hatırlatmalar: ödeme bekleyen dersler (tutarsız), yaklaşan ödemelerim, geciken görevler, yakın sınavlar */
export function AlertsBox({ onReminders, goBills, goTasks }: { onReminders: () => void; goBills: () => void; goTasks: () => void }) {
  const data = useData()
  const today = todayISO()
  const reminders = usePayReminders()
  const bills = useMemo(() => upcomingBills(data, today, 3), [data, today])
  const lateTasks = data.tasks.filter((t) => !t.done && t.due && t.due < today)
  const dueToday = data.tasks.filter((t) => !t.done && t.due === today)
  const people = [...new Set(reminders.map((r) => data.students.find((s) => s.id === r.event.studentId)?.name).filter(Boolean))]
  const items: { key: string; icon: JSX.Element; tone: string; title: string; sub?: string; run: () => void }[] = []
  if (reminders.length) items.push({ key: 'p', icon: <Wallet size={18} />, tone: 'warn', title: `${reminders.length} dersin ödemesi bekleniyor`, sub: people.slice(0, 3).join(', ') + (people.length > 3 ? '…' : ''), run: onReminders })
  for (const r of bills.slice(0, 2)) {
    const n = daysTo(today, r.due)
    items.push({ key: 'b' + r.bill.id, icon: <Receipt size={18} />, tone: r.state === 'late' ? 'danger' : 'info', title: `${r.bill.name}`, sub: r.state === 'late' ? 'son günü geçti' : n === 0 ? 'son gün bugün' : `son güne ${n} gün`, run: goBills })
  }
  if (bills.length > 2) items.push({ key: 'bm', icon: <Receipt size={18} />, tone: 'info', title: `${bills.length - 2} ödeme daha yaklaşıyor`, run: goBills })
  if (lateTasks.length) items.push({ key: 'lt', icon: <AlarmClock size={18} />, tone: 'danger', title: `${lateTasks.length} görevin tarihi geçti`, sub: lateTasks.slice(0, 2).map((t) => t.title).join(', '), run: goTasks })
  if (dueToday.length) items.push({ key: 'dt', icon: <CalendarClock size={18} />, tone: 'info', title: `${dueToday.length} görev bugün bitmeli`, sub: dueToday.slice(0, 2).map((t) => t.title).join(', '), run: goTasks })
  return (
    <section className="hcard">
      <div className="hcard-head"><h3><BellRing size={20} /> Hatırlatmalar</h3></div>
      {items.length === 0 ? <div className="all-done"><span>🌿</span><p className="muted small">Her şey yolunda; bekleyen ödeme ya da geciken iş yok.</p></div> : (
        <ul className="alert-list">
          {items.slice(0, 5).map((it) => (
            <li key={it.key}>
              <button className={'alert ' + it.tone} onClick={it.run}>
                <span className="al-ico">{it.icon}</span>
                <span className="grow"><b>{it.title}</b>{it.sub && <small>{it.sub}</small>}</span>
                <ChevronRight size={17} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Bu hafta: ders sayısı, saat, öğrenci ve günlere göre ders saati grafiği */
export function WeekBox({ onDay }: { onDay: (d: string) => void }) {
  const data = useData()
  const today = todayISO()
  const ws = startOfWeek(today)
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i))
  const evs = data.events.filter((e) => e.date >= ws && e.date <= days[6] && !isOff(e) && e.kind !== 'diger')
  const hours = days.map((d) => evs.filter((e) => e.date === d).reduce((a, e) => a + (toMinutes(e.end) - toMinutes(e.start)) / 60, 0))
  const total = hours.reduce((a, b) => a + b, 0)
  const max = Math.max(1, ...hours)
  const done = evs.filter((e) => e.date < today || (e.date === today && e.end <= nowHM())).length
  const students = new Set(evs.filter((e) => e.kind === 'ozel').map((e) => e.studentId)).size
  const fmt = (h: number) => (Math.round(h * 10) / 10).toLocaleString('tr-TR')
  return (
    <section className="hcard">
      <div className="hcard-head">
        <h3><BarChart3 size={20} /> Bu Hafta</h3>
        <span className="muted small">{done}/{evs.length} ders yapıldı</span>
      </div>
      <div className="week-stats">
        <div className="ws a"><b>{evs.length}</b><span>Ders</span></div>
        <div className="ws b"><b>{fmt(total)}</b><span>Saat</span></div>
        <div className="ws c"><b>{students}</b><span>Öğrenci</span></div>
      </div>
      <div className="week-bars" role="img" aria-label={`Günlere göre ders saati: ${days.map((d, i) => `${TR_DAYS_SHORT[i]} ${fmt(hours[i])}`).join(', ')}`}>
        {days.map((d, i) => (
          <button key={d} className={'wb' + (d === today ? ' today' : '') + (d < today ? ' past' : '')} onClick={() => onDay(d)} title={`${TR_DAYS_SHORT[i]}: ${fmt(hours[i])} saat`}>
            <span className="wb-bar"><i style={{ height: `${Math.max(hours[i] ? 8 : 0, (hours[i] / max) * 100)}%` }} /></span>
            <small>{TR_DAYS_SHORT[i]}</small>
          </button>
        ))}
      </div>
    </section>
  )
}

/** Günün sözü: her gün farklı, kısa bir öğretmenlik sözü */
const QUOTES = [
  'Küçük adımlar, büyük ilerlemeler sağlar.',
  'Öğretmek, iki kez öğrenmektir.',
  'Her öğrenci kendi hızında büyür.',
  'Sabır, en iyi öğretim yöntemidir.',
  'Bugün atılan tohum, yarının ağacıdır.',
  'Merak, öğrenmenin anahtarıdır.',
  'İyi bir soru, iyi bir cevaptan değerlidir.',
  'Hata, öğrenmenin bir parçasıdır.',
  'Düzenli tekrar, kalıcı öğrenmedir.',
  'Bir öğrenciye inanmak, ona kanat vermektir.',
  'Planlı gün, huzurlu akşam.',
  'Az ama her gün.',
  'Anlamak, ezberlemekten güçlüdür.',
  'Dinlenmek de işin bir parçası.',
]
export function quoteOfDay(today: string): string {
  const n = Math.floor(fromISO(today).getTime() / 864e5)
  return QUOTES[((n % QUOTES.length) + QUOTES.length) % QUOTES.length]
}
