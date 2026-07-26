import { open } from '@tauri-apps/plugin-dialog'
import { useAppStore, type Mode } from '../store'
import { audioEngine } from '../core/audio/AudioEngine'
import { AUDIO_EXTENSIONS, deriveAudioMeta } from '../domain/audio'

// Single set of handlers shared by both src/app/shortcuts.ts (the global
// keydown listener) and src/app/menu.ts (the native menu) per
// PHASE1_TASKS.md T13 — "GỌI CHUNG một action registry (không duplicate
// handler)". Neither of those two call sites should ever contain the actual
// logic itself, only a binding (a key combo or a menu item) to one of these.

async function openAudio(): Promise<void> {
  const file = await open({
    multiple: false,
    filters: [{ name: 'Audio', extensions: AUDIO_EXTENSIONS }],
  })
  if (!file) return
  // UI_DESIGN_SPEC.md §2.2 — "Không có bước xác nhận trung gian": jumps
  // straight into Studio Design in the same set() call. features/start's
  // App.tsx used to watch audioPath and flip screen itself (P1-T11's
  // seam); P2-T5 removes that effect now that the real START screen (this
  // action, plus DropZone's drag-and-drop path) always sets it directly.
  useAppStore.getState().set({ ...deriveAudioMeta(String(file)), screen: 'studio', mode: 'design' })
}

/** Same effect as openAudio(), for a path that's already known — the drag
 * & drop path (features/start/DropZone.tsx) validates the extension itself
 * before calling this, since a drop's toast/shake feedback needs to
 * distinguish "not an audio file" from other failure modes. */
function importAudioPath(path: string): void {
  useAppStore.getState().set({ ...deriveAudioMeta(path), screen: 'studio', mode: 'design' })
}

/** Opens a Recents entry (features/start/RecentGrid.tsx) — restores just
 * audioPath/audioName/title, keeping whatever title the user gave it (not
 * re-derived from the filename, unlike importAudioPath). Restoring the
 * rest of the session (design/captions) is Phase 4 (UI_REBUILD_PLAN.md
 * §4.4) — for now this behaves like re-picking the same file. */
function openRecentEntry(entry: { audioPath: string; audioName: string; title: string }): void {
  useAppStore.getState().set({
    audioPath: entry.audioPath,
    audioName: entry.audioName,
    title: entry.title,
    screen: 'studio',
    mode: 'design',
  })
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

function seekToStart(): void {
  audioEngine.seek(0)
}

function openShortcutsHelp(): void {
  useAppStore.getState().set({ shortcutsHelpOpen: true })
}

export const actions = {
  openAudio,
  importAudioPath,
  openRecentEntry,
  exportProject,
  setModeDesign: () => setMode('design'),
  setModeCaptions: () => setMode('captions'),
  togglePlayback,
  seekBackward: () => seekBy(-5),
  seekForward: () => seekBy(5),
  seekBackwardSmall: () => seekBy(-1),
  seekForwardSmall: () => seekBy(1),
  seekToStart,
  openShortcutsHelp,
}
