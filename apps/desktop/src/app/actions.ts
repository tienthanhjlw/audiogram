import { open } from '@tauri-apps/plugin-dialog'
import { useAppStore, type Mode } from '../store'
import { audioEngine } from '../core/audio/AudioEngine'

// Single set of handlers shared by both src/app/shortcuts.ts (the global
// keydown listener) and src/app/menu.ts (the native menu) per
// PHASE1_TASKS.md T13 — "GỌI CHUNG một action registry (không duplicate
// handler)". Neither of those two call sites should ever contain the actual
// logic itself, only a binding (a key combo or a menu item) to one of these.

async function openAudio(): Promise<void> {
  const file = await open({
    multiple: false,
    filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'm4a', 'flac', 'aac', 'ogg'] }],
  })
  if (!file) return
  const path = String(file)
  const name = path.replace(/\\/g, '/').split('/').pop() || path
  const title = name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')
  useAppStore.getState().set({ audioPath: path, audioName: name, title })
}

function exportProject(): void {
  useAppStore.getState().goTo('export')
}

function setMode(mode: Mode): void {
  const { set, goTo } = useAppStore.getState()
  set({ mode })
  goTo(mode === 'design' ? 'layout' : 'transcript')
}

function togglePlayback(): void {
  audioEngine.toggle()
}

function seekBy(dt: number): void {
  audioEngine.seekBy(dt)
}

function openShortcutsHelp(): void {
  useAppStore.getState().set({ shortcutsHelpOpen: true })
}

export const actions = {
  openAudio,
  exportProject,
  setModeDesign: () => setMode('design'),
  setModeCaptions: () => setMode('captions'),
  togglePlayback,
  seekBackward: () => seekBy(-5),
  seekForward: () => seekBy(5),
  openShortcutsHelp,
}
