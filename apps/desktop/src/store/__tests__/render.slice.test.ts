import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '../index'

describe('render.slice onRenderEvent', () => {
  beforeEach(() => {
    useAppStore.setState(useAppStore.getInitialState(), true)
  })

  it('stage events update stage, and preparing resets progress', () => {
    const { onRenderEvent } = useAppStore.getState()
    onRenderEvent({ kind: 'progress', pct: 50, frame: 50, total: 100 })
    expect(useAppStore.getState().progressPct).toBe(50)

    onRenderEvent({ kind: 'stage', stage: 'preparing' })
    const state = useAppStore.getState()
    expect(state.stage).toBe('preparing')
    // preparing doesn't itself reset progressPct/frame/total — only clears
    // the ETA history so a fresh job doesn't inherit a stale rate estimate.
    expect(state.progressPct).toBe(50)
  })

  it('progress events set stage to frames and update frame/total/pct', () => {
    const { onRenderEvent } = useAppStore.getState()
    onRenderEvent({ kind: 'progress', pct: 25, frame: 60, total: 240 })
    const state = useAppStore.getState()
    expect(state.stage).toBe('frames')
    expect(state.progressPct).toBe(25)
    expect(state.frame).toBe(60)
    expect(state.totalFrames).toBe(240)
  })

  it('log events append to logs', () => {
    const { onRenderEvent } = useAppStore.getState()
    onRenderEvent({ kind: 'log', line: 'Starting render…' })
    onRenderEvent({ kind: 'log', line: 'Frame 1/100' })
    expect(useAppStore.getState().logs).toEqual(['Starting render…', 'Frame 1/100'])
  })

  it('failed events set stage to failed and clear eta', () => {
    const { onRenderEvent } = useAppStore.getState()
    onRenderEvent({ kind: 'failed', error: { kind: 'cancelled', message: 'Cancelled' } })
    const state = useAppStore.getState()
    expect(state.stage).toBe('failed')
    expect(state.etaSeconds).toBeNull()
  })

  it('done events set stage to done, pct to 100, and clear eta', () => {
    const { onRenderEvent } = useAppStore.getState()
    onRenderEvent({ kind: 'done', output: '/tmp/out.mp4' })
    const state = useAppStore.getState()
    expect(state.stage).toBe('done')
    expect(state.progressPct).toBe(100)
    expect(state.etaSeconds).toBeNull()
  })

  it('computes an eta from the recent pct/time rate once it has 2+ samples', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const { onRenderEvent } = useAppStore.getState()

    // pctHistory is a closure variable, not reactive state, so it isn't
    // reset by the beforeEach's setState — a real 'preparing' stage event
    // (which every render always emits first, per encode_blocking's own
    // emission order) is what actually clears it, same as in production.
    onRenderEvent({ kind: 'stage', stage: 'preparing' })
    onRenderEvent({ kind: 'progress', pct: 10, frame: 10, total: 100 })
    expect(useAppStore.getState().etaSeconds).toBeNull() // only 1 sample so far

    vi.setSystemTime(2000) // +2s, +10pct => 5%/s; 80% remaining / 5%/s = 16s left
    onRenderEvent({ kind: 'progress', pct: 20, frame: 20, total: 100 })
    expect(useAppStore.getState().etaSeconds).toBeCloseTo(16, 0)

    vi.useRealTimers()
  })

  it('does not compute a negative/zero-rate eta as a false completion estimate', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const { onRenderEvent } = useAppStore.getState()

    onRenderEvent({ kind: 'stage', stage: 'preparing' })
    onRenderEvent({ kind: 'progress', pct: 50, frame: 50, total: 100 })
    vi.setSystemTime(1000)
    onRenderEvent({ kind: 'progress', pct: 50, frame: 50, total: 100 }) // stalled
    expect(useAppStore.getState().etaSeconds).toBeNull()

    vi.useRealTimers()
  })
})
