import { useEffect, useState, useSyncExternalStore } from 'react'
import { Download, RefreshCw, Sparkles, X } from 'lucide-react'
import { checkForUpdate, installApkUpdate, nativeInfo, onUpdateState, restartToUpdate, updateState } from '../lib/updater'
import { APP_VERSION, BUILD } from '../lib/version'
import { setData, useData } from '../lib/store'
import { isNative } from '../lib/native'

export function useUpdateState() {
  return useSyncExternalStore(onUpdateState, updateState)
}

/** Ekranın altında: güncelleme hazır olunca tek dokunuşla yeniden başlatma */
export function UpdateBanner() {
  const s = useUpdateState()
  const [hidden, setHidden] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  if ((s.kind !== 'ready' && s.kind !== 'apk') || hidden === s.build) return null
  const apk = s.kind === 'apk'
  return (
    <div className="update-banner" role="status">
      <Sparkles size={18} />
      <span className="grow">
        <b>Yeni sürüm hazır</b>
        <small>{s.version}{apk ? ' · tek dokunuşla kurulur' : ' · yeniden başlatınca açılır'}</small>
      </span>
      <button
        className="btn small primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          try {
            if (apk) {
              const r = await installApkUpdate()
              if (r === 'permission') alert('Açılan ekranda "Bu kaynaktan izin ver"i açın, sonra tekrar "Kur"a dokunun.')
            } else await restartToUpdate()
          } finally {
            setBusy(false)
          }
        }}
      >
        {apk ? <><Download size={14} /> Kur</> : <><RefreshCw size={14} /> Yeniden başlat</>}
      </button>
      <button className="icon-btn small" onClick={() => setHidden(s.build)} aria-label="Sonra"><X size={16} /></button>
    </div>
  )
}

/** Ayarlar → Güncellemeler */
export default function UpdatePanel() {
  const data = useData()
  const s = useUpdateState()
  const [info, setInfo] = useState<Awaited<ReturnType<typeof nativeInfo>>>(null)
  useEffect(() => {
    nativeInfo().then(setInfo)
  }, [s.kind])
  const auto = data.settings.autoUpdate !== false
  const status =
    s.kind === 'checking' ? 'Denetleniyor…'
    : s.kind === 'downloading' ? 'Yeni sürüm indiriliyor…'
    : s.kind === 'current' ? 'Uygulama güncel.'
    : s.kind === 'ready' ? `Yeni sürüm (${s.version}) indirildi; yeniden başlatınca açılır.`
    : s.kind === 'apk' ? `Yeni sürüm (${s.version}) Android tarafında da değişiklik içeriyor; tek dokunuşla kurulur.`
    : s.kind === 'error' ? s.message
    : ''
  return (
    <section className="panel">
      <h3 className="row-title"><RefreshCw size={18} /> Güncellemeler</h3>
      <p className="muted small" style={{ marginTop: 0 }}>
        Sürüm {APP_VERSION}{BUILD ? `.${BUILD}` : ''}{info?.versionCode && info.versionCode !== BUILD ? ` (kurulu APK: ${info.versionCode})` : ''}.
        Yenilikler internetten kendiliğinden indirilir; APK kurmanız gerekmez.
      </p>
      {!isNative && <p className="muted small">Güncellemeler Android uygulamasında çalışır.</p>}
      {isNative && (
        <>
          <label className="check"><input type="checkbox" checked={auto} onChange={(e) => setData((d) => ({ ...d, settings: { ...d.settings, autoUpdate: e.target.checked } }))} /> Güncellemeleri kendiliğinden indir</label>
          <div className="row middle wrap" style={{ gap: 8 }}>
            <button className="btn small" disabled={s.kind === 'checking' || s.kind === 'downloading'} onClick={() => checkForUpdate()}><RefreshCw size={14} /> Şimdi denetle</button>
            {s.kind === 'ready' && <button className="btn small primary" onClick={() => restartToUpdate()}>Yeniden başlat</button>}
            {s.kind === 'apk' && <button className="btn small primary" onClick={() => installApkUpdate().catch(() => undefined)}><Download size={14} /> İndir ve kur</button>}
          </div>
          {status && <p className={'small' + (s.kind === 'error' ? ' warn-text' : ' muted')}>{status}</p>}
        </>
      )}
    </section>
  )
}
