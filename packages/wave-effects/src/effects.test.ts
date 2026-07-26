import { describe, expect, it } from 'vitest'
import { WAVE_EFFECTS } from './registry'
import { WAVE_BARS } from './support'
import type { WaveDrawCtx } from './types'

// No node-canvas (native build, heavy — PHASE1_TASKS.md T17 step 3
// explicitly says not to add it). A Proxy stands in for
// CanvasRenderingContext2D instead: every method call and property write is
// recorded as a string in `calls`, with zero real drawing — jsdom alone is
// enough to run this.
function mockCtx(): { ctx: CanvasRenderingContext2D; calls: string[] } {
  const calls: string[] = []
  const gradient = { addColorStop: () => { calls.push('gradient.addColorStop') } }
  const target: Record<string, unknown> = {}
  const ctx = new Proxy(target, {
    get(t, prop) {
      if (typeof prop !== 'string') return undefined
      if (prop in t) return t[prop]
      if (prop === 'createLinearGradient') {
        return () => { calls.push('createLinearGradient'); return gradient }
      }
      // Everything else read off an untouched key is treated as a drawing
      // method — record the call and return a no-op function.
      return (..._args: unknown[]) => { calls.push(prop) }
    },
    set(t, prop, value) {
      if (typeof prop === 'string') calls.push(`set:${prop}`)
      t[prop as string] = value
      return true
    },
  })
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls }
}

function makeDrawCtx(ctx: CanvasRenderingContext2D): WaveDrawCtx {
  const heights = Array.from({ length: WAVE_BARS }, (_, i) => 0.3 + 0.5 * Math.abs(Math.sin(i)))
  const peaks = Array.from({ length: 200 }, (_, i) => 0.4 + 0.4 * Math.abs(Math.sin(i * 0.1)))
  return {
    ctx,
    color: '#7C5CFF',
    peaks,
    heights,
    waveTime: 1.5,
    waveDur: 10,
    waveLoop: true,
    eqState: new Float32Array(40),
    fftPeaks: null,
    fftBuckets: 0,
    wx: 10,
    wy: 10,
    ww: 300,
    wh: 100,
  }
}

describe('wave effects', () => {
  const ids = Object.keys(WAVE_EFFECTS)

  it('registers all 9 effects', () => {
    expect(ids.sort()).toEqual(
      ['bar', 'dot', 'eq', 'line', 'mirror', 'neon', 'orb', 'player', 'pulse'].sort(),
    )
  })

  for (const id of ids) {
    it(`${id} draws without throwing and issues at least one drawing call`, () => {
      const { ctx, calls } = mockCtx()
      const dc = makeDrawCtx(ctx)
      expect(() => WAVE_EFFECTS[id].draw(dc)).not.toThrow()
      expect(calls.length).toBeGreaterThan(0)
    })
  }
})
