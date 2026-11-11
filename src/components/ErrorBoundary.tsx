import { Component, type ReactNode } from 'react'
import { errorReport, logError } from '../lib/errlog'
import { downloadFile } from '../lib/native'
import { APP_VERSION } from '../lib/version'

/** Bir ekran çökerse tüm uygulama beyaz ekrana düşmesin: hatayı kaydet, kullanıcıya çıkış yolu göster */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    logError(error, 'ekran')
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="crash">
        <h2>Bir şeyler ters gitti</h2>
        <p>Verileriniz güvende. Uygulamayı yeniden açmayı deneyin; sorun sürerse hata raporunu paylaşın.</p>
        <p className="muted small">{this.state.error.message}</p>
        <div className="row wrap" style={{ justifyContent: 'center' }}>
          <button className="btn primary" onClick={() => location.reload()}>Yeniden aç</button>
          <button className="btn" onClick={() => downloadFile('ders-asistani-hata-raporu.txt', errorReport(APP_VERSION), 'text/plain')}>Hata raporunu paylaş</button>
        </div>
      </div>
    )
  }
}
