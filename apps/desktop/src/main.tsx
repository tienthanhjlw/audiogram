import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import '@fontsource-variable/inter'
import './ui/tokens.css'
import './App.css'
import { useAppStore } from './store'
import { attachIpcEvents } from './core/ipc/events'

// Temporary visual QA route for the ui/ primitives (T4/T5) — not part of
// the app's real navigation, removed once features/ has its own screens.
const isGallery = new URLSearchParams(window.location.search).has('gallery')

// Subscribe to backend events exactly once, here, instead of every
// component that cares mounting its own listen() (TECH_ARCHITECTURE.md
// §2.3, §1.2 F3).
attachIpcEvents(useAppStore)

async function main() {
  const Root = isGallery ? (await import('./ui/__gallery__')).default : App
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <Root />
    </React.StrictMode>,
  )
}

main()
