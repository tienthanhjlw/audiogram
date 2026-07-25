import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import '@fontsource-variable/inter'
import './ui/tokens.css'
import './App.css'

// Temporary visual QA route for the ui/ primitives (T4/T5) — not part of
// the app's real navigation, removed once features/ has its own screens.
const isGallery = new URLSearchParams(window.location.search).has('gallery')

async function main() {
  const Root = isGallery ? (await import('./ui/__gallery__')).default : App
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <Root />
    </React.StrictMode>,
  )
}

main()
