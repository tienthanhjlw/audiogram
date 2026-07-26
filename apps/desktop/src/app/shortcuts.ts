import { isMac } from './platform'
import { actions } from './actions'

export interface ShortcutEntry {
  id: string
  label: string
  /** KeyboardEvent.key to match (case-insensitive for letters). */
  key: string
  /** Requires the platform modifier (Cmd on macOS, Ctrl elsewhere). */
  mod?: boolean
  /** Guards against firing while the user is typing in a field. */
  when?: 'notTyping'
  /** Tauri accelerator syntax — only set for the entries also bound in the
   * native menu (menu.ts), so the two can't drift apart from each other. */
  accelerator?: string
  run: () => void
}

// The one declarative shortcut table for the whole app — menu.ts reads
// `accelerator` back out for the native menu, and ShortcutsHelpModal.tsx
// renders this same list, so there's exactly one place that knows what the
// app's shortcuts are (PHASE1_TASKS.md T13). Undo (⌘Z) is intentionally not
// here yet — it's Phase 4, once zundo is wired up.
export const SHORTCUTS: ShortcutEntry[] = [
  { id: 'openAudio', label: 'Open Audio…', key: 'o', mod: true, accelerator: 'CmdOrCtrl+O', run: actions.openAudio },
  { id: 'export', label: 'Export', key: 'e', mod: true, accelerator: 'CmdOrCtrl+E', run: actions.exportProject },
  { id: 'modeDesign', label: 'Design mode', key: '1', mod: true, accelerator: 'CmdOrCtrl+1', run: actions.setModeDesign },
  { id: 'modeCaptions', label: 'Captions mode', key: '2', mod: true, accelerator: 'CmdOrCtrl+2', run: actions.setModeCaptions },
  { id: 'togglePlayback', label: 'Play / Pause', key: ' ', when: 'notTyping', run: actions.togglePlayback },
  { id: 'seekBackward', label: 'Seek back 5s', key: 'ArrowLeft', when: 'notTyping', run: actions.seekBackward },
  { id: 'seekForward', label: 'Seek forward 5s', key: 'ArrowRight', when: 'notTyping', run: actions.seekForward },
]

/** Human-readable combo for the Help modal, computed per-platform from the
 * same entry menu.ts turns into an accelerator string. */
export function shortcutDisplay(s: ShortcutEntry): string {
  const modPart = s.mod ? (isMac ? '⌘' : 'Ctrl+') : ''
  const keyPart = s.key === ' ' ? 'Space' : s.key === 'ArrowLeft' ? '←' : s.key === 'ArrowRight' ? '→' : s.key.toUpperCase()
  return `${modPart}${keyPart}`
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'
}

function matchesKey(e: KeyboardEvent, s: ShortcutEntry): boolean {
  if (e.key.toLowerCase() !== s.key.toLowerCase()) return false
  const hasMod = isMac ? e.metaKey : e.ctrlKey
  if (!!s.mod !== hasMod) return false
  return !e.altKey && !e.shiftKey
}

/** One global keydown listener for the whole app, registered once from
 * main.tsx's bootstrap (same one-subscription pattern as attachIpcEvents /
 * attachAudioEngine). Returns an unsubscribe function. */
export function attachShortcuts(): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    for (const s of SHORTCUTS) {
      if (s.when === 'notTyping' && isTypingTarget(e.target)) continue
      if (!matchesKey(e, s)) continue
      e.preventDefault()
      s.run()
      return
    }
  }
  window.addEventListener('keydown', onKeyDown)
  return () => window.removeEventListener('keydown', onKeyDown)
}
