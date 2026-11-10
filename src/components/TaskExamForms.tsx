import { useState } from 'react'
import type { Exam, Task } from '../lib/types'
import { deleteExam, deleteTask, saveExam, saveTask, useData } from '../lib/store'
import { addDays, startOfWeek, todayISO } from '../lib/date'
import { uid } from '../lib/util'
import Modal from './Modal'
import TimePicker from './TimePicker'

/** Görev bağlantısı: sınıf ya da öğrenci (opsiyonel) */
function LinkSelect({ groupCode, studentId, onChange }: { groupCode?: string; studentId?: string; onChange: (g?: string, s?: string) => void }) {
  const data = useData()
  const value = groupCode ? 'g:' + groupCode : studentId ? 's:' + studentId : ''
  return (
    <select
      value={value}
      onChange={(e) => {
        const v = e.target.value
        onChange(v.startsWith('g:') ? v.slice(2) : undefined, v.startsWith('s:') ? v.slice(2) : undefined)
      }}
    >
      <option value="">— (genel)</option>
      {Object.keys(data.groups).length > 0 && (
        <optgroup label="Kurum sınıfları">
          {Object.values(data.groups).sort((a, b) => a.code.localeCompare(b.code)).map((g) => <option key={g.code} value={'g:' + g.code}>{g.name ? `${g.name} (${g.code})` : g.code}</option>)}
        </optgroup>
      )}
      {data.students.length > 0 && (
        <optgroup label="Özel ders öğrencileri">
          {data.students.filter((s) => s.active).map((s) => <option key={s.id} value={'s:' + s.id}>{s.name}</option>)}
        </optgroup>
      )}
    </select>
  )
}

export function newTask(extra: Partial<Task> = {}): Task {
  return { id: uid(), title: '', done: false, createdAt: Date.now(), ...extra }
}

export function TaskForm({ initial, onClose }: { initial: Task; onClose: () => void }) {
  const data = useData()
  const today = todayISO()
  const [t, setT] = useState<Task>(initial)
  const isNew = !data.tasks.some((x) => x.id === t.id)
  const quick: [string, string][] = [['Bugün', today], ['Yarın', addDays(today, 1)], ['Hafta sonu', addDays(startOfWeek(today), 6)], ['Gelecek hafta', addDays(startOfWeek(today), 7)]]
  return (
    <Modal
      title={isNew ? 'Yeni görev' : 'Görev'}
      onClose={onClose}
      footer={
        <>
          {!isNew && <button className="btn danger" onClick={() => { deleteTask(t.id); onClose() }}>Sil</button>}
          <div className="spacer" />
          <button className="btn" onClick={onClose}>Vazgeç</button>
          <button className="btn primary" disabled={!t.title.trim()} onClick={() => { saveTask({ ...t, title: t.title.trim() }); onClose() }}>Kaydet</button>
        </>
      }
    >
      <label className="field"><span>Ne yapılacak?</span><input autoFocus value={t.title} onChange={(e) => setT({ ...t, title: e.target.value })} placeholder="ör. 8-H yazılı kağıtlarını oku" /></label>
      <div className="field">
        <span>Son tarih (opsiyonel)</span>
        <div className="chips">
          <button className={'chip' + (!t.due ? ' sel' : '')} onClick={() => setT({ ...t, due: undefined })}>Yok</button>
          {quick.map(([l, d]) => <button key={l} className={'chip' + (t.due === d ? ' sel' : '')} onClick={() => setT({ ...t, due: d })}>{l}</button>)}
          <input type="date" className="mini-date" value={t.due ?? ''} onChange={(e) => setT({ ...t, due: e.target.value || undefined })} />
        </div>
      </div>
      <label className="field"><span>İlgili sınıf / öğrenci</span><LinkSelect groupCode={t.groupCode} studentId={t.studentId} onChange={(g, s) => setT({ ...t, groupCode: g, studentId: s })} /></label>
      {!isNew && <label className="check"><input type="checkbox" checked={t.done} onChange={(e) => setT({ ...t, done: e.target.checked, doneAt: e.target.checked ? today : undefined })} /> Tamamlandı</label>}
    </Modal>
  )
}

export function newExam(extra: Partial<Exam> = {}): Exam {
  return { id: uid(), title: '', date: todayISO(), createdAt: Date.now(), ...extra }
}

export function ExamForm({ initial, onClose }: { initial: Exam; onClose: () => void }) {
  const data = useData()
  const [x, setX] = useState<Exam>(initial)
  const isNew = !data.exams.some((e) => e.id === x.id)
  const presets = ['1. Yazılı', '2. Yazılı', 'Deneme sınavı', 'Quiz', 'Proje teslimi']
  return (
    <Modal
      title={isNew ? 'Sınav / yazılı ekle' : 'Sınav'}
      onClose={onClose}
      footer={
        <>
          {!isNew && <button className="btn danger" onClick={() => { deleteExam(x.id); onClose() }}>Sil</button>}
          <div className="spacer" />
          <button className="btn" onClick={onClose}>Vazgeç</button>
          <button className="btn primary" disabled={!x.title.trim() || !x.date} onClick={() => { saveExam({ ...x, title: x.title.trim() }); onClose() }}>Kaydet</button>
        </>
      }
    >
      <label className="field"><span>Sınav</span><input autoFocus value={x.title} onChange={(e) => setX({ ...x, title: e.target.value })} placeholder="ör. 8-H Matematik 1. yazılı" /></label>
      <div className="chips" style={{ marginTop: -4 }}>
        {presets.map((p) => <button key={p} className="chip" onClick={() => setX({ ...x, title: x.title ? `${x.title.replace(/ ?(1\. Yazılı|2\. Yazılı|Deneme sınavı|Quiz|Proje teslimi)$/, '')} ${p}`.trim() : p })}>{p}</button>)}
      </div>
      <div className="row wrap">
        <label className="field grow"><span>Tarih</span><input type="date" value={x.date} onChange={(e) => e.target.value && setX({ ...x, date: e.target.value })} /></label>
        <div className="field">
          <span>Saat (opsiyonel)</span>
          {x.start ? (
            <span className="row middle" style={{ minHeight: 0, gap: 4 }}><TimePicker value={x.start} onChange={(v) => setX({ ...x, start: v })} /><button className="btn small ghost" onClick={() => setX({ ...x, start: undefined })}>Kaldır</button></span>
          ) : (
            <button className="btn" onClick={() => setX({ ...x, start: '10:00' })}>+ Saat ekle</button>
          )}
        </div>
      </div>
      <label className="field"><span>Sınıf / öğrenci</span><LinkSelect groupCode={x.groupCode} studentId={x.studentId} onChange={(g, s) => setX({ ...x, groupCode: g, studentId: s })} /></label>
      <label className="field"><span>Konular / not</span><textarea rows={2} value={x.note ?? ''} onChange={(e) => setX({ ...x, note: e.target.value || undefined })} placeholder="ör. Üslü ifadeler, kareköklü sayılar" /></label>
    </Modal>
  )
}
