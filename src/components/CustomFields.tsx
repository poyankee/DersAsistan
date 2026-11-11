import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { Student } from '../lib/types'
import { saveStudent, useData } from '../lib/store'
import { uid } from '../lib/util'

/** Öğrenciye özel serbest alanlar: ör. Okul, Hedef, Adres, Doğum günü */
export default function CustomFields({ student }: { student: Student }) {
  const data = useData()
  const fields = student.custom ?? []
  const [label, setLabel] = useState('')
  const [value, setValue] = useState('')
  // Diğer öğrencilerde kullanılan alan adları öneri olarak sunulur
  const known = Array.from(new Set(data.students.flatMap((s) => (s.custom ?? []).map((f) => f.label)))).filter((l) => !fields.some((f) => f.label === l))
  const suggestions = known.length ? known : ['Okul', 'Sınıf', 'Hedef', 'Adres', 'Doğum günü'].filter((l) => !fields.some((f) => f.label === l))

  const update = (custom: Student['custom']) => saveStudent({ ...student, custom })
  const add = () => {
    if (!label.trim()) return
    update([...fields, { id: uid(), label: label.trim(), value: value.trim() }])
    setLabel('')
    setValue('')
  }

  return (
    <div className="custom-fields">
      <h4>Özel bilgiler</h4>
      {fields.map((f) => (
        <div key={f.id} className="cf-row">
          <span className="cf-label">{f.label}</span>
          <input defaultValue={f.value} placeholder="—" onBlur={(e) => e.target.value !== f.value && update(fields.map((x) => (x.id === f.id ? { ...x, value: e.target.value.trim() } : x)))} />
          <button className="icon-btn" onClick={() => update(fields.filter((x) => x.id !== f.id))} aria-label={`${f.label} alanını sil`}><X size={16} /></button>
        </div>
      ))}
      <div className="cf-row cf-new">
        <input className="cf-label-input" list="cf-labels" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Alan adı (ör. Okul)" />
        <datalist id="cf-labels">{suggestions.map((s) => <option key={s} value={s} />)}</datalist>
        <input value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Bilgi" />
        <button className="btn small" onClick={add} disabled={!label.trim()}><Plus size={14} /> Ekle</button>
      </div>
      {fields.length === 0 && (
        <div className="chips" style={{ marginTop: 6 }}>
          {suggestions.slice(0, 5).map((s) => <button key={s} className="chip" onClick={() => setLabel(s)}>{s}</button>)}
        </div>
      )}
    </div>
  )
}
