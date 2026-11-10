import { useMemo, useState } from 'react'
import { applyImport, changeReport, parseRows, planImport, rowsFromFile, type ParseResult } from '../lib/importSchedule'
import { setData, useData } from '../lib/store'
import { formatShort, todayISO } from '../lib/date'
import Modal from './Modal'

export default function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: (firstNewDate?: string) => void }) {
  const data = useData()
  const [parsed, setParsed] = useState<ParseResult | null>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [removeStale, setRemoveStale] = useState(true)
  const [merge, setMerge] = useState(true)
  const today = todayISO()

  const plan = useMemo(() => (parsed ? planImport(data, parsed, today, removeStale) : null), [data, parsed, today, removeStale])

  const onFile = async (f: File | undefined) => {
    if (!f) return
    setError('')
    setBusy(true)
    setFileName(f.name)
    try {
      const rows = await rowsFromFile(f)
      const r = parseRows(rows)
      if (!r.slots.length) setError('Dosyada ders bulunamadı. İlk sütunda tarih, diğer hücrelerde "SINIF KODU + 09:20-10:00" biçiminde ders olmalı.')
      setParsed(r)
    } catch (e) {
      console.error(e)
      setError('Dosya okunamadı: ' + (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const doImport = () => {
    if (!parsed || !plan) return
    setData((d) => applyImport(d, parsed, today, removeStale, merge))
    onDone(plan.newBlocks.find((b) => b.date >= today)?.date ?? plan.newBlocks[0]?.date)
    onClose()
  }

  const report = useMemo(() => (plan ? changeReport(data, plan, true) : null), [data, plan])
  const byDate = useMemo(() => {
    const m = new Map<string, string[]>()
    plan?.newBlocks.forEach((b) => {
      if (!m.has(b.date)) m.set(b.date, [])
      m.get(b.date)!.push(`${b.start}–${b.end} ${b.groupCode}`)
    })
    return m
  }, [plan])

  const hasChanges = !!plan && (plan.newSlotCount > 0 || (removeStale && plan.staleEvents.length > 0))

  return (
    <Modal
      title="Kurum ders programını yükle"
      onClose={onClose}
      wide
      footer={
        <>
          <div className="spacer" />
          <button className="btn" onClick={onClose}>Vazgeç</button>
          <button className="btn primary" disabled={!hasChanges} onClick={doImport}>
            {plan ? `İçe aktar (${plan.newSlotCount} yeni ders saati)` : 'İçe aktar'}
          </button>
        </>
      }
    >
      <p className="muted">
        Kurumun yayınladığı program dosyasını (.xls, .xlsx) seçin. Daha önce kaydedilmiş dersler <b>tekrar eklenmez</b>; sadece yeni dersler takvime işlenir.
      </p>
      <label className="filepick">
        <input type="file" accept=".xls,.xlsx,.htm,.html,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/html,text/csv,application/octet-stream" onChange={(e) => onFile(e.target.files?.[0])} />
        <span>{busy ? 'Okunuyor…' : fileName || 'Dosya seçmek için tıklayın'}</span>
      </label>
      {error && <div className="error">{error}</div>}

      {parsed && plan && parsed.slots.length > 0 && (
        <div className="import-summary">
          <div className="stats">
            <div><b>{parsed.slots.length}</b><span>dosyadaki ders saati</span></div>
            <div className="good"><b>{plan.newSlotCount}</b><span>yeni eklenecek</span></div>
            <div><b>{plan.existingCount}</b><span>zaten kayıtlı (atlanacak)</span></div>
            {plan.ignoredCount > 0 && <div><b>{plan.ignoredCount}</b><span>daha önce silinmiş (atlanacak)</span></div>}
          </div>
          <p className="muted small">Tarih aralığı: {formatShort(parsed.minDate!)} – {formatShort(parsed.maxDate!)}</p>

          {report && report.changedDays.length > 0 && (
            <div className="change-report">
              <b className="row-title">⚠️ Mevcut günlerde {report.changedDays.length} değişiklik var</b>
              <ul className="change-list">
                {report.changedDays.map((d) => (
                  <li key={d.date}>
                    <b>{formatShort(d.date)}</b>
                    {d.moved.map((m, i) => <span key={'m' + i} className="chg moved">↔ {m.group}: {m.from} → {m.to}</span>)}
                    {d.added.map((x, i) => <span key={'a' + i} className="chg add">+ {x.groupCode} {x.start}–{x.end}</span>)}
                    {d.removed.map((x) => <span key={x.id} className="chg del">− {x.groupCode} {x.start}–{x.end}</span>)}
                  </li>
                ))}
              </ul>
              {plan.staleEvents.length > 0 && (
                <label className="check">
                  <input type="checkbox" checked={removeStale} onChange={(e) => setRemoveStale(e.target.checked)} />
                  <span>Yeni programda olmayan <b>{plan.staleEvents.length}</b> dersi takvimden kaldır (notu girilmiş veya geçmiş dersler asla silinmez)</span>
                </label>
              )}
            </div>
          )}
          {report && report.newDays.length > 0 && (
            <p className="ok small">+ {report.newDays.length} yeni gün, {report.newDays.reduce((a, d) => a + d.blocks.reduce((x, b) => x + b.keys.length, 0), 0)} ders saati eklenecek ({formatShort(report.newDays[0].date)} – {formatShort(report.newDays[report.newDays.length - 1].date)})</p>
          )}
          {report && report.changedDays.length === 0 && plan.newSlotCount > 0 && <p className="muted small">Mevcut günlerde değişiklik yok; sadece yeni günler eklenecek.</p>}

          <label className="check">
            <input type="checkbox" checked={merge} onChange={(e) => setMerge(e.target.checked)} />
            <span>Aynı sınıfın art arda gelen saatlerini tek ders olarak birleştir (ör. 09:20–10:50, 2 saat)</span>
          </label>

          {plan.newSlotCount > 0 ? (
            <details>
              <summary>Eklenecek dersleri göster</summary>
              <ul className="mini-list">
                {Array.from(byDate.entries()).map(([d, l]) => (
                  <li key={d}><b>{formatShort(d)}:</b> {l.join(' · ')}</li>
                ))}
              </ul>
            </details>
          ) : (
            <p className="ok">Bu programdaki tüm dersler zaten takviminizde. 👍</p>
          )}

          {parsed.warnings.length > 0 && (
            <details>
              <summary>{parsed.warnings.length} hücre okunamadı</summary>
              <ul className="mini-list">{parsed.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </details>
          )}
        </div>
      )}
    </Modal>
  )
}
