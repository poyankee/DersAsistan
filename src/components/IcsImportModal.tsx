import { useMemo, useState } from 'react'
import { applyIcs, categoryNameFor, parseCalendarFile, planIcs, type IcsCalendar } from '../lib/icsImport'
import { setData, useData } from '../lib/store'
import { addDays, formatDMY, todayISO } from '../lib/date'
import Modal from './Modal'

/** Google Takvim yedeğini (.ics ya da .zip) kişisel etkinlik olarak içe aktarır */
export default function IcsImportModal({ onClose, onDone }: { onClose: () => void; onDone: (firstDate?: string) => void }) {
  const data = useData()
  const today = todayISO()
  const [cals, setCals] = useState<IcsCalendar[] | null>(null)
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [allDay, setAllDay] = useState(false)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const onFile = async (f: File | undefined) => {
    if (!f) return
    setError('')
    setBusy(true)
    setFileName(f.name)
    try {
      // Tekrarlayan etkinlikler 2 yıl ileriye kadar açılır
      const r = parseCalendarFile(await f.arrayBuffer(), f.name, { until: addDays(today, 730) })
      if (!r.length) setError('Dosyada takvim bulunamadı. Google Takvim → Ayarlar → İçe ve dışa aktar → Dışa aktar ile indirilen .zip ya da .ics dosyasını seçin.')
      setCals(r)
      setPicked(new Set(r.map((_, i) => i)))
    } catch (e) {
      console.error(e)
      setError('Dosya okunamadı: ' + (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const plans = useMemo(() => (cals ? cals.map((c) => planIcs(data, c, allDay)) : []), [cals, data, allDay])
  const chosen = cals ? cals.filter((_, i) => picked.has(i)) : []
  const freshCount = plans.reduce((a, p, i) => a + (picked.has(i) ? p.fresh.length : 0), 0)

  const doImport = () => {
    setData((d) => applyIcs(d, chosen, allDay))
    const first = plans.flatMap((p, i) => (picked.has(i) ? p.fresh : [])).map((o) => o.date).filter((d) => d >= today).sort()[0]
    onDone(first)
    onClose()
  }

  return (
    <Modal
      title="Google Takvim'den içe aktar"
      onClose={onClose}
      wide
      footer={
        <>
          <div className="spacer" />
          <button className="btn" onClick={onClose}>Vazgeç</button>
          <button className="btn primary" disabled={!freshCount} onClick={doImport}>İçe aktar ({freshCount} etkinlik)</button>
        </>
      }
    >
      <p className="muted">
        Google Takvim'de <b>Ayarlar → İçe ve dışa aktar → Dışa aktar</b> ile inen <b>.zip</b> dosyasını (ya da tek bir <b>.ics</b>) seçin.
        Etkinlikler kişisel etkinlik olarak eklenir; her takvim kendi kategorisine girer. Aynı dosyayı tekrar yüklerseniz <b>kopya oluşmaz</b>,
        sildikleriniz geri gelmez.
      </p>
      <label className="filepick">
        <input type="file" accept=".ics,.zip,text/calendar,application/zip,application/octet-stream" onChange={(e) => onFile(e.target.files?.[0])} />
        <span>{busy ? 'Okunuyor…' : fileName || 'Dosya seçmek için tıklayın'}</span>
      </label>
      {error && <div className="error">{error}</div>}

      {cals && cals.length > 0 && (
        <div className="import-summary">
          <ul className="ics-cals">
            {cals.map((c, i) => {
              const p = plans[i]
              const dates = p.fresh.map((o) => o.date)
              return (
                <li key={i}>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={picked.has(i)}
                      onChange={(e) => {
                        const n = new Set(picked)
                        if (e.target.checked) n.add(i)
                        else n.delete(i)
                        setPicked(n)
                      }}
                    />
                    <span>
                      <b>{categoryNameFor(c.name)}</b>
                      <small className="muted">
                        {' '}· {p.fresh.length} yeni
                        {p.existing > 0 && ` · ${p.existing} zaten var`}
                        {p.ignored > 0 && ` · ${p.ignored} silinmişti`}
                        {!allDay && p.allDaySkipped > 0 && ` · ${p.allDaySkipped} tüm gün (atlanacak)`}
                        {dates.length > 0 && ` · ${formatDMY(dates[0])} – ${formatDMY(dates[dates.length - 1])}`}
                      </small>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
          <label className="check">
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
            <span>Tüm gün etkinliklerini de ekle (doğum günü, tatil gibi; günün başına kısa bir kayıt olarak)</span>
          </label>
          <p className="muted small">Tekrarlayan etkinlikler en fazla 2 yıl ileriye kadar eklenir. Saatler telefonun saat dilimine göre alınır.</p>
        </div>
      )}
    </Modal>
  )
}
