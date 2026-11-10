import { useMemo, useState } from 'react'
import { CalendarSearch } from 'lucide-react'
import { useData } from '../lib/store'
import { findFreeGaps } from '../lib/freeSlots'
import { TR_DAYS_SHORT, formatLong, fromMinutes, nowHM, toMinutes, todayISO } from '../lib/date'
import Modal from './Modal'

const DURATIONS = [40, 60, 90, 120]
const RANGES: [number, string][] = [[7, '1 hafta'], [14, '2 hafta'], [30, '1 ay']]

/** Takvimdeki boş zamanları listeler; seçilen boşluğa ders yerleştirir */
export default function FreeSlotsModal({ title, initialDuration, from, ignoreId, onPick, onClose }: {
  title?: string
  initialDuration?: number
  from?: string
  ignoreId?: string
  onPick: (date: string, start: string, end: string) => void
  onClose: () => void
}) {
  const data = useData()
  const today = todayISO()
  const [dur, setDur] = useState(initialDuration ?? 60)
  const [days, setDays] = useState(14)
  const [buffer, setBuffer] = useState(10)
  const [weekdays, setWeekdays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6])
  const start = from && from > today ? from : today

  const gaps = useMemo(
    () => findFreeGaps(data, start, days, dur, {
      dayStart: data.settings.dayStart,
      dayEnd: data.settings.dayEnd,
      buffer,
      weekdays,
      skipHolidays: true,
      today,
      nowMin: toMinutes(nowHM()),
      ignoreId,
    }),
    [data, start, days, dur, buffer, weekdays, today, ignoreId],
  )
  const byDate = useMemo(() => {
    const m = new Map<string, typeof gaps>()
    for (const g of gaps) {
      if (!m.has(g.date)) m.set(g.date, [])
      m.get(g.date)!.push(g)
    }
    return m
  }, [gaps])

  const fmt = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} sa${m % 60 ? ` ${m % 60} dk` : ''}` : `${m} dk`)

  return (
    <Modal title={<span className="row-title"><CalendarSearch size={19} /> {title ?? 'Boş saat bul'}</span>} onClose={onClose} wide>
      <div className="free-filters">
        <div className="field">
          <span>Süre</span>
          <div className="chips">
            {DURATIONS.map((d) => <button key={d} className={'chip' + (dur === d ? ' sel' : '')} onClick={() => setDur(d)}>{fmt(d)}</button>)}
            <input type="number" className="mini-input" min={15} step={5} value={dur} onChange={(e) => setDur(Math.max(15, Number(e.target.value)))} aria-label="Süre (dk)" />
          </div>
        </div>
        <div className="field">
          <span>Aralık</span>
          <div className="chips">
            {RANGES.map(([n, l]) => <button key={n} className={'chip' + (days === n ? ' sel' : '')} onClick={() => setDays(n)}>{l}</button>)}
          </div>
        </div>
        <div className="field">
          <span>Günler</span>
          <div className="chips">
            {TR_DAYS_SHORT.map((d, i) => (
              <button key={d} className={'chip' + (weekdays.includes(i) ? ' sel' : '')} onClick={() => setWeekdays((w) => (w.includes(i) ? w.filter((x) => x !== i) : [...w, i]))}>{d}</button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>Dersler arası pay</span>
          <div className="chips">
            {[0, 10, 15, 30].map((b) => <button key={b} className={'chip' + (buffer === b ? ' sel' : '')} onClick={() => setBuffer(b)}>{b ? `${b} dk` : 'Yok'}</button>)}
          </div>
        </div>
      </div>
      <p className="muted small">Takvim saatleri: {String(data.settings.dayStart).padStart(2, '0')}:00–{String(data.settings.dayEnd).padStart(2, '0')}:00 (Ayarlar'dan değiştirilebilir). Tam gün tatiller atlanır. Bir boşluğa dokunarak oraya ders ekleyin.</p>
      {gaps.length === 0 ? (
        <p className="muted pad center">Bu ölçütlerle boş saat bulunamadı.</p>
      ) : (
        <div className="free-list">
          {Array.from(byDate.entries()).map(([date, list]) => (
            <div key={date} className="free-day">
              <div className="free-date">{formatLong(date)}{list[0].holiday ? <span className="hol-tag">{list[0].holiday}</span> : null}</div>
              <div className="chips">
                {list.map((g) => (
                  <button key={g.start} className="chip free-chip" onClick={() => onPick(date, g.start, fromMinutes(toMinutes(g.start) + dur))}>
                    <b>{g.start}–{g.end}</b> <span className="muted">{fmt(g.minutes)}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
