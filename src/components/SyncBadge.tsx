import { useSyncExternalStore } from 'react'
import { Cloud, CloudOff, RefreshCw } from 'lucide-react'
import { onSyncStatus, syncStatus } from '../lib/syncManager'

/** Hesap bağlıyken küçük durum göstergesi: güncel / eşitleniyor / bağlantı yok */
export default function SyncBadge({ onClick, compact }: { onClick?: () => void; compact?: boolean }) {
  const s = useSyncExternalStore(onSyncStatus, syncStatus)
  if (s.kind === 'off') return null
  const [Icon, text, cls] =
    s.kind === 'syncing' ? [RefreshCw, 'Eşitleniyor…', 'busy']
    : s.kind === 'error' ? [CloudOff, s.auth ? 'Yeniden giriş gerekli' : 'Çevrimdışı · değişiklikler bekliyor', 'err']
    : [Cloud, 'Güncel', 'ok']
  return (
    <button className={'sync-badge ' + cls + (compact ? ' compact' : '')} onClick={onClick} title={s.kind === 'error' ? s.message : text} aria-label={text}>
      <Icon size={compact ? 18 : 15} className={s.kind === 'syncing' ? 'spin' : ''} />
      {!compact && <span>{text}</span>}
    </button>
  )
}
