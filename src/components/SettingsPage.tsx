import { useRef, useState } from 'react'
import { Bell, CalendarDays, ChevronLeft, ChevronRight, Database, Download, LayoutDashboard, LifeBuoy, Lock, Palette, RefreshCw, Sparkles, Upload, type LucideIcon } from 'lucide-react'
import { decryptText, encryptText, isEncrypted } from '../lib/crypto'
import { APP_VERSION } from '../lib/version'
import { emptyData, normalize, saveGroup, setData, useData } from '../lib/store'
import { showToast } from '../lib/toast'
import { TR_DAYS, formatDMY, todayISO } from '../lib/date'
import { buildICS } from '../lib/ics'
import IcsImportModal from './IcsImportModal'
import { HomeCardsEditor } from './HomeCards'
import UpdatePanel from './UpdatePanel'
import SyncPanel from './SyncPanel'
import { PALETTE, downloadFile } from '../lib/util'
import { AppearancePanel, AutoBackupStatus, CategoriesPanel, ChangelogPanel, ErrorPanel, HelpPanel, HolidaysPanel, LockPanel, MenuPanel, NotifyPanel, TrashPanel } from './SettingsPanels'

type Section = 'genel' | 'duzen' | 'dersler' | 'bildirim' | 'hesap' | 'yedek' | 'guncelleme' | 'yardim'

/** Ayarlar: solda bölümler, sağda seçilen bölüm (telefonda önce liste, dokununca bölüm) */
export default function SettingsPage() {
  const data = useData()
  const fileRef = useRef<HTMLInputElement>(null)
  const [icsOpen, setIcsOpen] = useState(false)
  // Masaüstünde ilk bölüm açık gelir; telefonda önce bölüm listesi görünür
  const [section, setSection] = useState<Section | null>(() => (window.matchMedia('(max-width: 720px)').matches ? null : 'genel'))
  const pick = (x: Section | null) => {
    setSection(x)
    document.querySelector('.content')?.scrollTo({ top: 0 })
  }
  const groups = Object.values(data.groups).sort((a, b) => a.code.localeCompare(b.code))
  const setSetting = <K extends keyof typeof data.settings>(k: K, v: (typeof data.settings)[K]) =>
    setData((d) => ({ ...d, settings: { ...d.settings, [k]: v } }))

  const backup = async (withPassword: boolean) => {
    let text = JSON.stringify(data)
    let name = `ders-asistani-yedek-${todayISO()}.json`
    if (withPassword) {
      const pw = prompt('Yedek için parola belirleyin (geri yüklerken sorulacak; unutursanız yedek açılamaz):')
      if (!pw) return
      if (pw !== prompt('Parolayı tekrar yazın:')) return alert('Parolalar aynı değil.')
      text = await encryptText(text, pw)
      name = `ders-asistani-sifreli-yedek-${todayISO()}.json`
    }
    await downloadFile(name, text, 'application/json')
  }

  const restore = async (f?: File) => {
    if (!f) return
    try {
      let obj: unknown = JSON.parse(await f.text())
      if (isEncrypted(obj)) {
        const pw = prompt('Bu yedek parolalı. Parolayı yazın:')
        if (!pw) return
        obj = JSON.parse(await decryptText(obj, pw))
      }
      const parsed = normalize(obj)
      if (confirm(`Yedek yüklensin mi? (${parsed.events.length} etkinlik, ${parsed.students.length} öğrenci)\nMevcut verilerin yerini alacak.`)) {
        setData(() => parsed)
        alert('Yedek yüklendi.')
      }
    } catch (e) {
      alert('Yedek okunamadı: ' + (e as Error).message)
    }
  }

  const SECTIONS: { id: Section; label: string; desc: string; icon: LucideIcon }[] = [
    { id: 'genel', label: 'Görünüm ve genel', desc: 'Ad, tema, açık / koyu, yazı boyutu, uygulama kilidi', icon: Palette },
    { id: 'duzen', label: 'Menü ve ana sayfa', desc: 'Menü sırası, ana sayfa kartları', icon: LayoutDashboard },
    { id: 'dersler', label: 'Dersler ve takvim', desc: 'Kurum sınıfları, çalışma saatleri, zil saatleri, tatiller, kategoriler', icon: CalendarDays },
    { id: 'bildirim', label: 'Bildirimler', desc: 'Ders öncesi ve günlük hatırlatmalar', icon: Bell },
    { id: 'hesap', label: 'Hesap ve eşitleme', desc: 'Telefon ↔ tablet eşitleme', icon: RefreshCw },
    { id: 'yedek', label: 'Yedek ve veri', desc: 'Yedek al / geri yükle, Google Takvim, çöp kutusu', icon: Database },
    { id: 'guncelleme', label: 'Güncellemeler', desc: `Sürüm ${APP_VERSION}, yenilikler`, icon: Sparkles },
    { id: 'yardim', label: 'Yardım', desc: 'Kılavuz, hata kaydı', icon: LifeBuoy },
  ]
  const cur = SECTIONS.find((x) => x.id === section)

  const content: Record<Section, JSX.Element> = {
    genel: <><AppearancePanel /><LockPanel /></>,
    duzen: <><MenuPanel /><section className="panel"><h3 className="row-title"><LayoutDashboard size={18} /> Ana sayfa kartları</h3><HomeCardsEditor /></section></>,
    dersler: (
      <>
        <section className="panel">
          <h3>Kurum sınıfları</h3>
          <p className="muted small">Kurum programındaki kodlara anlaşılır bir ad ve renk verin (ör. 478-H0811 → "8-H Matematik").</p>
          {groups.length === 0 ? <p className="muted">Program yüklediğinizde sınıflar burada listelenir.</p> : (
            <div className="group-list">
              {groups.map((g) => (
                <div key={g.code} className="group-row">
                  <code>{g.code}</code>
                  <input placeholder="Görünen ad (opsiyonel)" defaultValue={g.name ?? ''} onBlur={(e) => saveGroup({ ...g, name: e.target.value.trim() || undefined })} />
                  <div className="swatches">
                    {PALETTE.map((c) => (
                      <button key={c} className={'swatch sm' + (g.color === c ? ' sel' : '')} style={{ background: c }} onClick={() => saveGroup({ ...g, color: c })} aria-label={c} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="panel">
          <h3>Ücret ve çalışma saatleri</h3>
          <p className="muted small">Çalışma saatleri "Boş saat bul" önerilerinde ve ana sayfadaki Boş Saatler kartında kullanılır; takvim her zaman 24 saati gösterir.</p>
          <div className="row wrap">
            <label className="field">
              <span>Kurum ek ders saat ücreti ({data.settings.currency})</span>
              <input type="number" min={0} value={data.settings.kurumHourlyRate ?? ''} onChange={(e) => setSetting('kurumHourlyRate', e.target.value === '' ? undefined : Number(e.target.value))} />
            </label>
            <label className="field">
              <span>Çalışma başlangıcı (saat)</span>
              <input type="number" min={0} max={23} value={data.settings.dayStart} onChange={(e) => setSetting('dayStart', Math.min(23, Math.max(0, Number(e.target.value))))} />
            </label>
            <label className="field">
              <span>Çalışma bitişi (saat)</span>
              <input type="number" min={1} max={24} value={data.settings.dayEnd} onChange={(e) => setSetting('dayEnd', Math.min(24, Math.max(data.settings.dayStart + 1, Number(e.target.value))))} />
            </label>
          </div>
        </section>
        {data.settings.bellTimes && Object.keys(data.settings.bellTimes).length > 0 && (
          <section className="panel">
            <h3>Kurum zil saatleri</h3>
            <p className="muted small">Yüklediğiniz programlardan otomatik öğrenildi. Takvimde kurum dersi eklerken "3. saat" gibi seçebilirsiniz.</p>
            <div className="table-wrap">
              <table className="table bell-table">
                <thead><tr><th>Gün</th>{Array.from({ length: Math.max(...Object.values(data.settings.bellTimes).flat().map((b) => b.n)) }, (_, i) => <th key={i}>{i + 1}.</th>)}</tr></thead>
                <tbody>
                  {Object.entries(data.settings.bellTimes).sort(([a], [b]) => Number(a) - Number(b)).map(([wd, list]) => (
                    <tr key={wd}>
                      <td><b>{TR_DAYS[Number(wd)]}</b></td>
                      {Array.from({ length: Math.max(...Object.values(data.settings.bellTimes!).flat().map((b) => b.n)) }, (_, i) => {
                        const b = list.find((x) => x.n === i + 1)
                        return <td key={i} className="small nowrap">{b ? `${b.start}–${b.end}` : <span className="muted">·</span>}</td>
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="btn small ghost" style={{ marginTop: 8 }} onClick={() => confirm('Öğrenilen zil saatleri silinsin mi? Bir sonraki program yüklemesinde yeniden öğrenilir.') && setSetting('bellTimes', undefined)}>Sıfırla</button>
          </section>
        )}
        <HolidaysPanel />
        <CategoriesPanel />
      </>
    ),
    bildirim: <NotifyPanel />,
    hesap: <SyncPanel />,
    yedek: (
      <>
        <section className="panel">
          <h3>Yedekleme</h3>
          <p className="muted small">
            Verileriniz sadece bu cihazda saklanır. Yedeği Google Drive'a ya da kendinize WhatsApp'tan gönderebilirsiniz; parolalı yedekte öğrenci adları ve ücretler okunamaz.
          </p>
          <AutoBackupStatus />
          <div className="row wrap">
            <button className="btn primary" onClick={() => backup(false)}><Download size={16} /> Yedek al</button>
            <button className="btn" onClick={() => backup(true)}><Lock size={16} /> Parolalı yedek al</button>
            <button className="btn" onClick={() => fileRef.current?.click()}><Upload size={16} /> Yedekten geri yükle</button>
            <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => restore(e.target.files?.[0])} />
          </div>
        </section>
        <section className="panel">
          <h3>Google Takvim</h3>
          <p className="muted small">Google Takvim yedeğini (.ics / .zip) içe aktarın ya da derslerinizi .ics olarak dışa aktarıp Google Takvim → Ayarlar → İçe aktar'dan yükleyin.</p>
          <div className="row wrap">
            <button className="btn" onClick={() => setIcsOpen(true)}><Upload size={16} /> Google Takvim yedeğini yükle</button>
            <button className="btn" onClick={() => downloadFile(`ders-takvimi-${todayISO()}.ics`, buildICS(data, todayISO()), 'text/calendar')}><CalendarDays size={16} /> Bugünden itibaren (.ics)</button>
            <button className="btn" onClick={() => downloadFile(`ders-takvimi-tumu.ics`, buildICS(data), 'text/calendar')}><CalendarDays size={16} /> Tümü (.ics)</button>
          </div>
          {icsOpen && <IcsImportModal onClose={() => setIcsOpen(false)} onDone={(d) => showToast(d ? `Google Takvim etkinlikleri eklendi (ilk: ${formatDMY(d)})` : 'Google Takvim etkinlikleri eklendi')} />}
        </section>
        <TrashPanel />
        <section className="panel danger-zone">
          <h3>Tehlikeli bölge</h3>
          <button
            className="btn danger"
            onClick={() => {
              if (confirm('TÜM veriler silinsin mi? Bu işlem geri alınamaz. Önce yedek almanız önerilir.') && confirm('Emin misiniz?')) setData(() => emptyData())
            }}
          >Tüm verileri sil</button>
        </section>
      </>
    ),
    guncelleme: <><UpdatePanel /><ChangelogPanel /></>,
    yardim: <><HelpPanel /><ErrorPanel /></>,
  }

  return (
    <div className={'page settings' + (section ? ' has-section' : '')}>
      <div className="page-head"><h2>Ayarlar</h2></div>
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Ayar bölümleri">
          {SECTIONS.map((x) => (
            <button key={x.id} className={'sn-item' + (section === x.id ? ' active' : '')} onClick={() => pick(x.id)} aria-current={section === x.id ? 'page' : undefined}>
              <span className="sn-ico"><x.icon size={19} /></span>
              <span className="sn-text"><b>{x.label}</b><small>{x.desc}</small></span>
              <ChevronRight size={18} className="sn-arrow" />
            </button>
          ))}
          <p className="muted small sn-foot">Ders Asistanı v{APP_VERSION} · {data.events.length} etkinlik · {data.students.length} öğrenci</p>
        </nav>
        <div className="settings-content">
          {cur && (
            <div className="sc-head">
              <button className="icon-btn sc-back" onClick={() => pick(null)} aria-label="Bölümlere dön"><ChevronLeft size={22} /></button>
              <h3><cur.icon size={20} /> {cur.label}</h3>
            </div>
          )}
          {section && content[section]}
        </div>
      </div>
    </div>
  )
}
