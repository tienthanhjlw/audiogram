import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isMac } from './platform'

const mockActions = {
  openAudio: vi.fn(),
  importAudioPath: vi.fn(),
  openRecentEntry: vi.fn(),
  exportProject: vi.fn(),
  setModeDesign: vi.fn(),
  setModeCaptions: vi.fn(),
  togglePlayback: vi.fn(),
  seekBackward: vi.fn(),
  seekForward: vi.fn(),
  seekBackwardSmall: vi.fn(),
  seekForwardSmall: vi.fn(),
  seekToStart: vi.fn(),
  openShortcutsHelp: vi.fn(),
  undo: vi.fn(),
  redo: vi.fn(),
}

vi.mock('./actions', () => ({ actions: mockActions }))

const { attachShortcuts, shortcutDisplay, SHORTCUTS } = await import('./shortcuts')

function dispatch(key: string, opts: Partial<KeyboardEventInit> = {}) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts }))
}

describe('attachShortcuts', () => {
  let detach: () => void

  beforeEach(() => {
    Object.values(mockActions).forEach(fn => fn.mockClear())
    detach = attachShortcuts()
  })

  afterEach(() => detach())

  it('Space toggles playback', () => {
    dispatch(' ')
    expect(mockActions.togglePlayback).toHaveBeenCalledTimes(1)
  })

  it('plain ArrowLeft/Right seek 5s — does not also fire the shift variant', () => {
    dispatch('ArrowLeft')
    dispatch('ArrowRight')
    expect(mockActions.seekBackward).toHaveBeenCalledTimes(1)
    expect(mockActions.seekForward).toHaveBeenCalledTimes(1)
    expect(mockActions.seekBackwardSmall).not.toHaveBeenCalled()
    expect(mockActions.seekForwardSmall).not.toHaveBeenCalled()
  })

  it('Shift+ArrowLeft/Right seek 1s — the bug this task fixes: shift combos never matched before', () => {
    dispatch('ArrowLeft', { shiftKey: true })
    dispatch('ArrowRight', { shiftKey: true })
    expect(mockActions.seekBackwardSmall).toHaveBeenCalledTimes(1)
    expect(mockActions.seekForwardSmall).toHaveBeenCalledTimes(1)
    expect(mockActions.seekBackward).not.toHaveBeenCalled()
    expect(mockActions.seekForward).not.toHaveBeenCalled()
  })

  it('Home seeks to start', () => {
    dispatch('Home')
    expect(mockActions.seekToStart).toHaveBeenCalledTimes(1)
  })

  it('does not fire seek shortcuts while typing in an input', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }))
    expect(mockActions.seekBackward).not.toHaveBeenCalled()
    input.remove()
  })

  const modKey = isMac ? 'metaKey' : 'ctrlKey'

  it('⌘Z undoes, ⇧⌘Z redoes (P4-T9)', () => {
    dispatch('z', { [modKey]: true })
    dispatch('z', { [modKey]: true, shiftKey: true })
    expect(mockActions.undo).toHaveBeenCalledTimes(1)
    expect(mockActions.redo).toHaveBeenCalledTimes(1)
  })

  it('⌘Z while typing in a textarea does not touch store history (browser undo instead)', () => {
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', [modKey]: true, bubbles: true, cancelable: true }))
    expect(mockActions.undo).not.toHaveBeenCalled()
    textarea.remove()
  })
})

describe('shortcutDisplay', () => {
  it('renders the shift glyph for shift-modified entries', () => {
    const entry = SHORTCUTS.find(s => s.id === 'seekBackwardSmall')!
    expect(shortcutDisplay(entry)).toBe('⇧←')
  })

  it('renders Home for the seek-to-start entry', () => {
    const entry = SHORTCUTS.find(s => s.id === 'seekToStart')!
    expect(shortcutDisplay(entry)).toBe('Home')
  })
})
