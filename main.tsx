import './index.css'

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AppErrorBoundary } from './components/AppErrorBoundary'

// Mark boot early so slow OneDrive/Vite cold starts don't flash the index.html timeout.
;(window as unknown as { __GNANOVA_APP_LOADED__?: boolean }).__GNANOVA_APP_LOADED__ = true

const el = document.getElementById('root')
if (!el) {
  document.body.innerHTML =
    '<p style="font-family:system-ui;padding:2rem">Missing #root — check index.html</p>'
} else {
  ReactDOM.createRoot(el).render(
    <React.StrictMode>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </React.StrictMode>
  )
}
