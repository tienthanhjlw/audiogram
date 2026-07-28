import { isMac } from './platform'
import { actions } from './actions'

export interface ShortcutEntry {
  id: string
  label: string
  /** KeyboardEvent.key to match (case-insensitive for letters). */
  key: string
  /** Requires the platform modifier (Cmd on macOS, Ctrl elsewhere). */
  mod?: boolean
  /** Requires Shift — e.g. ⇧←/→ for a 1s (vs. the plain 5s) seek step. */
  shift?: boolean
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
// app's shortcuts are (PHASE1_TASKS.md T13). Undo/redo (P4-T9) intentionally
// have no `accelerator` — Tauri's native Edit menu keeps its own predefined
// `{ item: 'Undo' }`/`{ item: 'Redo' }` (menu.ts), which drives the OS's
// native text-field undo; binding the same accelerator here too would race
// it. These two only ever fire through this file's keydown listener, guarded
// by `notTyping` so a focused input/textarea's own undo isn't hijacked.
export const SHORTCUTS: ShortcutEntry[] = [
  { id: 'openAudio', label: 'Open Audio…', key: 'o', mod: true, accelerator: 'CmdOrCtrl+O', run: actions.openAudio },
  { id: 'export', label: 'Export', key: 'e', mod: true, accelerator: 'CmdOrCtrl+E', run: actions.exportProject },
  { id: 'modeDesign', label: 'Design mode', key: '1', mod: true, accelerator: 'CmdOrCtrl+1', run: actions.setModeDesign },
  { id: 'modeCaptions', label: 'Captions mode', key: '2', mod: true, accelerator: 'CmdOrCtrl+2', run: actions.setModeCaptions },
  { id: 'undo', label: 'Undo', key: 'z', mod: true, when: 'notTyping', run: actions.undo },
  { id: 'redo', label: 'Redo', key: 'z', mod: true, shift: true, when: 'notTyping', run: actions.redo },
  { id: 'togglePlayback', label: 'Play / Pause', key: ' ', when: 'notTyping', run: actions.togglePlayback },
  { id: 'seekBackward', label: 'Seek back 5s', key: 'ArrowLeft', when: 'notTyping', run: actions.seekBackward },
  { id: 'seekForward', label: 'Seek forward 5s', key: 'ArrowRight', when: 'notTyping', run: actions.seekForward },
  { id: 'seekBackwardSmall', label: 'Seek back 1s', key: 'ArrowLeft', shift: true, when: 'notTyping', run: actions.seekBackwardSmall },
  { id: 'seekForwardSmall', label: 'Seek forward 1s', key: 'ArrowRight', shift: true, when: 'notTyping', run: actions.seekForwardSmall },
  { id: 'seekToStart', label: 'Seek to start', key: 'Home', when: 'notTyping', run: actions.seekToStart },
  { id: 'groupNodes', label: 'Group', key: 'g', mod: true, accelerator: 'CmdOrCtrl+G', when: 'notTyping', run: actions.groupSelected },
  { id: 'ungroupNodes', label: 'Ungroup', key: 'g', mod: true, shift: true, accelerator: 'CmdOrCtrl+Shift+G', when: 'notTyping', run: actions.ungroupSelected },
]

/** Human-readable combo for the Help modal, computed per-platform from the
 * same entry menu.ts turns into an accelerator string. */
export function shortcutDisplay(s: ShortcutEntry): string {
  const modPart = s.mod ? (isMac ? '⌘' : 'Ctrl+') : ''
  const shiftPart = s.shift ? '⇧' : ''
  const keyPart = s.key === ' ' ? 'Space'
    : s.key === 'ArrowLeft' ? '←'
    : s.key === 'ArrowRight' ? '→'
    : s.key === 'Home' ? 'Home'
    : s.key.toUpperCase()
  return `${modPart}${shiftPart}${keyPart}`
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
  if (!!s.shift !== e.shiftKey) return false
  return !e.altKey
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
