import { describe, expect, it } from 'vitest'
import { computeEffectiveTransform, isVisibleAt } from '../scene/timing'
import { ANIM_PRESETS } from '../scene/animPresets'
import type { SceneNode, Transform } from '../../types'

function makeTransform(): Transform {
  return { x: 0.2, y: 0.2, w: 0.4, h: 0.4, rotation: 0, opacity: 1 }
}

function makeNode(overrides: Partial<SceneNode> = {}): SceneNode {
  return {
    id: 'n', type: 'waveform', transform: makeTransform(), z: 0,
    props: { type: 'waveform', style: 'bar', color: '#fff' },
    ...overrides,
  }
}

describe('ANIM_PRESETS parity fixture (mirrors anim_presets.rs)', () => {
  const SAMPLE_POINTS = [0, 0.25, 0.5, 0.75, 1]

  it('fade: opacity === t, no dx/dy/scale', () => {
    for (const t of SAMPLE_POINTS) {
      const d = ANIM_PRESETS.fade(t)
      expect(d.opacity).toBeCloseTo(t, 6)
      expect(d.dx).toBe(0)
      expect(d.dy).toBe(0)
      expect(d.scale).toBe(1)
    }
  })

  it('slide-up: opacity === t, dy === (1-t)*0.08', () => {
    for (const t of SAMPLE_POINTS) {
      const d = ANIM_PRESETS['slide-up'](t)
      expect(d.opacity).toBeCloseTo(t, 6)
      expect(d.dy).toBeCloseTo((1 - t) * 0.08, 6)
    }
  })

  it('slide-down: opacity === t, dy === -(1-t)*0.08', () => {
    for (const t of SAMPLE_POINTS) {
      const d = ANIM_PRESETS['slide-down'](t)
      expect(d.opacity).toBeCloseTo(t, 6)
      expect(d.dy).toBeCloseTo(-(1 - t) * 0.08, 6)
    }
  })

  it('scale-in: opacity === t, scale === 0.5 + 0.5*t', () => {
    for (const t of SAMPLE_POINTS) {
      const d = ANIM_PRESETS['scale-in'](t)
      expect(d.opacity).toBeCloseTo(t, 6)
      expect(d.scale).toBeCloseTo(0.5 + 0.5 * t, 6)
    }
  })
})

describe('isVisibleAt', () => {
  it('no timing = always visible', () => {
    const node = makeNode()
    expect(isVisibleAt(node, 0)).toBe(true)
    expect(isVisibleAt(node, 9999)).toBe(true)
  })

  it('within timing window', () => {
    const node = makeNode({ timing: { start: 2, end: 5 } })
    expect(isVisibleAt(node, 1.9)).toBe(false)
    expect(isVisibleAt(node, 2)).toBe(true)
    expect(isVisibleAt(node, 5)).toBe(true)
    expect(isVisibleAt(node, 5.1)).toBe(false)
  })

  it('edge case: end < start collapses to a zero-length window', () => {
    const node = makeNode({ timing: { start: 5, end: 2 } })
    expect(isVisibleAt(node, 3)).toBe(false)
    expect(isVisibleAt(node, 5)).toBe(true)
  })

  it('edge case: timing.end beyond the video duration is clamped', () => {
    const node = makeNode({ timing: { start: 0, end: 100 } })
    expect(isVisibleAt(node, 9, 10)).toBe(true)
    expect(isVisibleAt(node, 50, 10)).toBe(false)
  })
})

describe('computeEffectiveTransform', () => {
  it('no timing returns the same transform reference', () => {
    const node = makeNode()
    expect(computeEffectiveTransform(node, 1)).toBe(node.transform)
  })

  it('animIn fade: opacity 0 at window start, 1 at animIn.duration', () => {
    const node = makeNode({ timing: { start: 0, end: 10 }, animIn: { preset: 'fade', duration: 1 } })
    expect(computeEffectiveTransform(node, 0).opacity).toBeCloseTo(0, 6)
    expect(computeEffectiveTransform(node, 0.5).opacity).toBeCloseTo(0.5, 6)
    expect(computeEffectiveTransform(node, 1).opacity).toBeCloseTo(1, 6)
  })

  it('animOut fade: opacity 1 before the exit window, 0 at window end', () => {
    const node = makeNode({ timing: { start: 0, end: 10 }, animOut: { preset: 'fade', duration: 1 } })
    expect(computeEffectiveTransform(node, 8.5).opacity).toBeCloseTo(1, 6)
    expect(computeEffectiveTransform(node, 9).opacity).toBeCloseTo(1, 6)
    expect(computeEffectiveTransform(node, 10).opacity).toBeCloseTo(0, 6)
  })

  it('edge case: animIn.duration longer than the window clamps to half', () => {
    const node = makeNode({ timing: { start: 0, end: 2 }, animIn: { preset: 'fade', duration: 100 } })
    // Clamped duration = 1s (half of the 2s window) — at t=1 opacity must
    // already be 1, not still fading toward a 100s-long animIn.
    expect(computeEffectiveTransform(node, 1).opacity).toBeCloseTo(1, 6)
  })

  it('scale-in resizes around the transform center, not the top-left corner', () => {
    const node = makeNode({ timing: { start: 0, end: 10 }, animIn: { preset: 'scale-in', duration: 1 } })
    const eff = computeEffectiveTransform(node, 0) // t=0 → scale 0.5
    const base = node.transform
    const baseCx = base.x + base.w / 2
    const baseCy = base.y + base.h / 2
    expect(eff.w).toBeCloseTo(base.w * 0.5, 6)
    expect(eff.x + eff.w / 2).toBeCloseTo(baseCx, 6)
    expect(eff.y + eff.h / 2).toBeCloseTo(baseCy, 6)
  })
})
