import { BookOpenText, CalendarDays, Wallet } from 'lucide-react'

/** İlk açılış tanıtımı */
export default function Intro({ onDone }: { onDone: () => void }) {
  return (
    <div className="intro">
      <div className="intro-card">
        <h1>Hoş geldiniz</h1>
        <p className="muted" style={{ margin: 0 }}>Ders Asistanı, kurum derslerinizi ve özel derslerinizi tek yerde toplar.</p>
        <ul className="intro-list">
          <li><span className="ico"><CalendarDays size={22} /></span><span><b>Takvim</b><small>Kurum programını yükleyin, derslerinizi sürükleyerek taşıyın.</small></span></li>
          <li><span className="ico"><BookOpenText size={22} /></span><span><b>Öğrenci dosyası</b><small>Her derste ne yaptığınız tarihleriyle bir arada.</small></span></li>
          <li><span className="ico"><Wallet size={22} /></span><span><b>Ödemeler</b><small>Kimin ne kadar borcu var, kendiliğinden hesaplanır.</small></span></li>
        </ul>
        <button className="btn primary" onClick={onDone}>Başlayalım</button>
      </div>
    </div>
  )
}
