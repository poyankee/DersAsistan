import { useEffect, useRef, useState } from 'react'
import { Camera, Check, FileText, Paperclip, Plus, X } from 'lucide-react'
import type { Attachment, Task } from '../lib/types'
import { formatSize, openAttachment, readAttachment, storeAttachment } from '../lib/attachments'
import { uid } from '../lib/util'
import Modal from './Modal'

/** Görev formu: alt adımlar ve ekli dosya/resimler */
export default function TaskExtras({ task, onChange }: { task: Task; onChange: (t: Task) => void }) {
  const steps = task.steps ?? []
  const files = task.files ?? []
  const [step, setStep] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<Attachment | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLInputElement>(null)

  const setSteps = (s: Task['steps']) => onChange({ ...task, steps: s && s.length ? s : undefined })
  const addStep = () => {
    const text = step.trim()
    if (!text) return
    setSteps([...steps, { id: uid(), text, done: false }])
    setStep('')
  }

  const addFiles = async (list: FileList | null) => {
    if (!list?.length) return
    setError('')
    setBusy(true)
    const added: Attachment[] = []
    for (const f of Array.from(list)) {
      try {
        added.push(await storeAttachment(f))
      } catch (e) {
        setError(`${f.name}: ${(e as Error).message}`)
      }
    }
    setBusy(false)
    if (added.length) onChange({ ...task, files: [...files, ...added] })
  }
  const removeFile = (a: Attachment) => {
    if (!confirm(`"${a.name}" kaldırılsın mı?`)) return
    // Dosya hemen silinmez: görev kaydedilmezse ek geri gelir; kullanılmayanlar sonra temizlenir
    const rest = files.filter((x) => x.id !== a.id)
    onChange({ ...task, files: rest.length ? rest : undefined })
  }
  const open = (a: Attachment) => {
    if (a.type.startsWith('image/')) setPreview(a)
    else openAttachment(a).catch((e) => !/cancel/i.test((e as Error).message ?? '') && setError('Açılamadı: ' + (e as Error).message))
  }

  const done = steps.filter((s) => s.done).length
  return (
    <>
      <div className="field">
        <span>Alt adımlar {steps.length > 0 && <small className="muted">({done}/{steps.length})</small>}</span>
        {steps.length > 0 && (
          <ul className="step-list">
            {steps.map((s, i) => (
              <li key={s.id} className={s.done ? 'done' : ''}>
                <button className={'task-check small' + (s.done ? ' on' : '')} onClick={() => setSteps(steps.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)))} aria-label={s.done ? 'Geri aç' : 'Tamamla'}><Check size={12} /></button>
                <input value={s.text} onChange={(e) => setSteps(steps.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} aria-label="Adım" />
                <button className="icon-btn small" onClick={() => setSteps(steps.filter((x) => x.id !== s.id))} aria-label="Adımı sil"><X size={14} /></button>
              </li>
            ))}
          </ul>
        )}
        <div className="step-add">
          <Plus size={16} />
          <input value={step} onChange={(e) => setStep(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addStep() } }} placeholder="Adım ekle ve Enter'a bas…" />
          {step.trim() && <button className="btn small" onClick={addStep}>Ekle</button>}
        </div>
      </div>

      <div className="field">
        <span>Ekler</span>
        {files.length > 0 && (
          <div className="att-grid">
            {files.map((a) => (
              <div key={a.id} className="att">
                <button className="att-open" onClick={() => open(a)} title={a.name}>
                  {a.thumb ? <img src={a.thumb} alt="" /> : <span className="att-ico"><FileText size={22} /></span>}
                  <span className="att-name">{a.name}</span>
                  <small>{formatSize(a.size)}</small>
                </button>
                <button className="att-del" onClick={() => removeFile(a)} aria-label="Eki kaldır"><X size={13} /></button>
              </div>
            ))}
          </div>
        )}
        <div className="row wrap" style={{ gap: 8 }}>
          <button className="btn small" disabled={busy} onClick={() => imgRef.current?.click()}><Camera size={15} /> Fotoğraf / resim</button>
          <button className="btn small" disabled={busy} onClick={() => fileRef.current?.click()}><Paperclip size={15} /> Dosya ekle</button>
          {busy && <span className="muted small">Ekleniyor…</span>}
        </div>
        <input ref={imgRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
        <input ref={fileRef} type="file" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
        {error && <div className="error small">{error}</div>}
        {files.length > 0 && <small className="muted">Ekler bu cihazda saklanır; yedek dosyasına dahil değildir.</small>}
      </div>

      {preview && <ImagePreview a={preview} onClose={() => setPreview(null)} />}
    </>
  )
}

function ImagePreview({ a, onClose }: { a: Attachment; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    let u: string | null = null
    readAttachment(a)
      .then((b) => setUrl((u = URL.createObjectURL(b))))
      .catch((e) => setErr((e as Error).message))
    return () => {
      if (u) URL.revokeObjectURL(u)
    }
  }, [a])
  return (
    <Modal
      title={a.name}
      onClose={onClose}
      wide
      footer={
        <>
          <div className="spacer" />
          <button className="btn" onClick={() => openAttachment(a).catch(() => undefined)}>Paylaş / aç</button>
          <button className="btn primary" onClick={onClose}>Kapat</button>
        </>
      }
    >
      {err ? <div className="error">{err}</div> : url ? <img className="att-preview" src={url} alt={a.name} /> : <p className="muted">Yükleniyor…</p>}
    </Modal>
  )
}
