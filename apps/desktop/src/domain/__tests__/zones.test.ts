import { describe, expect, it } from 'vitest'
import { clampZoneFraction, snapToCenterPx } from '../zones'

describe('clampZoneFraction', () => {
  it('leaves an in-bounds zone unchanged', () => {
    expect(clampZoneFraction(0.2, 0.3, 0.4, 0.2)).toEqual({ x: 0.2, y: 0.3 })
  })

  it('clamps negative x/y to 0', () => {
    expect(clampZoneFraction(-0.1, -0.2, 0.4, 0.2)).toEqual({ x: 0, y: 0 })
  })

  it('clamps so the zone never crosses the far edge', () => {
    expect(clampZoneFraction(0.9, 0.9, 0.4, 0.2)).toEqual({ x: 0.6, y: 0.8 })
  })
})

describe('snapToCenterPx', () => {
  const canvasW = 1000, canvasH = 500

  it('snaps to center when within threshold on both axes', () => {
    // zone center at (505, 252) — within 8px of (500, 250) on both axes
    const r = snapToCenterPx(405, 232, 200, 40, canvasW, canvasH)
    expect(r.snappedX).toBe(true)
    expect(r.snappedY).toBe(true)
    expect(r.x).toBe(400) // 500 - 200/2
    expect(r.y).toBe(230) // 250 - 40/2
  })

  it('does not snap when outside threshold', () => {
    const r = snapToCenterPx(100, 100, 200, 40, canvasW, canvasH)
    expect(r.snappedX).toBe(false)
    expect(r.snappedY).toBe(false)
    expect(r.x).toBe(100)
    expect(r.y).toBe(100)
  })

  it('snaps independently per axis', () => {
    // x centered, y far off
    const r = snapToCenterPx(400, 50, 200, 40, canvasW, canvasH)
    expect(r.snappedX).toBe(true)
    expect(r.snappedY).toBe(false)
    expect(r.x).toBe(400)
    expect(r.y).toBe(50)
  })
})
