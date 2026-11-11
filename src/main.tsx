import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import { initStore } from './lib/store'
import { setupBackButton } from './lib/native'
import { installErrorLogging } from './lib/errlog'
import ErrorBoundary from './components/ErrorBoundary'

setupBackButton()
installErrorLogging()

// Kalıcı veri yüklenmeden ekran çizilmez; böylece boş veriyle üzerine yazma riski olmaz.
// (Yükleme takılırsa 3 sn sonra yine de açılır.)
Promise.race([initStore(), new Promise((r) => setTimeout(r, 3000))]).finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  )
})
