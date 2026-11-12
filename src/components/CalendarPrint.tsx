import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, FileDown, X } from 'lucide-react'
import type { AppData, CalEvent } from '../lib/types'
import { eventColor, useData } from '../lib/store'
import { TR_DAYS, addDays, addMonths, formatDMY, fromISO, monthLabel, startOfMonth, startOfWeek } from '../lib/date'
import { holidayMap } from '../lib/holidays'
import { isOff } from '../lib/status'
import { isNative, printPage } from '../lib/native'

type Mode = 'hafta' | 'ay'

const shortName = (d: AppData, e: CalEvent) =>
  e.kind === 'kurum' && e.groupCode ? d.groups[e.groupCode]?.name || e.groupCode
  : e.kind === 'ozel' && e.studentId ? d.students.find((s) => s.id === e.studentId)?.name ?? e.title
  : e.title

/** Takvimin yazdırılabilir / PDF olarak kaydedilebilir hâli (haftalık ya da aylık, yatay A4) */
export default function CalendarPrint({ date, initialMode, onClose }: { date: string; initialMode: Mode; onClose: () => void }) {
  const data = useData()
  const [mode, setMode] = useState<Mode>(initialMode)
  const [cursor, setCursor] = useState(date)
  const [times, setTimes] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    document.body.classList.add('print-cal')
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => {
      document.body.classList.remove('print-cal')
      window.removeEventListener('keydown', h)
    }
  }, [onClose])

  const hol = holidayMap(data)
  const byDay = new Map<string, CalEvent[]>()
  for (const e of data.events) {
    if (!byDay.has(e.date)) byDay.set(e.date, [])
    byDay.get(e.date)!.push(e)
  }
  byDay.forEach((l) => l.sort((a, b) => a.start.localeCompare(b.start)))

  const weekStart = startOfWeek(cursor)
  const monthStart = startOfMonth(cursor)
  const title = mode === 'hafta' ? `${formatDMY(weekStart)} – ${formatDMY(addDays(weekStart, 6))}` : monthLabel(monthStart)
  const step = (n: number) => setCursor(mode === 'hafta' ? addDays(cursor, n * 7) : addMonths(monthStart, n))

  const doPrint = async () => {
    setError('')
    try {
      await printPage(`Ders Asistani - ${title}`, true)
    } catch (e) {
      setError('Yazdırma açılamadı: ' + (e as Error).message)
    }
  }

  const evLine = (e: CalEvent) => (
    <div key={e.id} className={'pc-ev' + (isOff(e) ? ' off' : '')} style={{ ['--ev' as string]: eventColor(data, e) }}>
      {times && <span className="pc-t">{e.start}</span>}
      <span className="pc-n">{shortName(data, e)}</span>
    </div>
  )

  const days = mode === 'hafta' ? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)) : Array.from({ length: 42 }, (_, i) => addDays(startOfWeek(monthStart), i))
  // Ayın son haftası tamamen sonraki aya düşüyorsa gösterme
  const cells = mode === 'ay' && days[35].slice(0, 7) !== monthStart.slice(0, 7) ? days.slice(0, 35) : days

  return createPortal(
    <div className="print-sheet">
      <div className="ps-bar no-print">
        <button className="icon-btn" onClick={onClose} aria-label="Kapat"><X size={20} /></button>
        <div className="seg small inline-seg">
          <button className={mode === 'hafta' ? 'active' : ''} onClick={() => setMode('hafta')}>Hafta</button>
          <button className={mode === 'ay' ? 'active' : ''} onClick={() => setMode('ay')}>Ay</button>
        </div>
        <span className="month-nav">
          <button className="icon-btn" onClick={() => step(-1)} aria-label="Önceki"><ChevronLeft size={18} /></button>
          <span>{title}</span>
          <button className="icon-btn" onClick={() => step(1)} aria-label="Sonraki"><ChevronRight size={18} /></button>
        </span>
        <label className="check"><input type="checkbox" checked={times} onChange={(e) => setTimes(e.target.checked)} /> Saatler</label>
        <div className="spacer" />
        <button className="btn primary" onClick={doPrint}><FileDown size={16} /> {isNative ? 'PDF / Yazdır' : 'Yazdır / PDF'}</button>
      </div>
      {isNative && <p className="ps-hint no-print">Açılan ekranda yazıcı olarak <b>"PDF olarak kaydet"</b>i seçin.</p>}
      {error && <div className="error no-print">{error}</div>}

      <div className={'print-page ' + mode}>
        <div className="pp-head">
          <b>{mode === 'hafta' ? 'Haftalık program' : 'Aylık program'}</b>
          <span>{title}</span>
        </div>
        <div className={'pc-grid ' + mode}>
          {TR_DAYS.map((label, i) => {
            return <div key={label} className="pc-head">{mode === 'hafta' ? `${label} ${fromISO(days[i]).getDate()}.${fromISO(days[i]).getMonth() + 1}` : label}</div>
          })}
          {cells.map((d) => (
            <div key={d} className={'pc-cell' + (mode === 'ay' && d.slice(0, 7) !== monthStart.slice(0, 7) ? ' other' : '')}>
              {mode === 'ay' && <span className="pc-num">{fromISO(d).getDate()}</span>}
              {hol.get(d) && <div className="pc-hol">{hol.get(d)!.name}</div>}
              {(byDay.get(d) ?? []).map(evLine)}
            </div>
          ))}
        </div>
        <div className="pp-foot">Ders Asistanı</div>
      </div>
    </div>,
    document.body,
  )
}
