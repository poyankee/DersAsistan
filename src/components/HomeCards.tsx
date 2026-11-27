import { ChevronDown, ChevronUp } from 'lucide-react'
import type { Settings } from '../lib/types'
import { setData, useData } from '../lib/store'

export type HomeCard = 'lessons' | 'next' | 'pending' | 'tasks' | 'week' | 'alerts' | 'quick' | 'free' | 'exams' | 'month' | 'memos' | 'upcoming'

export const HOME_DEFAULT: HomeCard[] = ['lessons', 'next', 'pending', 'tasks', 'week', 'alerts', 'quick', 'free', 'exams', 'month', 'memos', 'upcoming']

export const HOME_LABEL: Record<HomeCard, string> = {
  lessons: 'Bugünün Dersleri',
  next: 'Sıradaki Ders',
  pending: 'Ders Defteri (kayıt bekleyenler)',
  alerts: 'Hatırlatmalar',
  free: 'Boş Saatler',
  exams: 'Sınavlar',
  quick: 'Hızlı İşlemler',
  tasks: 'Görevlerim',
  week: 'Bu Hafta',
  month: 'Ay takvimi',
  memos: 'Notlarım',
  upcoming: 'Yaklaşanlar',
}

/** Kullanıcının sıraladığı kartlar (yeni kartlar sona eklenir) */
export function homeOrder(s: Settings, includeHidden = false): HomeCard[] {
  const saved = (s.homeOrder ?? []).filter((c): c is HomeCard => (HOME_DEFAULT as string[]).includes(c))
  const order = [...saved]
  // Kaydedilmiş sırada olmayan (yeni) kartlar varsayılandaki yerlerine yerleşir
  HOME_DEFAULT.forEach((c, i) => {
    if (order.includes(c)) return
    const prev = HOME_DEFAULT.slice(0, i).reverse().find((x) => order.includes(x))
    order.splice(prev ? order.indexOf(prev) + 1 : 0, 0, c)
  })
  if (includeHidden) return order
  const hidden = new Set(s.homeHidden ?? [])
  return order.filter((c) => !hidden.has(c))
}

/** Kart sırası ve görünürlüğü (ana sayfadaki pencerede ve Ayarlar'da) */
export function HomeCardsEditor() {
  const data = useData()
  const order = homeOrder(data.settings, true)
  const hidden = new Set(data.settings.homeHidden ?? [])
  const save = (homeOrder: string[], homeHidden: string[]) => setData((d) => ({ ...d, settings: { ...d.settings, homeOrder, homeHidden } }))
  const move = (i: number, dir: number) => {
    const j = i + dir
    if (j < 0 || j >= order.length) return
    const next = [...order]
    ;[next[i], next[j]] = [next[j], next[i]]
    save(next, [...hidden])
  }
  const toggle = (c: HomeCard) => {
    const h = new Set(hidden)
    if (h.has(c)) h.delete(c)
    else h.add(c)
    save(order, [...h])
  }
  return (
    <>
      <p className="muted small" style={{ marginTop: 0 }}>Kartların sırasını oklarla değiştirin, istemediklerinizi gizleyin. Değişiklik hemen uygulanır.</p>
      <ol className="menu-order">
        {order.map((c, i) => (
          <li key={c} className={hidden.has(c) ? 'off' : ''}>
            <span className="mo-num">{i + 1}</span>
            <b className="grow">{HOME_LABEL[c]}</b>
            <label className="check small"><input type="checkbox" checked={!hidden.has(c)} onChange={() => toggle(c)} /> Göster</label>
            <button className="icon-btn small" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`${HOME_LABEL[c]} yukarı`}><ChevronUp size={18} /></button>
            <button className="icon-btn small" onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label={`${HOME_LABEL[c]} aşağı`}><ChevronDown size={18} /></button>
          </li>
        ))}
      </ol>
      {(data.settings.homeOrder || data.settings.homeHidden?.length) && (
        <button className="btn small ghost" onClick={() => setData((d) => ({ ...d, settings: { ...d.settings, homeOrder: undefined, homeHidden: undefined } }))}>Varsayılana dön</button>
      )}
    </>
  )
}
