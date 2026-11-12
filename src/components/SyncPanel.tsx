import { useEffect, useState, useSyncExternalStore } from 'react'
import { Cloud, CloudOff, Laptop, RefreshCw, Smartphone, Tablet } from 'lucide-react'
import { connect, createAccount, disconnect, listDevices, loadConfig, login, normalizeServer, removeDevice, serverHasData, serverStatus, type SyncConfig } from '../lib/sync'
import { onSyncStatus, refreshSyncStatus, syncNow, syncStatus } from '../lib/syncManager'
import { emptyData, getData, setData, useData } from '../lib/store'
import Modal from './Modal'
import { openExternal } from '../lib/native'

const GUIDE = 'https://github.com/poyankee/DersAsistan/blob/HEAD/docs/ESITLEME-KURULUM.md'

const ago = (t?: number) => {
  if (!t) return ''
  const s = Math.round((Date.now() - t) / 1000)
  if (s < 60) return 'az önce'
  if (s < 3600) return `${Math.round(s / 60)} dk önce`
  return new Date(t).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const guessDevice = () => (Math.min(window.screen.width, window.screen.height) >= 600 ? 'Tablet' : 'Telefon')

/** Ayarlar → Eşitleme (telefon ↔ tablet, kendi sunucunuz) */
export default function SyncPanel() {
  const status = useSyncExternalStore(onSyncStatus, syncStatus)
  const [cfg, setCfg] = useState<SyncConfig | null>(null)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    loadConfig().then((c) => {
      setCfg(c)
      setLoaded(true)
    })
  }, [status.kind])
  if (!loaded) return null
  return (
    <section className="panel">
      <h3 className="row-title">{cfg ? <Cloud size={18} /> : <CloudOff size={18} />} Eşitleme (telefon ↔ tablet)</h3>
      {cfg ? <Connected cfg={cfg} onOff={() => setCfg(null)} /> : <ConnectForm onDone={setCfg} />}
    </section>
  )
}

function Connected({ cfg, onOff }: { cfg: SyncConfig; onOff: () => void }) {
  const status = useSyncExternalStore(onSyncStatus, syncStatus)
  const [devices, setDevices] = useState<Awaited<ReturnType<typeof listDevices>> | null>(null)
  const reload = () => listDevices(cfg).then(setDevices).catch(() => setDevices(null))
  useEffect(() => {
    reload()
  }, [cfg]) // eslint-disable-line react-hooks/exhaustive-deps
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 30_000)
    return () => clearInterval(t)
  }, [])
  const text =
    status.kind === 'syncing' ? 'Eşitleniyor…'
    : status.kind === 'error' ? status.message
    : status.kind === 'idle' ? (status.last ? `Eşitlendi · ${ago(status.last)}${status.received ? ` · ${status.received} değişiklik alındı` : ''}` : 'Bağlı')
    : ''
  return (
    <>
      <p className="muted small" style={{ marginTop: 0 }}>
        <b>{cfg.device}</b> olarak <b>{cfg.server.replace(/^https?:\/\//, '').replace(/\/api\.php$/, '')}</b> sunucusuna bağlı ({cfg.user}).
        Değişiklikler birkaç saniye içinde öteki cihaza geçer. Veriler cihazda şifrelenir; sunucu içeriği göremez.
      </p>
      <div className={'sync-status' + (status.kind === 'error' ? ' err' : '')}>
        <RefreshCw size={15} className={status.kind === 'syncing' ? 'spin' : ''} /> {text}
      </div>
      <div className="row wrap" style={{ gap: 8, marginTop: 8 }}>
        <button className="btn small" disabled={status.kind === 'syncing'} onClick={() => syncNow()}><RefreshCw size={14} /> Şimdi eşitle</button>
        <button
          className="btn small ghost"
          onClick={async () => {
            if (!confirm('Bu cihazın eşitlemesi kapatılsın mı? Bu cihazdaki veriler silinmez; sunucudaki veriler de kalır.')) return
            await disconnect()
            refreshSyncStatus(false)
            onOff()
          }}
        >
          Bu cihazın bağlantısını kes
        </button>
      </div>
      {status.kind === 'error' && status.auth && <p className="warn-text small">Oturumun süresi dolmuş ya da kapatılmış. Bağlantıyı kesip yeniden giriş yapın.</p>}
      {devices && devices.length > 0 && (
        <>
          <h4>Bağlı cihazlar</h4>
          <ul className="device-list">
            {devices.map((d, i) => {
              const Icon = /tablet/i.test(d.device) ? Tablet : /bilgisayar|pc|laptop/i.test(d.device) ? Laptop : Smartphone
              return (
                <li key={i}>
                  <Icon size={16} /> <b>{d.device}</b>{d.current && <span className="muted"> (bu cihaz)</span>}
                  <span className="grow" />
                  <small className="muted">son görülme {ago(d.lastSeen * 1000)}</small>
                  {!d.current && (
                    <button
                      className="btn small ghost"
                      onClick={async () => {
                        if (!confirm(`"${d.device}" cihazının oturumu kapatılsın mı? (Kaybolan ya da artık kullanmadığınız cihazlar için.) O cihaz yeniden parolayla giriş yapmadan eşitleyemez.`)) return
                        await removeDevice(cfg, d.id).catch((e) => alert((e as Error).message))
                        reload()
                      }}
                    >
                      Kaldır
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </>
  )
}

function ConnectForm({ onDone }: { onDone: (c: SyncConfig) => void }) {
  const data = useData()
  const [server, setServer] = useState('')
  const [user, setUser] = useState('ogretmen')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [device, setDevice] = useState(guessDevice)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [newAccount, setNewAccount] = useState<boolean | null>(null)
  const [insecure, setInsecure] = useState(false)
  const [code, setCode] = useState('')
  const [choose, setChoose] = useState<SyncConfig | null>(null)

  const localHasData = data.events.length + data.students.length + data.tasks.length > 0

  const finish = async (c: SyncConfig, mode: 'push' | 'replace' | 'merge') => {
    await connect(c, mode, getData, setData, emptyData)
    setChoose(null)
    refreshSyncStatus(true)
    onDone(c)
  }

  const check = async () => {
    setError('')
    setBusy('Sunucu denetleniyor…')
    try {
      const s = await serverStatus(normalizeServer(server))
      setInsecure(s.https === false && !/^http:\/\/(localhost|127\.|10\.|192\.168\.)/.test(normalizeServer(server)))
      setNewAccount(!s.setup)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy('')
    }
  }

  const submit = async () => {
    setError('')
    if (newAccount && password.length < 10) return setError('Parola en az 10 karakter olmalı.')
    if (newAccount && (/^\d+$/.test(password) || new Set(password).size < 5)) return setError('Parola çok basit: harf, rakam ve farklı karakterler karıştırın (ör. bir cümlenin baş harfleri + yıl).')
    if (newAccount && password !== password2) return setError('Parolalar aynı değil.')
    if (newAccount && code.replace(/\s/g, '').length < 10) return setError('Kurulum kodunu girin.')
    setBusy(newAccount ? 'Hesap oluşturuluyor…' : 'Giriş yapılıyor…')
    try {
      if (newAccount) {
        const c = await createAccount(server, user.trim(), password, device.trim() || 'Cihaz', code)
        await finish(c, 'push')
      } else {
        const c = await login(server, user.trim(), password, device.trim() || 'Cihaz')
        const remote = await serverHasData(c)
        if (!remote) await finish(c, 'push')
        else if (!localHasData) await finish(c, 'replace')
        else setChoose(c)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy('')
    }
  }

  return (
    <>
      <p className="muted small" style={{ marginTop: 0 }}>
        Kendi hostinginize kurduğunuz Ders Asistanı sunucusu ile telefon ve tablet aynı verileri kullanır.
        {' '}<button className="link-btn" onClick={() => openExternal(GUIDE)}>Kurulum kılavuzu</button>
      </p>
      <label className="field"><span>Sunucu adresi</span>
        <input value={server} onChange={(e) => { setServer(e.target.value); setNewAccount(null) }} onBlur={() => server.trim() && newAccount === null && check()} placeholder="ör. alanadiniz.com/ders" inputMode="url" autoCapitalize="none" autoCorrect="off" />
      </label>
      {newAccount === null ? (
        <button className="btn primary" disabled={!server.trim() || !!busy} onClick={check}>Devam</button>
      ) : (
        <>
          {insecure && <p className="warn-text small">Sunucu şifresiz (HTTP) bağlantı bildiriyor. Hosting panelinden SSL'i açın.</p>}
          <p className={'small ' + (newAccount ? 'ok' : 'muted')}>{newAccount ? 'Sunucu hazır; henüz hesap yok. İlk cihaz olarak hesabı oluşturun.' : 'Sunucuda hesap var; aynı kullanıcı adı ve parolayla giriş yapın.'}</p>
          <div className="row wrap">
            <label className="field grow"><span>Kullanıcı adı</span><input value={user} onChange={(e) => setUser(e.target.value)} autoCapitalize="none" autoCorrect="off" /></label>
            <label className="field grow"><span>Bu cihazın adı</span><input value={device} onChange={(e) => setDevice(e.target.value)} placeholder="Telefon / Tablet" /></label>
          </div>
          <label className="field"><span>Parola</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={newAccount ? 'new-password' : 'current-password'} /></label>
          {newAccount && (
            <>
              <label className="field">
                <span>Kurulum kodu</span>
                <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ör. K7M2QX9TPA" autoCapitalize="characters" autoCorrect="off" />
                <small className="muted">Hosting panelinde Dosya Yöneticisi → ders → veri → KURULUM-KODU.txt dosyasında yazar. Böylece hesabı sizden başkası açamaz.</small>
              </label>
              <label className="field"><span>Parola (tekrar)</span><input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} autoComplete="new-password" /></label>
              <p className="warn-text small">Parolayı unutmayın: veriler bu parolayla şifrelenir; parola olmadan sunucudaki kopya açılamaz. (Cihazlardaki veriler etkilenmez.)</p>
            </>
          )}
          <button className="btn primary" disabled={!!busy || !user.trim() || !password} onClick={submit}>{newAccount ? 'Hesap oluştur ve bağlan' : 'Giriş yap ve bağlan'}</button>
        </>
      )}
      {busy && <p className="muted small">{busy}</p>}
      {error && <div className="error small">{error}</div>}

      {choose && (
        <Modal title="Sunucuda veri var" onClose={() => setChoose(null)}>
          <p>Hem sunucuda hem bu cihazda veri var. Ne yapılsın?</p>
          <div className="choice-list">
            <button className="choice" onClick={() => finish(choose, 'replace')}>
              <b>Sunucudakini kullan (önerilen)</b>
              <small>Bu cihazdaki veriler sunucudakilerle değiştirilir. Bu cihazın eski verisi ayrıca saklanır.</small>
            </button>
            <button className="choice" onClick={() => finish(choose, 'merge')}>
              <b>Birleştir</b>
              <small>İki taraftaki kayıtlar birleştirilir. İki cihaza ayrı ayrı aynı program yüklendiyse dersler iki kez görünebilir.</small>
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
