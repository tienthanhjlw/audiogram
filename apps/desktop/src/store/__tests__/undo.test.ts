import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '../index'

// P4-T9 — undo/redo is scoped to Design mode + caption text edits only
// (store/index.ts's partializeTemporal), debounced 400ms so a burst of
// set() calls (a slider/Rnd drag) collapses into one history entry.
describe('undo/redo (zundo temporal, P4-T9)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useAppStore.setState(useAppStore.getInitialState(), true)
    // The reset above is itself a set() call, so it may have queued its own
    // debounced history entry (old state vs. fresh initial state) — flush
    // it before clear() so it can't land later and contaminate a test.
    vi.advanceTimersByTime(500)
    useAppStore.temporal.getState().clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function settle() {
    vi.advanceTimersByTime(500)
  }

  it('undo restores a tracked field (titleColor) to its value before the change', () => {
    useAppStore.getState().set({ titleColor: '#FF0000' })
    settle()
    expect(useAppStore.getState().titleColor).toBe('#FF0000')

    useAppStore.temporal.getState().undo()
    expect(useAppStore.getState().titleColor).toBe('#FFFFFF')
  })

  it('redo re-applies the change after an undo', () => {
    useAppStore.getState().set({ titleColor: '#FF0000' })
    settle()

    useAppStore.temporal.getState().undo()
    expect(useAppStore.getState().titleColor).toBe('#FFFFFF')

    useAppStore.temporal.getState().redo()
    expect(useAppStore.getState().titleColor).toBe('#FF0000')
  })

  it('collapses a rapid-fire burst (a single drag) into one history entry', () => {
    // Simulates a Slider/Rnd drag: many set() calls in quick succession,
    // each well within the 400ms debounce window of the previous one.
    for (let pct = 1; pct <= 20; pct++) {
      useAppStore.getState().set({ fontSize: 100 + pct })
      vi.advanceTimersByTime(20)
    }
    settle()
    expect(useAppStore.getState().fontSize).toBe(120)

    useAppStore.temporal.getState().undo()
    expect(useAppStore.getState().fontSize).toBe(100)
    expect(useAppStore.temporal.getState().pastStates).toHaveLength(0)
  })

  it('undoes a segment text edit (SegmentList\'s commit-on-blur/Enter pattern)', () => {
    const original = [{ id: 1, start: 0, end: 1, text: 'hello' }]
    useAppStore.getState().set({ segments: original })
    settle()

    const edited = [{ id: 1, start: 0, end: 1, text: 'hello world' }]
    useAppStore.getState().set({ segments: edited })
    settle()

    useAppStore.temporal.getState().undo()
    expect(useAppStore.getState().segments).toEqual(original)
  })

  it('does not track playback state (currentTime/playing)', () => {
    useAppStore.getState().set({ currentTime: 5, playing: true })
    settle()
    expect(useAppStore.temporal.getState().pastStates).toHaveLength(0)
  })

  it('does not track render state (isRendering/logs/stage)', () => {
    useAppStore.getState().set({ isRendering: true, stage: 'frames', logs: ['x'] })
    settle()
    expect(useAppStore.temporal.getState().pastStates).toHaveLength(0)
  })

  it('does not track UI-only state (selectedEl/exportSheet)', () => {
    useAppStore.getState().selectEl('title')
    useAppStore.getState().setExportSheet('settings')
    settle()
    expect(useAppStore.temporal.getState().pastStates).toHaveLength(0)
  })

  it('does not track project identity (audioPath/title — opening a different file)', () => {
    useAppStore.getState().set({ audioPath: '/b.mp3', audioName: 'b.mp3', title: 'B' })
    settle()
    expect(useAppStore.temporal.getState().pastStates).toHaveLength(0)
  })
})
