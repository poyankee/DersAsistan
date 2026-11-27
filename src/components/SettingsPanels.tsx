/* Ayarlar sayfasının bölümleri */
import Landscape from './Landscape'
import { SCENES, activeScene } from '../lib/scenes'
import { useState } from 'react'
import DateInput from './DateInput'
import { Bell, BookOpen, Bug, KeyRound, Sparkles, Palette, RotateCcw, ShieldCheck, Trash2, ChevronDown, ChevronUp, LayoutList } from 'lucide-react'
import { autoBackupInfo, readSnapshots } from '../lib/persist'
import { makeLock } from '../lib/lock'
import { ACCENTS, accentOf } from '../lib/accent'
import { APP_VERSION, CHANGELOG } from '../lib/version'
import { clearErrors, errorReport, readErrors } from '../lib/errlog'
import { deleteCategory, deleteHoliday, emptyTrash, normalize, restoreTrash, saveCategory, saveHoliday, setData, useData } from '../lib/store'
import { notifySettings, requestNotifyPermission, testNotification } from '../lib/notify'
import { isNative } from '../lib/native'
import type { NotifySettings, Settings } from '../lib/types'
import { showToast } from '../lib/toast'
import { holidaysBetween } from '../lib/holidays'
import { addDays, formatDMY, todayISO } from '../lib/date'
import { uid } from '../lib/util'
import { NAV_LABEL, navOrder, type NavTab } from '../lib/nav'
import { PALETTE, downloadFile } from '../lib/util'

export function HolidaysPanel() {
  const data = useData()
  const today = todayISO()
  const [name, setName] = useState('')
  const [start, setStart] = useState(today)
  const [end, setEnd] = useState(today)
  const upcoming = holidaysBetween(data, today, addDays(today, 120)).filter((x) => x.h.builtin)
  const official = data.settings.showOfficialHolidays !== false
  return (
    <section className="panel">
      <h3>Tatiller</h3>
      <p className="muted small">Tatiller takvimde işaretlenir; tekrarlayan özel dersler oluşturulurken tam gün tatiller atlanır, boş saat aramasında da gösterilmez.</p>
      <label className="check">
        <input type="checkbox" checked={official} onChange={(e) => setData((d) => ({ ...d, settings: { ...d.settings, showOfficialHolidays: e.target.checked } }))} />
        Resmi tatilleri göster (bayramlar dahil)
      </label>
      {official && upcoming.length > 0 && (
        <p className="small muted">Yaklaşan: {upcoming.slice(0, 6).map((x) => `${formatDMY(x.date)} ${x.h.name}`).join(' · ')}</p>
      )}
      <h4>Okul / kişisel tatiller</h4>
      {data.holidays.length > 0 && (
        <ul className="promise-list">
          {[...data.holidays].sort((a, b) => a.start.localeCompare(b.start)).map((h) => (
            <li key={h.id}>
              <span className="grow"><b>{h.name}</b> <span className="muted">{formatDMY(h.start)}{h.end !== h.start ? ` – ${formatDMY(h.end)}` : ''}</span></span>
              <button className="btn small ghost" onClick={() => deleteHoliday(h.id)}>Sil</button>
            </li>
          ))}
        </ul>
      )}
      <div className="row wrap">
        <label className="field grow"><span>Ad</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="ör. Ara tatil, Yarıyıl tatili" /></label>
        <label className="field"><span>Başlangıç</span><DateInput value={start} onChange={(v) => { setStart(v); if (v > end) setEnd(v) }} /></label>
        <label className="field"><span>Bitiş</span><DateInput value={end} min={start} onChange={(v) => setEnd(v)} /></label>
        <button className="btn primary" style={{ marginBottom: 10 }} disabled={!name.trim() || !start || !end} onClick={() => { saveHoliday({ id: uid(), name: name.trim(), start, end }); setName('') }}>Ekle</button>
      </div>
    </section>
  )
}

function setSettings(patch: Partial<Settings>) {
  setData((d) => ({ ...d, settings: { ...d.settings, ...patch } }))
}

export function AppearancePanel() {
  const data = useData()
  const theme = data.settings.theme ?? 'system'
  const scale = data.settings.fontScale ?? 1
  const sceneSet = data.settings.scene ?? 'gunbatimi'
  return (
    <section className="panel">
      <h3 className="row-title"><Palette size={18} /> Görünüm</h3>
      <label className="field" style={{ maxWidth: 320 }}>
        <span>Adınız (ana sayfadaki selamlama)</span>
        <input value={data.settings.userName ?? ''} onChange={(e) => setData((d) => ({ ...d, settings: { ...d.settings, userName: e.target.value || undefined } }))} placeholder="ör. Poyraz" />
      </label>
      <div className="field">
        <span>Tema</span>
        <div className="scene-list">
          {SCENES.map((sc) => (
            <button key={sc.id} data-scene={sc.id} className={'scene-card' + (sceneSet === sc.id ? ' sel' : '')} onClick={() => setSettings({ scene: sc.id })} aria-pressed={sceneSet === sc.id}>
              <div className="scene-thumb"><Landscape scene={sc} variant="full" /></div>
              <span>{sc.name}</span>
            </button>
          ))}
          <button className={'scene-card' + (sceneSet === 'otomatik' ? ' sel' : '')} onClick={() => setSettings({ scene: 'otomatik' })} aria-pressed={sceneSet === 'otomatik'}>
            <div className="auto-thumb">
              {(['kis', 'cayir', 'orman', 'sonbahar'] as const).map((id) => <div key={id} data-scene={id}><Landscape scene={SCENES.find((x) => x.id === id)!} variant="side" /></div>)}
            </div>
            <span>Mevsime göre <small>· şu an {activeScene('otomatik', todayISO())!.name}</small></span>
          </button>
          <button className={'scene-card' + (sceneSet === 'klasik' ? ' sel' : '')} onClick={() => setSettings({ scene: 'klasik' })} aria-pressed={sceneSet === 'klasik'}>
            <div className="classic-thumb" />
            <span>Klasik renkli</span>
          </button>
        </div>
      </div>
      {sceneSet === 'klasik' && <div className="field">
        <span>Ana renk</span>
        <div className="accent-list">
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              className={'accent-swatch' + (accentOf(data.settings.accent).id === a.id ? ' sel' : '')}
              style={{ background: `linear-gradient(135deg, hsl(${a.h} ${a.s}% ${a.l}%), hsl(${a.h2} ${a.s}% ${a.l}%))` }}
              onClick={() => setSettings({ accent: a.id })}
              aria-label={a.name}
            ><span>{a.name}</span></button>
          ))}
        </div>
      </div>}
      <div className="row wrap">
        <div className="field">
          <span>Açık / koyu</span>
          <div className="seg small" style={{ margin: 0 }}>
            {([['system', 'Telefona göre'], ['light', 'Açık'], ['dark', 'Koyu']] as const).map(([v, l]) => (
              <button key={v} className={theme === v ? 'active' : ''} onClick={() => setSettings({ theme: v })}>{l}</button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>Yazı boyutu</span>
          <div className="seg small" style={{ margin: 0 }}>
            {([[0.9, 'Küçük'], [1, 'Normal'], [1.1, 'Büyük'], [1.2, 'Çok büyük']] as const).map(([v, l]) => (
              <button key={v} className={scale === v ? 'active' : ''} onClick={() => setSettings({ fontScale: v })}>{l}</button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export function NotifyPanel() {
  const data = useData()
  const n = notifySettings(data)
  const set = (patch: Partial<NotifySettings>) => setSettings({ notify: { ...n, ...patch } })
  const enable = async (on: boolean) => {
    if (on && isNative) {
      const ok = await requestNotifyPermission()
      if (!ok) {
        showToast('Bildirim izni verilmedi. Telefon ayarlarından izin verebilirsiniz.')
        return
      }
    }
    set({ enabled: on })
  }
  return (
    <section className="panel">
      <h3 className="row-title"><Bell size={18} /> Bildirimler</h3>
      {!isNative && <p className="muted small">Bildirimler Android uygulamasında çalışır.</p>}
      <label className="check"><input type="checkbox" checked={n.enabled} onChange={(e) => enable(e.target.checked)} /> Bildirimleri aç</label>
      {n.enabled && (
        <div className="notify-opts">
          <div className="field">
            <span>Ders başlamadan önce hatırlat</span>
            <div className="chips">
              {[0, 5, 10, 15, 30, 60].map((m) => <button key={m} className={'chip' + (n.before === m ? ' sel' : '')} onClick={() => set({ before: m })}>{m ? `${m} dk` : 'Kapalı'}</button>)}
            </div>
          </div>
          <label className="check"><input type="checkbox" checked={n.payments} onChange={(e) => set({ payments: e.target.checked })} /> Ödeme günü gelen öğrenciler (saat 09:00)</label>
          <div className="field">
            <span>Ödemelerim (kredi kartı, kira…): son günden önce hatırlat, 09:00</span>
            <div className="chips">
              {[[-1, 'Kapalı'], [0, 'Sadece son gün'], [1, '1 gün önce'], [2, '2 gün önce'], [3, '3 gün önce']].map(([v, l]) => <button key={v} className={'chip' + ((n.billDays ?? 1) === v ? ' sel' : '')} onClick={() => set({ billDays: v as number })}>{l}</button>)}
            </div>
          </div>
          <label className="check"><input type="checkbox" checked={n.tasks} onChange={(e) => set({ tasks: e.target.checked })} /> Görevler (son gün, 08:30)</label>
          <label className="check"><input type="checkbox" checked={n.exams} onChange={(e) => set({ exams: e.target.checked })} /> Sınavlar (bir gün önce, 19:00)</label>
          {isNative && <button className="btn small" onClick={() => testNotification()}>Deneme bildirimi gönder</button>}
        </div>
      )}
    </section>
  )
}

export function TrashPanel() {
  const data = useData()
  if (!data.trash.length) return null
  const ago = (t: number) => {
    const d = Math.floor((Date.now() - t) / 86400000)
    return d === 0 ? 'bugün' : `${d} gün önce`
  }
  return (
    <section className="panel">
      <h3 className="row-title"><Trash2 size={18} /> Çöp kutusu</h3>
      <p className="muted small">Silinen kayıtlar 30 gün burada kalır, sonra kalıcı olarak silinir.</p>
      <ul className="promise-list">
        {data.trash.slice(0, 50).map((t) => (
          <li key={t.id}>
            <span className="grow">{t.label} <span className="muted small">· {ago(t.deletedAt)}</span></span>
            <button className="btn small" onClick={() => { restoreTrash(t.id); showToast('Geri yüklendi') }}><RotateCcw size={13} /> Geri yükle</button>
          </li>
        ))}
      </ul>
      <button className="btn small ghost" style={{ marginTop: 8 }} onClick={() => confirm('Çöp kutusu boşaltılsın mı? Bu işlem geri alınamaz.') && emptyTrash()}>Çöp kutusunu boşalt</button>
    </section>
  )
}

export function CategoriesPanel() {
  const data = useData()
  const [name, setName] = useState('')
  const add = () => {
    if (!name.trim()) return
    const used = new Set(data.categories.map((c) => c.color))
    saveCategory({ id: uid(), name: name.trim(), color: PALETTE.find((x) => !used.has(x)) ?? PALETTE[0] })
    setName('')
  }
  return (
    <section className="panel">
      <h3>Kişisel etkinlik kategorileri</h3>
      <p className="muted small">Yüksek lisans, spor gibi kendi işleriniz için. Kişisel etkinlikler gelire ve puantaja karışmaz.</p>
      <div className="group-list">
        {data.categories.map((c) => (
          <div key={c.id} className="group-row">
            <input defaultValue={c.name} onBlur={(e) => e.target.value.trim() && saveCategory({ ...c, name: e.target.value.trim() })} />
            <div className="swatches">
              {PALETTE.map((p) => <button key={p} className={'swatch sm' + (c.color === p ? ' sel' : '')} style={{ background: p }} onClick={() => saveCategory({ ...c, color: p })} aria-label={p} />)}
            </div>
            <button className="btn small ghost" onClick={() => confirm(`"${c.name}" kategorisi silinsin mi? Etkinlikler silinmez.`) && deleteCategory(c.id)}>Sil</button>
          </div>
        ))}
      </div>
      <div className="task-add" style={{ marginTop: 10 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Yeni kategori (ör. Spor)" />
        <button className="btn small primary" disabled={!name.trim()} onClick={add}>Ekle</button>
      </div>
    </section>
  )
}

/** Otomatik yedek durumu + günlük sağlam kopyalardan geri dönme */
export function AutoBackupStatus() {
  const info = autoBackupInfo()
  const [snaps, setSnaps] = useState<{ name: string; raw: string }[] | null>(null)
  const restoreSnap = (s: { name: string; raw: string }) => {
    try {
      const d = normalize(JSON.parse(s.raw))
      if (confirm(`${s.name} tarihli kopyaya dönülsün mü? (${d.events.length} etkinlik, ${d.students.length} öğrenci)\nŞu anki verilerin yerini alacak.`)) {
        setData(() => d)
        showToast('Kopya yüklendi')
      }
    } catch (e) {
      alert('Kopya okunamadı: ' + (e as Error).message)
    }
  }
  return (
    <div className="backup-status">
      <div className="row-title"><ShieldCheck size={16} />
        {isNative
          ? info?.ok ? <span>Otomatik yedek açık · son: {formatDMY(info.day)} · <b>{info.where}</b> klasörü (uygulama silinse de kalır)</span>
            : info ? <span className="warn-text">Otomatik yedek alınamadı ({info.error}). Elle yedek almayı unutmayın.</span>
            : <span>Otomatik yedek her gün ilk değişiklikte alınır.</span>
          : <span>Otomatik yedek Android uygulamasında çalışır; tarayıcıda günde bir sağlam kopya tutulur.</span>}
      </div>
      {snaps === null ? (
        <button className="btn small ghost" onClick={async () => setSnaps(await readSnapshots())}>Son günlerin kopyalarını göster</button>
      ) : snaps.length === 0 ? <span className="muted small">Henüz kopya yok.</span> : (
        <div className="chips">
          {snaps.map((s) => <button key={s.name} className="chip" onClick={() => restoreSnap(s)}>{/^\d{4}-/.test(s.name) ? formatDMY(s.name) : s.name}</button>)}
        </div>
      )}
    </div>
  )
}

export function LockPanel() {
  const data = useData()
  const on = !!data.settings.lock
  const setPin = async () => {
    const pin = prompt('4 haneli bir PIN belirleyin:')
    if (pin === null) return
    if (!/^\d{4}$/.test(pin)) return alert('PIN 4 rakamdan oluşmalı.')
    if (pin !== prompt('PIN\'i tekrar yazın:')) return alert('PIN\'ler aynı değil.')
    setSettings({ lock: await makeLock(pin) })
    showToast('Uygulama kilidi açıldı')
  }
  return (
    <section className="panel">
      <h3 className="row-title"><KeyRound size={18} /> Uygulama kilidi</h3>
      <p className="muted small">Uygulama açılırken ve bir dakikadan uzun arka planda kaldıktan sonra PIN sorulur. Telefonunuzu başkası eline aldığında öğrenci ve ücret bilgileri görünmez.</p>
      <div className="row wrap">
        <button className="btn" onClick={setPin}>{on ? 'PIN\'i değiştir' : 'PIN belirle'}</button>
        {on && <button className="btn danger" onClick={() => confirm('Uygulama kilidi kapatılsın mı?') && setSettings({ lock: undefined })}>Kilidi kapat</button>}
      </div>
    </section>
  )
}

const GUIDE: [string, string][] = [
  ['Telefon ve tableti eşitlemek', 'Ayarlar → Hesap ve eşitleme. Önce telefonda sunucu adresini girip hesap oluşturun, sonra tablette aynı bilgilerle giriş yapın. Değişiklikler birkaç saniyede öteki cihaza geçer; veriler cihazda şifrelenir.'],
  ['Menü düzeni', 'Ayarlar → Menü düzeni: sayfaların sırasını oklarla değiştirin, kullanmadıklarınızı gizleyin. Telefonda ilk 4 sayfa alt menüde, gerisi "Menü"de.'],
  ['Gelirler ve giderler', 'Ödemeler → Ödemelerim (kira, kart, fatura) ve Gelirlerim (maaş, kurum ödemesi, ek gelirler). Her ay, 2 ayda bir, yılda bir ya da tek seferlik olabilir; bir aya birden fazla ödeme yazılabilir (ör. kurumdan 5\'i ve 15\'i).'],
  ['Tema değiştirmek', 'Ayarlar → Görünüm → Tema: Gün batımı, Sonbahar, Orman, Kış, Çayır, Lavanta, Gece ya da "Mevsime göre". Açık / koyu için kenar menüsünün altındaki ay–güneş düğmesi.'],
  ['Geri almak', 'Bir şeyi kaydettikten sonra altta çıkan "Geri al"a dokunun. Klavyede Ctrl+Z son değişikliği geri alır. Silinen kayıtlar ayrıca 30 gün Ayarlar → Çöp kutusu\'nda durur.'],
  ['Gider/gelir kategorileri', 'Ödemeler → kaleme dokunun → Kategori. Seçmezseniz addan tahmin edilir (ör. "Elektrik" → Fatura). Dağılım Ödemelerim\'in özetinde, aylık tablo Raporlar → Gelir–gider\'de.'],
  ['Güncellemeler', 'Yeni sürümler kendiliğinden indirilir; ekranın altında "Yeni sürüm hazır" çıkınca "Yeniden başlat"a dokunun. APK aramanıza gerek yok.'],
  ['Kurum programını yüklemek', 'Takvim → sağ üstteki ⋯ → "Kurum programını yükle". Aynı dosyayı tekrar yükleseniz de dersler çiftlenmez; değişen günler ayrıca gösterilir.'],
  ['Ders eklemek', '"+" düğmesi → Etkinlik. Özel ders için öğrenciyi, kendi işleriniz için "Kişisel"i seçin. "Her hafta tekrarla" ile dönemlik ders oluşturulur.'],
  ['Dersi taşımak', 'Takvimde derse basılı tutup sürükleyin. Alt kenarından çekerek süresini değiştirin. Her taşımadan sonra "Geri al" çıkar.'],
  ['Ne yaptığınızı yazmak', 'Öğrenciler → öğrenciye (ya da Kurum sınıfları → sınıfa) dokunun → Dersler sekmesi. Tarih bugün gelir; değiştirebilirsiniz.'],
  ['Ücret ve ödemeler', 'İptal edilmeyen her ders bitince öğrencinin hesabına yazılır. Öğrenci dosyası → Ödeme işlemleri\'nden ödeme alın. Yapılmayan dersi takvimden "İptal et" ile işaretleyin.'],
  ['Telafi', 'İptal ettiğiniz derse dokunun → "Telafi planla". Boş saatleriniz listelenir.'],
  ['Arama', 'Bugün ekranındaki büyüteç: öğrenci, sınıf, konu ve ödevlerde arar.'],
  ['Yedek', 'Uygulama her gün otomatik yedek alır. Telefon değiştirirken Ayarlar → Yedek al ile dosyayı kendinize gönderin.'],
]

export function HelpPanel() {
  return (
    <details className="advanced">
      <summary><span className="row-title"><BookOpen size={18} /> Nasıl kullanılır?</span></summary>
      <section className="panel">
        <dl className="guide">
          {GUIDE.map(([t, d]) => <div key={t}><dt>{t}</dt><dd>{d}</dd></div>)}
        </dl>
      </section>
    </details>
  )
}

export function ChangelogPanel() {
  return (
    <details className="advanced">
      <summary><span className="row-title"><Sparkles size={18} /> Yenilikler</span></summary>
      <section className="panel">
        {CHANGELOG.map((c) => (
          <div key={c.version}>
            <h4>Sürüm {c.version}</h4>
            <ul className="mini-list">{c.items.map((i) => <li key={i}>{i}</li>)}</ul>
          </div>
        ))}
      </section>
    </details>
  )
}

export function ErrorPanel() {
  const [n, setN] = useState(() => readErrors().length)
  return (
    <section className="panel">
      <h3 className="row-title"><Bug size={18} /> Hata raporu</h3>
      <p className="muted small">Uygulamada bir hata olursa burada kaydedilir. Raporda öğrenci ya da ücret bilgisi yoktur; yalnızca hata metni ve cihaz bilgisi bulunur.</p>
      <div className="row wrap middle">
        <span className="small">{n ? `${n} kayıtlı hata` : 'Kayıtlı hata yok'}</span>
        <button className="btn small" onClick={() => downloadFile('ders-asistani-hata-raporu.txt', errorReport(APP_VERSION), 'text/plain')}>Raporu paylaş</button>
        {n > 0 && <button className="btn small ghost" onClick={() => { clearErrors(); setN(0) }}>Temizle</button>}
      </div>
    </section>
  )
}

/** Soldaki menünün sırası ve görünen sayfalar */
export function MenuPanel() {
  const data = useData()
  const order = navOrder(data.settings, true)
  const hidden = new Set(data.settings.navHidden ?? [])
  const save = (navOrder: string[], navHidden: string[]) => setData((d) => ({ ...d, settings: { ...d.settings, navOrder, navHidden } }))
  const move = (i: number, dir: number) => {
    const j = i + dir
    if (j < 0 || j >= order.length) return
    const next = [...order]
    ;[next[i], next[j]] = [next[j], next[i]]
    save(next, [...hidden])
  }
  const toggle = (t: NavTab) => {
    const h = new Set(hidden)
    if (h.has(t)) h.delete(t)
    else h.add(t)
    save(order, [...h])
  }
  return (
    <section className="panel">
      <h3 className="row-title"><LayoutList size={18} /> Menü düzeni</h3>
      <p className="muted small" style={{ marginTop: 0 }}>Soldaki menünün sırasını oklarla değiştirin; kullanmadığınız sayfaları gizleyin. Telefonda ilk 4 sayfa alt menüde, gerisi "Menü"de görünür.</p>
      <ol className="menu-order">
        {order.map((t, i) => (
          <li key={t} className={hidden.has(t) && t !== 'bugun' ? 'off' : ''}>
            <span className="mo-num">{i + 1}</span>
            <b className="grow">{NAV_LABEL[t]}</b>
            {t !== 'bugun' && (
              <label className="check small"><input type="checkbox" checked={!hidden.has(t)} onChange={() => toggle(t)} /> Göster</label>
            )}
            <button className="icon-btn small" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`${NAV_LABEL[t]} yukarı`}><ChevronUp size={18} /></button>
            <button className="icon-btn small" onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label={`${NAV_LABEL[t]} aşağı`}><ChevronDown size={18} /></button>
          </li>
        ))}
      </ol>
      {(data.settings.navOrder || data.settings.navHidden?.length) && <button className="btn small ghost" onClick={() => setData((d) => ({ ...d, settings: { ...d.settings, navOrder: undefined, navHidden: undefined } }))}>Varsayılana dön</button>}
    </section>
  )
}
