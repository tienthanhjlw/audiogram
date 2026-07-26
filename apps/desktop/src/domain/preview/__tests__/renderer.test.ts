import { describe, expect, it } from 'vitest'
import { drawFrame, type FrameSpec } from '../renderer'
import type { LayoutTemplate } from '../../../types'

// No node-canvas (heavy native build) — same Proxy-recorder approach as
// packages/wave-effects/src/effects.test.ts. measureText and the gradient
// factories are special-cased since real arithmetic code (wrapText,
// gradient stops) depends on their return shape; everything else is
// recorded as a no-op call so we can assert "something was drawn".
function mockCtx(): { ctx: CanvasRenderingContext2D; calls: string[] } {
  const calls: string[] = []
  const gradient = { addColorStop: () => { calls.push('gradient.addColorStop') } }
  const target: Record<string, unknown> = {}
  const ctx = new Proxy(target, {
    get(t, prop) {
      if (typeof prop !== 'string') return undefined
      if (prop in t) return t[prop]
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
        return () => { calls.push(prop); return gradient }
      }
      if (prop === 'measureText') {
        return (text: string) => { calls.push('measureText'); return { width: text.length * 6 } }
      }
      if (prop === 'fillText') {
        return (text: string) => { calls.push(`fillText:${text}`) }
      }
      return () => { calls.push(prop) }
    },
    set(t, prop, value) {
      if (typeof prop === 'string') calls.push(`set:${prop}`)
      t[prop as string] = value
      return true
    },
  })
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls }
}

function makeSpec(layoutTemplate: LayoutTemplate, overrides: Partial<FrameSpec> = {}): FrameSpec {
  const peaks = Array.from({ length: 300 }, (_, i) => 0.4 + 0.4 * Math.abs(Math.sin(i * 0.1)))
  return {
    t: 1.0,
    peaks,
    color: '#7C5CFF',
    bgColor: '#111827',
    waveStyle: 'bar',
    title: 'Test Title',
    fontSize: 100,
    fontName: 'Arial',
    karaokeEnabled: false,
    karaokeColor: '#FFD60A',
    activeSeg: undefined,
    slotStart: 0,
    slotDur: 0,
    elapsed: 0,
    segments: [],
    coverImg: null,
    waveTime: 2.5,
    waveDur: 10,
    waveLoop: true,
    eqState: new Float32Array(40),
    fftPeaks: null,
    fftBuckets: 0,
    subtitleColor: '#FFFFFF',
    subtitleYPct: null,
    zones: null,
    layoutTemplate,
    titleColor: '#FFFFFF',
    titleAlign: 'center',
    titleBold: false,
    titleItalic: false,
    subtitlePreview: true,
    ...overrides,
  }
}

const TEMPLATES: LayoutTemplate[] = ['spotify', 'split', 'minimal', 'fullbg', 'karaoke', 'brand']

describe('drawFrame', () => {
  it.each(TEMPLATES)('renders %s without throwing and draws something', (layout) => {
    const { ctx, calls } = mockCtx()
    expect(() => drawFrame(ctx, 640, 360, makeSpec(layout))).not.toThrow()
    expect(calls.length).toBeGreaterThan(0)
  })

  it.each(TEMPLATES)('never draws the removed "audiogram" watermark on %s', (layout) => {
    const { ctx, calls } = mockCtx()
    drawFrame(ctx, 640, 360, makeSpec(layout))
    expect(calls.some(c => c === 'fillText:audiogram')).toBe(false)
  })

  it('handles empty peaks without throwing (no waveform to draw yet)', () => {
    const { ctx } = mockCtx()
    expect(() => drawFrame(ctx, 640, 360, makeSpec('minimal', { peaks: [] }))).not.toThrow()
  })
})
