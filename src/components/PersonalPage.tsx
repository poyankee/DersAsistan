import { useMemo } from 'react'
import { CalendarRange, GraduationCap, ListTodo, Plus, UserX } from 'lucide-react'
import type { CalEvent, Exam, Task } from '../lib/types'
import { saveTask, useData } from '../lib/store'
import { TR_DAYS, formatDMY, formatDMYDay, todayISO, weekdayIndex } from '../lib/date'
import { showToast } from '../lib/toast'

/** Kişisel kategoriler (ör. Yüksek lisans): haftalık dersler, devamsızlık, teslimler, sınavlar */
export default function PersonalPage({ onAddTask, onAddExam, onOpenTask, onOpenExam }: {
  onAddTask: (t: Partial<Task>) => void
  onAddExam: (x: Partial<Exam>) => void
  onOpenTask: (t: Task) => void
  onOpenExam: (x: Exam) => void
}) {
  const data = useData()
  return (
    <div className="page">
      <div className="page-head"><h2>Kişisel</h2></div>
      <p className="muted small" style={{ marginTop: -8 }}>Takvime "Kişisel" türünde eklediğiniz etkinlikler kategorilerine göre burada toplanır. Kategoriler Ayarlar'dan düzenlenebilir.</p>
      {data.categories.map((c) => <CategoryCard key={c.id} id={c.id} onAddTask={onAddTask} onAddExam={onAddExam} onOpenTask={onOpenTask} onOpenExam={onOpenExam} />)}
    </div>
  )
}

function CategoryCard({ id, onAddTask, onAddExam, onOpenTask, onOpenExam }: {
  id: string
  onAddTask: (t: Partial<Task>) => void
  onAddExam: (x: Partial<Exam>) => void
  onOpenTask: (t: Task) => void
  onOpenExam: (x: Exam) => void
}) {
  const data = useData()
  const today = todayISO()
  const cat = data.categories.find((c) => c.id === id)!
  const evs = data.events.filter((e) => e.kind === 'diger' && e.categoryId === id)

  // Aynı başlıklı etkinlikleri (ör. "Eğitim Yönetimi") ders olarak grupla: katılım / devamsızlık
  const courses = useMemo(() => {
    const m = new Map<string, CalEvent[]>()
    for (const e of evs) {
      const k = e.title.trim() || '(başlıksız)'
      m.set(k, [...(m.get(k) ?? []), e])
    }
    return Array.from(m.entries())
      .map(([title, list]) => {
        const past = list.filter((e) => e.date < today || (e.date === today && e.status !== 'planned'))
        const missed = past.filter((e) => e.status === 'cancelled' || e.status === 'postponed').length
        const upcoming = list.filter((e) => e.date >= today && e.status === 'planned').sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
        const sample = upcoming[0] ?? list[0]
        return { title, total: list.length, past: past.length, missed, next: upcoming[0], wd: weekdayIndex(sample.date), time: `${sample.start}–${sample.end}` }
      })
      .sort((a, b) => a.wd - b.wd)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.events, id, today])

  const tasks = data.tasks.filter((t) => t.categoryId === id && !t.done).sort((a, b) => (a.due ?? '9').localeCompare(b.due ?? '9'))
  const exams = data.exams.filter((x) => x.categoryId === id && x.date >= today).sort((a, b) => a.date.localeCompare(b.date))

  return (
    <section className="surface personal-card" style={{ ['--ev' as string]: cat.color }}>
      <div className="surface-head">
        <h3 className="row-title"><i className="dot" style={{ background: cat.color }} /> {cat.name}</h3>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn small" onClick={() => onAddTask({ categoryId: id })}><ListTodo size={14} /> Teslim / görev</button>
          <button className="btn small" onClick={() => onAddExam({ categoryId: id, title: '' })}><GraduationCap size={14} /> Sınav</button>
        </div>
      </div>

      {courses.length === 0 ? (
        <p className="muted small">Henüz bu kategoride etkinlik yok. Takvimde "+" → Etkinlik → <b>Kişisel</b> → {cat.name} seçip "Her hafta tekrarla" ile ekleyebilirsiniz.</p>
      ) : (
        <ul className="course-list">
          {courses.map((c) => (
            <li key={c.title}>
              <CalendarRange size={16} />
              <div className="grow">
                <b>{c.title}</b>
                <small className="muted">{TR_DAYS[c.wd]} {c.time}{c.next ? ` · sıradaki ${formatDMYDay(c.next.date)}` : ''}</small>
              </div>
              {c.past > 0 && (
                <span className={'attend' + (c.missed > 0 ? ' warn' : '')} title="Katılmadığınız / toplam geçmiş ders">
                  <UserX size={13} /> {c.missed}/{c.past}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {(tasks.length > 0 || exams.length > 0) && (
        <ul className="wk-list">
          {exams.map((x) => <li key={x.id} onClick={() => onOpenExam(x)} className="link-row"><GraduationCap size={14} /> <b>{formatDMY(x.date)}</b> {x.title}</li>)}
          {tasks.map((t) => (
            <li key={t.id} className="link-row">
              <button className="task-check" onClick={() => { saveTask({ ...t, done: true, doneAt: today }); showToast(`Tamamlandı: ${t.title}`, [{ label: 'Geri al', run: () => saveTask(t) }]) }} aria-label="Tamamla" />
              <span onClick={() => onOpenTask(t)}>{t.due ? <b>{formatDMY(t.due)} </b> : null}{t.title}</span>
            </li>
          ))}
        </ul>
      )}
      {courses.length > 0 && <p className="muted small" style={{ marginBottom: 0 }}><Plus size={11} /> Katılmadığınız bir derste takvimde etkinliğe dokunup "İptal / katılmadım" deyin; devamsızlık sayısı burada görünür.</p>}
    </section>
  )
}
