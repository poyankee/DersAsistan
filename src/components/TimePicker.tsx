const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))

/** 24 saatlik, dakikası adım adım seçilen saat seçici (cihaz diline göre AM/PM göstermez) */
export default function TimePicker({ value, onChange, step = 5, label }: { value: string; onChange: (v: string) => void; step?: number; label?: string }) {
  const [h, m] = (value || '00:00').split(':')
  const mins = Array.from({ length: 60 / step }, (_, i) => String(i * step).padStart(2, '0'))
  if (!mins.includes(m)) mins.push(m)
  mins.sort()
  return (
    <span className="time-picker" aria-label={label}>
      <select value={h} onChange={(e) => onChange(`${e.target.value}:${m}`)} aria-label={label ? `${label} saat` : 'Saat'}>
        {HOURS.map((x) => <option key={x} value={x}>{x}</option>)}
      </select>
      <b>:</b>
      <select value={m} onChange={(e) => onChange(`${h}:${e.target.value}`)} aria-label={label ? `${label} dakika` : 'Dakika'}>
        {mins.map((x) => <option key={x} value={x}>{x}</option>)}
      </select>
    </span>
  )
}
