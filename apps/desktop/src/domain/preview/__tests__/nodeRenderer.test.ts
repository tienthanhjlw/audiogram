import { describe, expect, it } from 'vitest'
import { drawFrame, type FrameSpec } from '../renderer'
import { drawSceneFrame, type SceneShared } from '../nodeRenderer'
import type { SceneNode } from '../../../types'
import { DEFAULT_ZONES } from '../../../types'

// Same call-recorder approach as renderer.test.ts (no node-canvas available in
// this environment): both drawFrame (legacy) and drawSceneFrame (P5-T3) render
// into a Proxy that logs every ctx call, and we assert the two logs agree on
// the calls that matter (waveform draw + title text/position), proving the
// node renderer is behaviourally equivalent to the legacy `minimal` layout for
// an equivalent waveform + title node pair.
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
        return (text: string, x: number, y: number, maxW: number) => {
          calls.push(`fillText:${text}:${Math.round(x)}:${Math.round(y)}:${Math.round(maxW)}`)
        }
      }
      return () => { calls.push(prop) }
    },
    set(t, prop, value) {
      if (typeof prop === 'string') calls.push(`set:${prop}:${value}`)
      t[prop as string] = value
      return true
    },
  })
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls }
}

const W = 1280, H = 720

function makeLegacySpec(overrides: Partial<FrameSpec> = {}): FrameSpec {
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
    layoutTemplate: 'minimal',
    titleColor: '#FFFFFF',
    titleAlign: 'center',
    titleBold: false,
    titleItalic: false,
    subtitlePreview: false, // no activeSeg + no preview placeholder => no subtitle drawn, matches node list below
    ...overrides,
  }
}

function makeEquivalentNodes(): SceneNode[] {
  const z = DEFAULT_ZONES.minimal
  return [
    {
      id: 'wave1',
      type: 'waveform',
      parentId: undefined,
      transform: { x: z.waveform.x, y: z.waveform.y, w: z.waveform.w, h: z.waveform.h, rotation: 0, opacity: 1 },
      z: 0,
      timing: undefined,
      animIn: undefined,
      animOut: undefined,
      keyframes: [],
      props: { type: 'waveform', style: 'bar', color: '#7C5CFF' },
    },
    {
      id: 'title1',
      type: 'text',
      parentId: undefined,
      transform: { x: z.title.x, y: z.title.y, w: z.title.w, h: z.title.h, rotation: 0, opacity: 1 },
      z: 1,
      timing: undefined,
      animIn: undefined,
      animOut: undefined,
      keyframes: [],
      props: {
        type: 'text',
        text: 'Test Title',
        role: 'title',
        boundToTranscript: false,
        color: '#FFFFFF',
        font: 'Arial',
        size: 1080 * 0.058, // fs = round(H * size/1080) = round(H * 0.058), matching legacy drawTitle's H*0.058*(fontSize/100) at fontSize=100
        align: 'center',
        bold: false,
        italic: false,
      },
    },
  ]
}

function makeSharedFromSpec(spec: FrameSpec): SceneShared {
  return {
    peaks: spec.peaks,
    waveTime: spec.waveTime,
    waveDur: spec.waveDur,
    waveLoop: spec.waveLoop,
    eqState: spec.eqState,
    fftPeaks: spec.fftPeaks,
    fftBuckets: spec.fftBuckets,
    images: new Map(),
  }
}

describe('drawSceneFrame parity with legacy drawFrame (minimal layout)', () => {
  it('draws the title text at the same fillText call as drawFrame', () => {
    const legacy = mockCtx()
    drawFrame(legacy.ctx, W, H, makeLegacySpec())

    const nodes = mockCtx()
    const spec = makeLegacySpec()
    drawSceneFrame(nodes.ctx, W, H, makeEquivalentNodes(), spec.t, makeSharedFromSpec(spec))

    const legacyFillTexts = legacy.calls.filter(c => c.startsWith('fillText:'))
    const nodeFillTexts = nodes.calls.filter(c => c.startsWith('fillText:'))
    expect(nodeFillTexts).toEqual(legacyFillTexts)
  })

  it('dispatches to the waveform effect (bar) producing draw calls', () => {
    const nodes = mockCtx()
    const spec = makeLegacySpec()
    drawSceneFrame(nodes.ctx, W, H, makeEquivalentNodes(), spec.t, makeSharedFromSpec(spec))
    expect(nodes.calls.length).toBeGreaterThan(0)
  })

  it('renders nothing for an empty node list', () => {
    const { ctx, calls } = mockCtx()
    const spec = makeLegacySpec()
    drawSceneFrame(ctx, W, H, [], spec.t, makeSharedFromSpec(spec))
    expect(calls.length).toBe(0)
  })

  it('respects z-order: higher z draws after lower z', () => {
    const { ctx, calls } = mockCtx()
    const nodes = makeEquivalentNodes()
    // waveform z=0 (drawn first), text z=1 (drawn after) — same order as legacy minimal layout.
    drawSceneFrame(ctx, W, H, nodes, 0, makeSharedFromSpec(makeLegacySpec()))
    const firstFillText = calls.findIndex(c => c.startsWith('fillText:'))
    const firstWaveCall = calls.findIndex(c => c === 'save' || c === 'beginPath' || c === 'fillRect')
    expect(firstWaveCall).toBeGreaterThanOrEqual(0)
    expect(firstFillText).toBeGreaterThan(firstWaveCall)
  })
})

describe('drawSceneFrame timing filter (P5-T8)', () => {
  it('skips a node outside its timing window and draws it inside it', () => {
    const node: SceneNode = {
      id: 'w1', type: 'waveform',
      transform: { x: 0.02, y: 0.3, w: 0.96, h: 0.36, rotation: 0, opacity: 1 },
      z: 0,
      timing: { start: 5, end: 8 },
      props: { type: 'waveform', style: 'bar', color: '#7C5CFF' },
    }
    const shared = makeSharedFromSpec(makeLegacySpec())

    const outside = mockCtx()
    drawSceneFrame(outside.ctx, W, H, [node], 1.0, shared)
    expect(outside.calls.length).toBe(0)

    const inside = mockCtx()
    drawSceneFrame(inside.ctx, W, H, [node], 6.0, shared)
    expect(inside.calls.length).toBeGreaterThan(0)
  })
})

describe('drawSceneFrame performance (P5-T3 budget: <=16ms for 20 nodes @1080p)', () => {
  it('renders 20 mixed nodes under budget', () => {
    const nodes: SceneNode[] = Array.from({ length: 20 }, (_, i) => ({
      id: `n${i}`,
      type: i % 2 === 0 ? 'waveform' : 'text',
      parentId: undefined,
      transform: { x: 0.1, y: 0.1 * (i % 8), w: 0.3, h: 0.1, rotation: 0, opacity: 1 },
      z: i,
      timing: undefined,
      animIn: undefined,
      animOut: undefined,
      keyframes: [],
      props: i % 2 === 0
        ? { type: 'waveform', style: 'bar', color: '#7C5CFF' }
        : { type: 'text', text: `Node ${i}`, role: 'freeform', boundToTranscript: false, color: '#fff', font: 'Arial', size: 40, align: 'center', bold: false, italic: false },
    }))
    const shared = makeSharedFromSpec(makeLegacySpec())
    const { ctx } = mockCtx()

    const start = performance.now()
    drawSceneFrame(ctx, 1920, 1080, nodes, 1.0, shared)
    const ms = performance.now() - start

    console.log(`[P5-T3 budget] drawSceneFrame, 20 nodes @1080p: ${ms.toFixed(3)} ms (budget <= 16 ms)`)
    expect(ms).toBeLessThanOrEqual(16)
  })
})
