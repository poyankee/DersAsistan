import { useState } from 'react'
import { Delete, Lock } from 'lucide-react'
import { checkPin, type LockInfo } from '../lib/lock'

/** PIN ekranı: uygulama açılırken ve arka plandan dönünce gösterilir */
export default function LockScreen({ lock, onUnlock }: { lock: LockInfo; onUnlock: () => void }) {
  const [pin, setPin] = useState('')
  const [wrong, setWrong] = useState(false)
  const [help, setHelp] = useState(false)

  const press = async (d: string) => {
    if (pin.length >= 4) return
    const next = pin + d
    setPin(next)
    setWrong(false)
    if (next.length === 4) {
      if (await checkPin(lock, next)) onUnlock()
      else {
        navigator.vibrate?.(120)
        setWrong(true)
        setTimeout(() => setPin(''), 350)
      }
    }
  }

  return (
    <div className="lock-screen">
      <div className="lock-ico"><Lock size={28} /></div>
      <h2>Ders Asistanı</h2>
      <p className={wrong ? 'warn-text' : 'muted'}>{wrong ? 'PIN yanlış' : 'PIN girin'}</p>
      <div className={'pin-dots' + (wrong ? ' shake' : '')}>
        {[0, 1, 2, 3].map((i) => <i key={i} className={i < pin.length ? 'on' : ''} />)}
      </div>
      <div className="keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => <button key={d} onClick={() => press(d)}>{d}</button>)}
        <span />
        <button onClick={() => press('0')}>0</button>
        <button className="ghost" onClick={() => setPin(pin.slice(0, -1))} aria-label="Sil"><Delete size={22} /></button>
      </div>
      <button className="btn ghost small" onClick={() => setHelp((x) => !x)}>PIN'imi unuttum</button>
      {help && (
        <p className="muted small lock-help">
          PIN sıfırlanamaz. Uygulamayı silip yeniden kurun, ardından Ayarlar → Yedekten geri yükle ile
          telefonunuzun <b>Belgeler/DersAsistani</b> klasöründeki en son otomatik yedeği seçin.
        </p>
      )}
    </div>
  )
}
