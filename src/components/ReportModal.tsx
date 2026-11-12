import { useEffect, useState } from 'react'
import { MessageCircle, Printer, Share2 } from 'lucide-react'
import { addMonths, startOfMonth, todayISO } from '../lib/date'
import { downloadFile, isNative, openExternal, printPage, waLink } from '../lib/native'
import DateInput from './DateInput'
import Modal from './Modal'

/** Döküm penceresi: tarih aralığı seç, metni gör, paylaş / yazdır / WhatsApp */
export default function ReportModal({ title, fileName, build, phone, onClose }: {
  title: string
  fileName: string
  build: (from?: string, to?: string) => string
  phone?: string
  onClose: () => void
}) {
  const today = todayISO()
  const [range, setRange] = useState<'ay' | 'gecen' | 'hepsi' | 'ozel'>('ay')
  const [from, setFrom] = useState(startOfMonth(today))
  const [to, setTo] = useState(today)
  const pick = (r: typeof range) => {
    setRange(r)
    if (r === 'ay') { setFrom(startOfMonth(today)); setTo(today) }
    if (r === 'gecen') { const s = addMonths(startOfMonth(today), -1); setFrom(s); setTo(new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, 0, 12).toLocaleDateString('sv')) }
  }
  const text = range === 'hepsi' ? build() : build(from, to)
  // Yeni pencere açılmaz (telefonda uygulamayı boş sayfada bırakıyordu): yalnızca döküm metni yazdırılır
  // Telefonda Android yazdırma hizmeti açılır ("PDF olarak kaydet"); yazdırma görünümü pencere kapanana kadar kalır
  useEffect(() => () => document.body.classList.remove('print-report'), [])
  const print = () => {
    document.body.classList.add('print-report')
    if (isNative) {
      printPage(`Ders Asistani - ${title}`).catch((e) => alert('Yazdırma açılamadı: ' + (e as Error).message))
      return
    }
    const done = () => {
      document.body.classList.remove('print-report')
      window.removeEventListener('afterprint', done)
    }
    window.addEventListener('afterprint', done)
    window.print()
    setTimeout(done, 60_000)
  }
  return (
    <Modal
      title={title}
      onClose={onClose}
      wide
      footer={
        <>
          <div className="spacer" />
          <button className="btn" onClick={print}><Printer size={15} /> {isNative ? 'PDF / Yazdır' : 'Yazdır'}</button>
          {phone && <button className="btn" onClick={() => openExternal(waLink(phone, text))}><MessageCircle size={15} /> WhatsApp</button>}
          <button className="btn primary" onClick={() => downloadFile(fileName, text, 'text/plain')}><Share2 size={15} /> Paylaş</button>
        </>
      }
    >
      <div className="chips">
        {([['ay', 'Bu ay'], ['gecen', 'Geçen ay'], ['hepsi', 'Tümü'], ['ozel', 'Tarih seç']] as const).map(([k, l]) => (
          <button key={k} className={'chip' + (range === k ? ' sel' : '')} onClick={() => pick(k)}>{l}</button>
        ))}
      </div>
      {range === 'ozel' && (
        <div className="row middle wrap" style={{ marginTop: 8 }}>
          <DateInput value={from} onChange={setFrom} /> <span className="muted">–</span> <DateInput value={to} min={from} onChange={setTo} />
        </div>
      )}
      <pre className="report">{text}</pre>
    </Modal>
  )
}
