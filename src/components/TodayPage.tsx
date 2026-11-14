import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight, BarChart3, Bell, BellRing, BookOpen, CalendarDays, CalendarPlus, Check, ChevronLeft, ChevronRight, Clock, FileText,
  GraduationCap, Layers, Lightbulb, ListTodo, Moon, Play, Plus, Search, Settings, Sun, Sunrise, Timer, Users, Zap,
} from 'lucide-react'
import type { OpenEvent } from '../App'
import type { CalEvent, Memo, Task } from '../lib/types'
import { deleteMemo, eventColor, eventTitle, saveMemo, saveTask, setData, useData } from '../lib/store'
import { TR_DAYS_SHORT, addDays, addMonths, formatDMY, formatLong, fromISO, monthLabel, nowHM, startOfMonth, startOfWeek, toMinutes, todayISO } from '../lib/date'
import { upcomingBills } from '../lib/bills'
import { isOff } from '../lib/status'
import { showToast } from '../lib/toast'
import { uid } from '../lib/util'
import { sortTasks } from './TasksPage'
import SyncBadge from './SyncBadge'
import Modal from './Modal'

function greeting(min: number) {
  if (min < 12 * 60) return { text: 'Günaydın', Icon: Sunrise }
  if (min < 18 * 60) return { text: 'İyi günler', Icon: Sun }
  return { text: 'İyi akşamlar', Icon: Moon }
}

function relative(mins: number) {
  if (mins < 60) return `${mins} dk`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h} sa ${m} dk` : `${h} saat`
}

const shortName = (d: ReturnType<typeof useData>, e: CalEvent) =>
  e.kind === 'kurum' && e.groupCode ? d.groups[e.groupCode]?.name || e.groupCode
  : e.kind === 'ozel' && e.studentId ? `Özel: ${d.students.find((s) => s.id === e.studentId)?.name ?? e.title}`
  : e.title

const dayWord = (iso: string, today: string) => (iso === today ? 'Bugün' : iso === addDays(today, 1) ? 'Yarın' : `${fromISO(iso).getDate()} ${monthLabel(iso).split(' ')[0].slice(0, 3)} ${TR_DAYS_SHORT[(fromISO(iso).getDay() + 6) % 7]}`)

/** Ana sayfa: selamlama, günün dersleri, sıradaki ders, hızlı işlemler, görevler, haftalık bakış, takvim, notlar, yaklaşanlar */
export default function TodayPage({ openEvent, goCalendar, goSettings, onSearch, openTask, goBills, goTasks, onNewEvent, onNewTask, goReports, reminderCount, onReminders }: {
  goBills: () => void
  goTasks: () => void
  openEvent: OpenEvent
  goCalendar: (date?: string) => void
  goSettings: () => void
  onSearch: () => void
  openTask: (t: Task) => void
  onNewEvent: (date?: string) => void
  onNewTask: () => void
  goReports: () => void
  reminderCount: number
  onReminders: () => void
}) {
  const data = useData()
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  const today = todayISO()
  const [day, setDay] = useState(today)
  const [memoOpen, setMemoOpen] = useState<Memo | null>(null)
  const [bellOpen, setBellOpen] = useState(false)
  const now = toMinutes(nowHM())
  const { text, Icon } = greeting(now)
  const name = data.settings.userName?.trim()

  const active = useMemo(
    () => data.events.filter((e) => !isOff(e)).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)),
    [data.events],
  )
  const dayEvents = data.events.filter((e) => e.date === day).sort((a, b) => a.start.localeCompare(b.start))
  const ongoing = active.find((e) => e.date === today && toMinutes(e.start) <= now && toMinutes(e.end) > now)
  const next = active.find((e) => e.date > today || (e.date === today && toMinutes(e.start) > now))
  const hero = ongoing ?? next
  const todayLeft = active.filter((e) => e.date === today && toMinutes(e.end) > now).length

  // Bildirimler: ödeme bekleyen dersler, gecikmiş ödemelerim, gecikmiş görevler
  const lateBills = useMemo(() => upcomingBills(data, today, 0).filter((r) => r.state === 'late' || r.due === today), [data, today])
  const lateTasks = data.tasks.filter((t) => !t.done && t.due && t.due < today)
  const bellCount = reminderCount + lateBills.length + lateTasks.length

  const subtitle = name
    ? todayLeft ? `Bugün ${todayLeft} dersin kaldı.` : active.some((e) => e.date === today) ? 'Bugünkü programın bitti. 🎉' : 'Bugün programın boş, iyi dinlenmeler.'
    : 'Adını eklemek için sağ üstteki daireye dokun.'

  const setName = () => {
    const v = prompt('Adınız (ana sayfadaki selamlamada görünür):', name ?? '')
    if (v === null) return
    setData((d) => ({ ...d, settings: { ...d.settings, userName: v.trim() || undefined } }))
  }

  return (
    <div className="page home">
      <header className="home-head">
        <div className="home-hello">
          <h1>{text}{name ? `, ${name}` : ''} <span className="wave" aria-hidden>👋</span></h1>
          <p className="muted"><Icon size={15} /> {subtitle}</p>
        </div>
        <DeskArt />
        <div className="head-actions">
          <SyncBadge compact onClick={goSettings} />
          <button className="round-btn" onClick={onSearch} aria-label="Ara"><Search size={20} /></button>
          <button className="round-btn" onClick={() => setBellOpen(true)} aria-label={`Bildirimler${bellCount ? ` (${bellCount})` : ''}`}>
            <Bell size={20} />{bellCount > 0 && <em className="bell-dot">{bellCount > 9 ? '9+' : bellCount}</em>}
          </button>
          <button className="avatar-btn" onClick={setName} title={name ? `${name} · adı değiştir` : 'Adınızı ekleyin'}>{(name || '?').slice(0, 1).toLocaleUpperCase('tr')}</button>
          <button className="round-btn only-mobile" onClick={goSettings} aria-label="Ayarlar"><Settings size={20} /></button>
        </div>
      </header>

      <div className="home-date">
        <CalendarDays size={22} />
        <b>{formatLong(day)}</b>
        <span className="spacer" />
        <button className="icon-btn" onClick={() => setDay(addDays(day, -1))} aria-label="Önceki gün"><ChevronLeft size={20} /></button>
        <button className={'btn small' + (day === today ? ' ghost' : '')} onClick={() => setDay(today)}>Bugün</button>
        <button className="icon-btn" onClick={() => setDay(addDays(day, 1))} aria-label="Sonraki gün"><ChevronRight size={20} /></button>
      </div>

      <div className="home-grid">
        {/* Günün dersleri: zaman çizelgesi */}
        <section className="hcard lessons-card">
          <div className="hcard-head">
            <h3><Layers size={20} /> {day === today ? 'Bugünün Dersleri' : `${dayWord(day, today)} Dersleri`}</h3>
            <button className="link-head" onClick={() => goCalendar(day)}>Tam programı gör <ArrowRight size={15} /></button>
          </div>
          {dayEvents.length === 0 ? (
            <div className="lessons-empty">
              <p className="muted">{day === today ? 'Bugün ders yok.' : 'Bu gün ders yok.'}</p>
              <button className="btn small" onClick={() => onNewEvent(day)}><Plus size={14} /> Ders ekle</button>
            </div>
          ) : (
            <div className="timeline">
              {dayEvents.map((e) => {
                const live = e === ongoing
                const past = day < today || (day === today && toMinutes(e.end) <= now)
                const Ico = e.kind === 'kurum' ? BookOpen : e.kind === 'ozel' ? Users : CalendarDays
                return (
                  <button key={e.id} className={'tl-item' + (live ? ' live' : '') + (past ? ' past' : '') + (isOff(e) ? ' off' : '')} style={{ ['--ev' as string]: eventColor(data, e) }} onClick={() => openEvent(e)}>
                    <span className="tl-card">
                      <Ico size={24} strokeWidth={1.7} />
                      <b>{shortName(data, e)}</b>
                      <small>{isOff(e) ? 'İptal' : `${e.start} – ${e.end}`}</small>
                    </span>
                    <span className="tl-dot" />
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {/* Sıradaki ders */}
        {hero ? (
          <button className={'hcard next-card' + (hero === ongoing ? ' live' : '')} style={{ ['--ev' as string]: eventColor(data, hero) }} onClick={() => openEvent(hero)}>
            <span className="next-label">{hero === ongoing ? <><span className="pulse" /> Şu an</> : <><Clock size={18} /> Sıradaki Ders</>}</span>
            <b className="next-title">{shortName(data, hero)}</b>
            <span className="next-row"><CalendarDays size={16} /> {dayWord(hero.date, today)}, {hero.start} – {hero.end}</span>
            <span className="next-row"><Timer size={16} /> {hero === ongoing ? `bitişe ${relative(toMinutes(hero.end) - now)}` : hero.date === today ? `${relative(toMinutes(hero.start) - now)} sonra` : eventTitle(data, hero) !== shortName(data, hero) ? eventTitle(data, hero) : ' '}</span>
            <span className="next-btn"><Play size={16} fill="currentColor" /> {hero === ongoing ? 'Derse git' : 'Dersi aç'}</span>
            <MathDeco />
          </button>
        ) : (
          <div className="hcard next-card empty">
            <span className="next-label"><Clock size={18} /> Sıradaki Ders</span>
            <b className="next-title">Planlı ders yok</b>
            <span className="next-row">Takvimden ders ekleyebilir ya da kurum programını yükleyebilirsin.</span>
          </div>
        )}

        {/* Hızlı işlemler */}
        <section className="hcard">
          <div className="hcard-head"><h3><Zap size={20} /> Hızlı İşlemler</h3></div>
          <div className="quick-grid">
            <button onClick={() => onNewEvent()}><span className="qi accent"><CalendarPlus size={20} /></span>Yeni Ders</button>
            <button onClick={onNewTask}><span className="qi"><ListTodo size={20} /></span>Yeni Görev</button>
            <button onClick={() => setMemoOpen({ id: uid(), text: '', createdAt: Date.now() })}><span className="qi"><FileText size={20} /></span>Not Ekle</button>
            <button onClick={goReports}><span className="qi"><BarChart3 size={20} /></span>Rapor Al</button>
          </div>
        </section>

        <TasksBox openTask={openTask} goTasks={goTasks} />
        <WeekBox />
        <MiniMonth day={day} onPick={setDay} onOpen={goCalendar} />
        <MemosBox onOpen={setMemoOpen} />
        <UpcomingBox openEvent={openEvent} goBills={goBills} openTask={openTask} />
      </div>

      {memoOpen && <MemoEditor memo={memoOpen} onClose={() => setMemoOpen(null)} />}
      {bellOpen && (
        <Modal title={<span className="row-title"><BellRing size={19} /> Bildirimler</span>} onClose={() => setBellOpen(false)}>
          {bellCount === 0 ? <p className="muted">Yeni bildirim yok. 🎉</p> : (
            <div className="choice-list">
              {reminderCount > 0 && (
                <button className="choice" onClick={() => { setBellOpen(false); onReminders() }}>
                  <b>💳 {reminderCount} dersin ödemesi bekleniyor</b>
                  <small>Ödeme alındıysa işaretleyin ya da sonraya bırakın.</small>
                </button>
              )}
              {lateBills.length > 0 && (
                <button className="choice" onClick={() => { setBellOpen(false); goBills() }}>
                  <b>🧾 {lateBills.length} ödemenin son günü geldi / geçti</b>
                  <small>{lateBills.map((r) => r.bill.name).join(', ')}</small>
                </button>
              )}
              {lateTasks.length > 0 && (
                <button className="choice" onClick={() => { setBellOpen(false); goTasks() }}>
                  <b>⏰ {lateTasks.length} görevin tarihi geçti</b>
                  <small>{lateTasks.slice(0, 3).map((t) => t.title).join(', ')}{lateTasks.length > 3 ? '…' : ''}</small>
                </button>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

/* ---------------- Görevlerim ---------------- */

function TasksBox({ openTask, goTasks }: { openTask: (t: Task) => void; goTasks: () => void }) {
  const data = useData()
  const today = todayISO()
  const open = sortTasks(data.tasks.filter((t) => !t.done), 'tarih')
  const doneToday = data.tasks.filter((t) => t.done && t.doneAt === today).slice(0, 2)
  const list = [...doneToday, ...open].slice(0, 5)
  const toggle = (t: Task) => {
    const before = { ...t }
    saveTask({ ...t, done: !t.done, doneAt: !t.done ? today : undefined })
    if (!t.done) showToast(`Tamamlandı: ${t.title}`, [{ label: 'Geri al', run: () => saveTask(before) }])
  }
  return (
    <section className="hcard">
      <div className="hcard-head">
        <h3><Check size={20} /> Görevlerim</h3>
        <button className="link-head muted" onClick={goTasks}>{open.length} açık görev</button>
      </div>
      {list.length === 0 ? <p className="muted small">Açık görev yok.</p> : (
        <ul className="home-tasks">
          {list.map((t) => (
            <li key={t.id} className={t.done ? 'done' : ''}>
              <button className={'task-check' + (t.done ? ' on' : '')} onClick={() => toggle(t)} aria-label={t.done ? 'Geri aç' : 'Tamamla'}><Check size={14} /></button>
              <button className="ht-text" onClick={() => openTask(t)}>
                <span>{t.title}</span>
                {t.due && !t.done && <small className={t.due < today ? 'warn-text' : 'muted'}>{dayWord(t.due, today)}{t.due < today ? ' · gecikti' : ''}</small>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/* ---------------- Bu hafta ---------------- */

function WeekBox() {
  const data = useData()
  const today = todayISO()
  const ws = startOfWeek(today)
  const we = addDays(ws, 6)
  const lessons = data.events.filter((e) => e.date >= ws && e.date <= we && !isOff(e) && e.kind !== 'diger').length
  const tasks = data.tasks.filter((t) => !t.done).length
  const students = new Set(data.events.filter((e) => e.kind === 'ozel' && e.studentId && e.date >= ws && e.date <= we && !isOff(e)).map((e) => e.studentId)).size
  return (
    <section className="hcard">
      <div className="hcard-head"><h3><BarChart3 size={20} /> Bu Hafta</h3></div>
      <div className="week-stats">
        <div className="ws a"><GraduationCap size={28} strokeWidth={1.6} /><b>{lessons}</b><span>Ders</span></div>
        <div className="ws b"><Check size={28} strokeWidth={1.6} /><b>{tasks}</b><span>Görev</span></div>
        <div className="ws c"><Users size={28} strokeWidth={1.6} /><b>{students}</b><span>Öğrenci</span></div>
      </div>
    </section>
  )
}

/* ---------------- Mini ay takvimi ---------------- */

function MiniMonth({ day, onPick, onOpen }: { day: string; onPick: (d: string) => void; onOpen: (d: string) => void }) {
  const data = useData()
  const today = todayISO()
  const [month, setMonth] = useState(startOfMonth(day))
  useEffect(() => setMonth(startOfMonth(day)), [day])
  const first = startOfWeek(month)
  const cells = Array.from({ length: 42 }, (_, i) => addDays(first, i))
  const rows = cells[35].slice(0, 7) !== month.slice(0, 7) ? cells.slice(0, 35) : cells
  const busy = useMemo(() => new Set(data.events.filter((e) => !isOff(e)).map((e) => e.date)), [data.events])
  return (
    <section className="hcard mini-month">
      <div className="hcard-head">
        <h3>{monthLabel(month)}</h3>
        <span>
          <button className="icon-btn" onClick={() => setMonth(addMonths(month, -1))} aria-label="Önceki ay"><ChevronLeft size={18} /></button>
          <button className="icon-btn" onClick={() => setMonth(addMonths(month, 1))} aria-label="Sonraki ay"><ChevronRight size={18} /></button>
        </span>
      </div>
      <div className="mm-grid">
        {TR_DAYS_SHORT.map((d) => <span key={d} className="mm-h">{d}</span>)}
        {rows.map((d) => (
          <button
            key={d}
            className={'mm-d' + (d.slice(0, 7) !== month.slice(0, 7) ? ' other' : '') + (d === today ? ' today' : '') + (d === day ? ' sel' : '')}
            onClick={() => onPick(d)}
            onDoubleClick={() => onOpen(d)}
            aria-label={formatDMY(d)}
          >
            {fromISO(d).getDate()}
            {busy.has(d) && <i />}
          </button>
        ))}
      </div>
    </section>
  )
}

/* ---------------- Notlarım ---------------- */

function MemosBox({ onOpen }: { onOpen: (m: Memo) => void }) {
  const data = useData()
  const list = [...data.memos].sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt))
  return (
    <section className="hcard">
      <div className="hcard-head">
        <h3><FileText size={20} /> Notlarım</h3>
        <button className="icon-btn" onClick={() => onOpen({ id: uid(), text: '', createdAt: Date.now() })} aria-label="Not ekle"><Plus size={20} /></button>
      </div>
      {list.length === 0 ? (
        <button className="memo empty" onClick={() => onOpen({ id: uid(), text: '', createdAt: Date.now() })}><Lightbulb size={18} /> <span>Aklına geleni buraya not et (ör. "8-H için örnek sorular hazırlanacak").</span></button>
      ) : (
        <div className="memo-list">
          {list.slice(0, 3).map((m) => (
            <button key={m.id} className="memo" onClick={() => onOpen(m)}>
              <Lightbulb size={18} />
              <span>
                <span className="memo-text">{m.text}</span>
                <small>{formatDMY(new Date(m.updatedAt ?? m.createdAt).toLocaleDateString('sv'))}</small>
              </span>
            </button>
          ))}
          {list.length > 3 && <small className="muted">+{list.length - 3} not daha</small>}
        </div>
      )}
    </section>
  )
}

function MemoEditor({ memo, onClose }: { memo: Memo; onClose: () => void }) {
  const data = useData()
  const [text, setText] = useState(memo.text)
  const isNew = !data.memos.some((m) => m.id === memo.id)
  const save = () => {
    if (!text.trim()) return onClose()
    saveMemo({ ...memo, text: text.trim(), updatedAt: isNew ? undefined : Date.now() })
    onClose()
  }
  return (
    <Modal
      title={isNew ? 'Yeni not' : 'Not'}
      onClose={onClose}
      footer={
        <>
          {!isNew && (
            <button
              className="btn danger"
              onClick={() => {
                const before = { ...memo }
                deleteMemo(memo.id)
                showToast('Not silindi', [{ label: 'Geri al', run: () => saveMemo(before) }])
                onClose()
              }}
            >
              Sil
            </button>
          )}
          <div className="spacer" />
          <button className="btn" onClick={onClose}>Vazgeç</button>
          <button className="btn primary" disabled={!text.trim()} onClick={save}>Kaydet</button>
        </>
      }
    >
      <textarea className="memo-input" rows={5} autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="ör. 478-K0821 – türev konu tekrarı için örnek sorular hazırlanacak" />
    </Modal>
  )
}

/* ---------------- Yaklaşanlar ---------------- */

function UpcomingBox({ openEvent, goBills, openTask }: { openEvent: OpenEvent; goBills: () => void; openTask: (t: Task) => void }) {
  const data = useData()
  const today = todayISO()
  type Up = { key: string; date: string; time?: string; title: string; color: string; run: () => void }
  const items: Up[] = []
  const tomorrow = addDays(today, 1)
  for (const e of data.events) {
    if (e.date < tomorrow || e.date > addDays(today, 14) || isOff(e)) continue
    items.push({ key: e.id, date: e.date, time: e.start, title: shortName(data, e), color: eventColor(data, e), run: () => openEvent(e) })
  }
  for (const x of data.exams) {
    if (x.date < today || x.date > addDays(today, 30)) continue
    items.push({ key: x.id, date: x.date, time: x.start, title: `📝 ${x.title}`, color: '#dc2626', run: () => undefined })
  }
  for (const r of upcomingBills(data, today, 10)) items.push({ key: 'b' + r.bill.id + r.due, date: r.due, title: `🧾 ${r.bill.name} son gün`, color: r.bill.color, run: goBills })
  for (const t of data.tasks) {
    if (t.done || !t.due || t.due < tomorrow || t.due > addDays(today, 14)) continue
    items.push({ key: t.id, date: t.due, title: `☑ ${t.title}`, color: 'var(--primary)', run: () => openTask(t) })
  }
  // Aynı günün kurum dersleri çok olursa listeyi doldurmasın: önce farklı günler
  const sorted = items.sort((a, b) => (a.date + (a.time ?? '99')).localeCompare(b.date + (b.time ?? '99')))
  const shown: Up[] = []
  const perDay = new Map<string, number>()
  for (const it of sorted) {
    const n = perDay.get(it.date) ?? 0
    if (n >= 2) continue
    perDay.set(it.date, n + 1)
    shown.push(it)
    if (shown.length >= 5) break
  }
  return (
    <section className="hcard">
      <div className="hcard-head">
        <h3><CalendarDays size={20} /> Yaklaşanlar</h3>
      </div>
      {shown.length === 0 ? <p className="muted small">Önümüzdeki günlerde bir şey yok.</p> : (
        <ul className="upcoming">
          {shown.map((it) => (
            <li key={it.key}>
              <button onClick={it.run}>
                <i style={{ background: it.color }} />
                <span className="grow">
                  <b>{it.title}</b>
                  <small>{dayWord(it.date, today)}{it.time ? `, ${it.time}` : ''}</small>
                </span>
                <ChevronRight size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/* ---------------- Süsler ---------------- */

/** Başlıktaki masa çizimi: kitaplar, kupa (π), kalemlik, saksı */
function DeskArt() {
  return (
    <svg className="desk-art" viewBox="0 0 360 120" aria-hidden>
      <g opacity=".95">
        {/* raf */}
        <rect x="0" y="104" width="360" height="5" rx="2.5" fill="var(--line-strong)" opacity=".55" />
        {/* kitaplar */}
        <rect x="20" y="86" width="96" height="18" rx="3" fill="color-mix(in srgb, var(--primary) 55%, #6b7280)" />
        <rect x="26" y="70" width="88" height="16" rx="3" fill="color-mix(in srgb, var(--primary) 25%, #e9dcc3)" />
        <rect x="30" y="56" width="80" height="14" rx="3" fill="color-mix(in srgb, var(--primary) 40%, #94a3b8)" />
        <rect x="26" y="72" width="4" height="12" fill="#fff" opacity=".5" />
        {/* kupa */}
        <rect x="140" y="62" width="40" height="42" rx="7" fill="#fbfaf6" stroke="var(--line-strong)" />
        <path d="M180 72 q16 0 16 12 q0 12 -16 12" fill="none" stroke="var(--line-strong)" strokeWidth="5" />
        <text x="160" y="92" textAnchor="middle" fontSize="22" fontFamily="serif" fill="color-mix(in srgb, var(--primary) 70%, #333)">π</text>
        {/* saksı ve bitki */}
        <path d="M232 82 h36 l-5 22 h-26 z" fill="#d6a77a" />
        <g fill="color-mix(in srgb, var(--primary) 30%, #4d8b4d)">
          <ellipse cx="238" cy="62" rx="9" ry="18" transform="rotate(-30 238 62)" />
          <ellipse cx="262" cy="60" rx="9" ry="18" transform="rotate(30 262 60)" />
          <ellipse cx="250" cy="50" rx="8" ry="20" />
          <ellipse cx="226" cy="76" rx="7" ry="13" transform="rotate(-60 226 76)" />
          <ellipse cx="274" cy="75" rx="7" ry="13" transform="rotate(60 274 75)" />
        </g>
        {/* kalemlik */}
        <rect x="300" y="72" width="34" height="32" rx="5" fill="color-mix(in srgb, var(--primary) 35%, #7c8b5a)" />
        <rect x="306" y="44" width="5" height="30" rx="2" fill="#2563eb" transform="rotate(-8 308 60)" />
        <rect x="316" y="40" width="5" height="34" rx="2" fill="#f59e0b" />
        <rect x="325" y="46" width="5" height="28" rx="2" fill="#dc2626" transform="rotate(10 327 60)" />
      </g>
    </svg>
  )
}

/** Sıradaki ders kartındaki ince matematik süsü */
function MathDeco() {
  return (
    <svg className="math-deco" viewBox="0 0 120 80" aria-hidden>
      <path d="M8 70 H112 M14 76 V6" stroke="currentColor" strokeWidth="1.5" fill="none" opacity=".45" />
      <path d="M18 66 C 40 66, 50 14, 64 14 S 90 60, 110 62" stroke="currentColor" strokeWidth="2" fill="none" opacity=".6" />
      <text x="92" y="18" fontSize="14" fill="currentColor" opacity=".7" fontStyle="italic">x²</text>
    </svg>
  )
}
