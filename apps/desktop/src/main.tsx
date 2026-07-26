import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import '@fontsource-variable/inter'
import './ui/tokens.css'
import './App.css'
import { useAppStore } from './store'
import { attachIpcEvents } from './core/ipc/events'
import { attachAudioEngine } from './core/audio/bootstrap'
import { attachShortcuts } from './app/shortcuts'
import { buildAppMenu } from './app/menu'
import { registerBuiltins } from './extensions'
import { attachSessionPersistence } from './core/persistence/attach'
import { renderProjectThumb } from './features/preview/thumbnailer'

// Temporary visual QA route for the ui/ primitives (T4/T5) — not part of
// the app's real navigation, removed once features/ has its own screens.
const isGallery = new URLSearchParams(window.location.search).has('gallery')

// Subscribe to backend events exactly once, here, instead of every
// component that cares mounting its own listen() (TECH_ARCHITECTURE.md
// §2.3, §1.2 F3).
// Built-in extension registries (T1) — templates/waves/palettes, so galleries
// (Phase 2) and swatch rows read from one registered source instead of
// scattered hardcoded arrays. Idempotent, safe before any other bootstrap step.
registerBuiltins()

attachIpcEvents(useAppStore)

// Same one-time-subscription idea for audio: AudioEngine (T10) decodes each
// file once and owns the single <audio> element; this wires its ticks into
// playback.slice (TECH_ARCHITECTURE §2.6).
attachAudioEngine(useAppStore)

// Debounced session.json + recents.json writer (T4) — auto-restore on
// launch is Phase 4 (UI_REBUILD_PLAN.md §4.4); this just keeps both files
// current so START's Recents grid (P2-T5) has something to read.
attachSessionPersistence(useAppStore, renderProjectThumb)

// One global keydown listener (T13) — same one-subscription pattern as
// above, guarded per-entry against typing in a field (shortcuts.ts).
attachShortcuts()

// Replaces Tauri's default menu with File/Edit/View/Help (app/menu.ts).
// Soft-fails outside a real Tauri webview (e.g. the Vite-only dev preview).
void buildAppMenu().catch(() => {})

async function main() {
  const Root = isGallery ? (await import('./ui/__gallery__')).default : App
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <Root />
    </React.StrictMode>,
  )
}

main()
