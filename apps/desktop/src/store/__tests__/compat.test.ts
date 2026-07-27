import { beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from '../index'

// Every field/action that existed on the flat pre-Phase-1 store
// (src/store.ts before T7 — see git history), hardcoded rather than
// derived, so this test fails loudly if a future refactor silently drops
// one instead of just not adding it. `step`/`goTo`/`next`/`back` were the
// legacy 4-step wizard's own fields — dropped from this list in P3-T13
// once StepTranscript/StepExport (their last callers) were deleted; the
// wizard's shape is no longer a contract worth locking.
const OLD_DATA_FIELDS = [
  'audioPath', 'audioName', 'title', 'canvasSize', 'layoutTemplate',
  'coverImagePath', 'waveStyle', 'waveColor', 'bgColor', 'fps', 'logs',
  'isRendering', 'lastOutput', 'segments', 'srtPath', 'isTranscribing',
  'showSubtitles', 'whisperModel', 'peaks', 'fontSize', 'fontName',
  'karaokeEnabled', 'karaokeColor', 'subtitleColor', 'subtitleYPct', 'zones',
  'titleColor', 'titleAlign', 'titleBold', 'titleItalic',
] as const

const OLD_ACTIONS = ['set'] as const

describe('store compat (Phase 1 T7 slice split)', () => {
  beforeEach(() => {
    useAppStore.setState(useAppStore.getInitialState(), true)
  })

  it('still exposes every pre-Phase-1 field and action, flat', () => {
    const state = useAppStore.getState()
    for (const key of [...OLD_DATA_FIELDS, ...OLD_ACTIONS]) {
      expect(state).toHaveProperty(key)
    }
  })

  it('adds exactly the new T7 fields on top (screen, mode, playing, currentTime, duration, applyTemplate)', () => {
    const state = useAppStore.getState()
    for (const key of ['screen', 'mode', 'playing', 'currentTime', 'duration', 'applyTemplate']) {
      expect(state).toHaveProperty(key)
    }
  })

  it('no longer exposes the legacy 4-step wizard fields (P3-T13)', () => {
    const state = useAppStore.getState()
    for (const key of ['step', 'goTo', 'next', 'back']) {
      expect(state).not.toHaveProperty(key)
    }
  })

  it('set() patches arbitrary fields exactly like the old store', () => {
    useAppStore.getState().set({ title: 'Episode 1', fps: 60 })
    const state = useAppStore.getState()
    expect(state.title).toBe('Episode 1')
    expect(state.fps).toBe(60)
  })

  it('applyTemplate("karaoke") sets the same 6 fields StepLayout.handleTemplateChange did', () => {
    useAppStore.getState().applyTemplate('karaoke')
    const state = useAppStore.getState()
    expect(state.layoutTemplate).toBe('karaoke')
    expect(state.zones).toBeNull()
    expect(state.waveColor).toBe('#FFD60A')
    expect(state.bgColor).toBe('#0A0A14')
    expect(state.waveStyle).toBe('bar')
    expect(state.karaokeEnabled).toBe(true)
  })
})
