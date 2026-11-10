import { useEffect, useMemo, useState } from 'react'
import type { OpenEvent } from '../App'
import type { CalEvent } from '../lib/types'
import { eventColor, eventTitle, saveEvents, useData } from '../lib/store'
import { addMonths, formatShort, isPast, monthLabel, startOfMonth, todayISO } from '../lib/date'
import { downloadFile } from '../lib/util'
import { STATUS_LABEL } from './EventModal'

/** Geçmişte kalmış, henüz onaylanmamış (Planlandı) ve konusu yazılmamış ders */
export function needsNote(e: CalEvent): boolean {
  return e.kind !== 'diger' && !e.topic?.trim() && e.status === 'planned' && isPast(e.date, e.end)
}

type Range = 'month' | 'all'

export default function NotebookPage({ openEvent, initialMissing, onFilterUsed }: {
  openEvent: OpenEvent
  initialMissing: boolean
  onFilterUsed: () => void
}) {
  const data = useData()
  const [who, setWho] = useState('') // "g:KOD" veya "s:ID"
  const [onlyMissing, setOnlyMissing] = useState(initialMissing)
  const [range, setRange] = useState<Range>(initialMissing ? 'all' : 'month')
  const [month, setMonth] = useState(startOfMonth(todayISO()))
  const [q, setQ] = useState('')

  useEffect(() => {
    if (initialMissing) onFilterUsed()
  }, [initialMissing, onFilterUsed])

  const list = useMemo(() => {
    const today = todayISO()
    const ql = q.toLocaleLowerCase('tr')
    return data.events
      .filter((e) => e.kind !== 'diger')
      .filter((e) => !who || (who.startsWith('g:') ? e.groupCode === who.slice(2) : e.studentId === who.slice(2)))
      .filter((e) => range === 'all' || e.date.slice(0, 7) === month.slice(0, 7))
      .filter((e) => !onlyMissing || needsNote(e))
      .filter((e) => !onlyMissing || e.date <= today)
      .filter((e) => !ql || [e.topic, e.homework, e.notes, eventTitle(data, e)].some((t) => t?.toLocaleLowerCase('tr').includes(ql)))
      .sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start))
  }, [data, who, range, month, onlyMissing, q])

  const exportCSV = () => {
    const rows = [['Tarih', 'Başlangıç', 'Bitiş', 'Ders', 'Saat', 'Durum', 'Konu', 'Ödev', 'Notlar']]
    for (const e of [...list].reverse())
      rows.push([e.date, e.start, e.end, eventTitle(data, e), String(e.hours ?? 1), STATUS_LABEL[e.status], e.topic ?? '', e.homework ?? '', e.notes ?? ''])
    const csv = '﻿' + rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(';')).join('\r\n')
    downloadFile(`ders-defteri-${todayISO()}.csv`, csv, 'text/csv;charset=utf-8')
  }

  const groups = Object.values(data.groups).sort((a, b) => a.code.localeCompare(b.code))

  return (
    <div className="page">
      <div className="page-head">
        <h2>Ders Defteri</h2>
        <div className="spacer" />
        <button className="btn" onClick={exportCSV}>⬇ Excel (CSV)</button>
        <button className="btn" onClick={() => window.print()}>🖨 Yazdır</button>
      </div>
      <div className="filters">
        <select value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="">Tüm sınıflar ve öğrenciler</option>
          {groups.length > 0 && (
            <optgroup label="Kurum sınıfları">
              {groups.map((g) => <option key={g.code} value={'g:' + g.code}>{g.name ? `${g.name} (${g.code})` : g.code}</option>)}
            </optgroup>
          )}
          {data.students.length > 0 && (
            <optgroup label="Özel ders öğrencileri">
              {data.students.map((s) => <option key={s.id} value={'s:' + s.id}>{s.name}</option>)}
            </optgroup>
          )}
        </select>
        <select value={range} onChange={(e) => setRange(e.target.value as Range)}>
          <option value="month">Aylık</option>
          <option value="all">Tüm zamanlar</option>
        </select>
        {range === 'month' && (
          <span className="month-nav">
            <button className="icon-btn" onClick={() => setMonth(addMonths(month, -1))}>‹</button>
            <span>{monthLabel(month)}</span>
            <button className="icon-btn" onClick={() => setMonth(addMonths(month, 1))}>›</button>
          </span>
        )}
        <label className="check">
          <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} /> Sadece notu eksik olanlar
        </label>
        <input className="search" placeholder="Konu, ödev ara…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {onlyMissing && list.length > 0 && (
        <div className="banner warn bulk">
          <span>Eski dersleri tek tek doldurmak istemiyorsanız, listelenen dersleri konusuz olarak onaylayabilirsiniz.</span>
          <button
            className="btn small"
            onClick={() => {
              if (confirm(`Listelenen ${list.length} ders "Yapıldı" olarak işaretlensin mi?`)) saveEvents(list.map((e) => ({ ...e, status: 'done' })))
            }}
          >✓ Hepsini "Yapıldı" işaretle</button>
        </div>
      )}
      {list.length === 0 ? (
        <p className="muted pad">{onlyMissing ? 'Notu eksik ders yok. Harika! 🎉' : 'Bu filtrede ders bulunamadı.'}</p>
      ) : (
        <div className="table-wrap">
          <table className="table notebook">
            <thead>
              <tr><th>Tarih</th><th>Ders</th><th>Durum</th><th>Ne işlendi</th><th>Ödev</th><th>Notlar</th></tr>
            </thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.id} onClick={() => openEvent(e)} className={needsNote(e) ? 'missing' : ''}>
                  <td className="nowrap">{formatShort(e.date)}<br /><small className="muted">{e.start}–{e.end}</small></td>
                  <td><i className="dot" style={{ background: eventColor(data, e) }} />{eventTitle(data, e)}{e.hours && e.hours > 1 ? <small className="muted"> · {e.hours} saat</small> : null}</td>
                  <td><span className={'pill st-' + e.status}>{STATUS_LABEL[e.status]}</span></td>
                  <td>{e.topic || (needsNote(e) ? <span className="warn-text">Yazılmadı — doldurmak için tıklayın</span> : <span className="muted">—</span>)}</td>
                  <td>{e.homework}</td>
                  <td className="muted">{e.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small">{list.length} ders listeleniyor.</p>
    </div>
  )
}
