import { describe, expect, it } from 'vitest'
import { compose, decompose } from '../scene/transform'
import type { Transform } from '../../types'

function t(x: number, y: number, w: number, h: number): Transform {
  return { x, y, w, h, rotation: 0, opacity: 1 }
}

describe('compose (parity fixture, mirrors Transform::compose in scene_node.rs)', () => {
  it('child {x:.1,y:.1,w:.5,h:.5} inside group {x:.2,y:.2,w:.4,h:.4}', () => {
    const result = compose(t(0.2, 0.2, 0.4, 0.4), t(0.1, 0.1, 0.5, 0.5))
    expect(result.x).toBeCloseTo(0.24, 6)
    expect(result.y).toBeCloseTo(0.24, 6)
    expect(result.w).toBeCloseTo(0.20, 6)
    expect(result.h).toBeCloseTo(0.20, 6)
  })

  it('rotation and opacity compose independently', () => {
    const parent: Transform = { x: 0, y: 0, w: 1, h: 1, rotation: 30, opacity: 0.8 }
    const child: Transform = { x: 0, y: 0, w: 1, h: 1, rotation: 15, opacity: 0.5 }
    const result = compose(parent, child)
    expect(result.rotation).toBeCloseTo(45, 6)
    expect(result.opacity).toBeCloseTo(0.4, 6)
  })
})

describe('decompose round-trip', () => {
  it('compose then decompose returns the original child transform', () => {
    const parent = t(0.1, 0.2, 0.6, 0.5)
    const child = t(0.3, 0.4, 0.7, 0.8)
    const composed = compose(parent, child)
    const recovered = decompose(parent, composed)
    expect(recovered.x).toBeCloseTo(child.x, 5)
    expect(recovered.y).toBeCloseTo(child.y, 5)
    expect(recovered.w).toBeCloseTo(child.w, 5)
    expect(recovered.h).toBeCloseTo(child.h, 5)
  })
})
