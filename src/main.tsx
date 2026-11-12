import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'
import { getData, initStore } from './lib/store'
import { applyAccent } from './lib/accent'
import { setupBackButton } from './lib/native'
import { installErrorLogging } from './lib/errlog'
import ErrorBoundary from './components/ErrorBoundary'
import { confirmRunning, startAutoUpdate } from './lib/updater'
import { startSync } from './lib/syncManager'

setupBackButton()
applyAccent(getData().settings.accent)
const started = Date.now()
installErrorLogging()

// Kalıcı veri yüklenmeden ekran çizilmez; böylece boş veriyle üzerine yazma riski olmaz.
// (Yükleme takılırsa 3 sn sonra yine de açılır.)
Promise.race([initStore(), new Promise((r) => setTimeout(r, 3000))]).finally(() => {
  applyAccent(getData().settings.accent)
  // Açılış ekranı en az kısa bir süre görünür, sonra yumuşakça kaybolur
  const splash = document.getElementById('splash')
  setTimeout(() => {
    splash?.classList.add('hide')
    setTimeout(() => splash?.remove(), 500)
  }, Math.max(0, 650 - (Date.now() - started)))
  // Arayüz sorunsuz açıldı: yeni güncelleme paketi onaylanır, sonra arka planda güncelleme aranır
  setTimeout(() => {
    confirmRunning()
    startAutoUpdate()
    startSync()
  }, 4000)
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  )
})
