import { useRef } from 'react'
import { CalendarDays } from 'lucide-react'
import { formatDMY } from '../lib/date'

/** Gün.Ay.Yıl gösteren tarih alanı; dokununca cihazın takvim seçicisi açılır */
export default function DateInput({ value, onChange, min, max, className, placeholder = 'gg.aa.yyyy', allowEmpty }: {
  value: string
  onChange: (v: string) => void
  min?: string
  max?: string
  className?: string
  placeholder?: string
  allowEmpty?: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)
  const open = () => {
    const el = ref.current
    if (!el) return
    try {
      el.showPicker()
    } catch {
      el.focus()
      el.click()
    }
  }
  return (
    <span className={'date-input' + (className ? ' ' + className : '')} onClick={open} role="button" tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && open()}>
      <CalendarDays size={15} />
      <span className={value ? '' : 'muted'}>{value ? formatDMY(value) : placeholder}</span>
      <input
        ref={ref}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          if (e.target.value || allowEmpty) onChange(e.target.value)
        }}
      />
    </span>
  )
}
