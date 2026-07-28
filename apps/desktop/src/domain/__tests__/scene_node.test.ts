import { describe, expect, it } from 'vitest'
import type {
  SceneNode,
  Transform,
  TextProps,
  WaveformProps,
  VideoProps,
  StickerProps,
  ImageProps,
} from '../../types'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeTransform(x: number, y: number, w: number, h: number): Transform {
  return { x, y, w, h, rotation: 0, opacity: 1 }
}

/** Compose parent ⊗ child — mirrors Transform.compose() in scene_node.rs */
function compose(parent: Transform, child: Transform): Transform {
  return {
    x:        parent.x + child.x * parent.w,
    y:        parent.y + child.y * parent.h,
    w:        child.w  * parent.w,
    h:        child.h  * parent.h,
    rotation: (parent.rotation ?? 0) + (child.rotation ?? 0),
    opacity:  (parent.opacity  ?? 1) * (child.opacity  ?? 1),
  }
}

/** Decompose root back to child-local — mirrors Transform.decompose() in scene_node.rs */
function decompose(parent: Transform, root: Transform): Transform {
  return {
    x:        (root.x - parent.x) / parent.w,
    y:        (root.y - parent.y) / parent.h,
    w:        root.w / parent.w,
    h:        root.h / parent.h,
    rotation: (root.rotation ?? 0) - (parent.rotation ?? 0),
    opacity:  (parent.opacity ?? 1) > 1e-6 ? (root.opacity ?? 1) / (parent.opacity ?? 1) : 1,
  }
}

// ── Transform compose / decompose ────────────────────────────────────────────

describe('Transform.compose', () => {
  it('child {x:.1,y:.1,w:.5,h:.5} in group {x:.2,y:.2,w:.4,h:.4}', () => {
    const parent = makeTransform(0.2, 0.2, 0.4, 0.4)
    const child  = makeTransform(0.1, 0.1, 0.5, 0.5)
    const result = compose(parent, child)
    expect(result.x).toBeCloseTo(0.24, 6)
    expect(result.y).toBeCloseTo(0.24, 6)
    expect(result.w).toBeCloseTo(0.20, 6)
    expect(result.h).toBeCloseTo(0.20, 6)
  })

  it('rotation and opacity compose independently', () => {
    const parent: Transform = { x: 0, y: 0, w: 1, h: 1, rotation: 30, opacity: 0.8 }
    const child:  Transform = { x: 0, y: 0, w: 1, h: 1, rotation: 15, opacity: 0.5 }
    const result = compose(parent, child)
    expect(result.rotation).toBeCloseTo(45, 6)
    expect(result.opacity).toBeCloseTo(0.4, 6)
  })

  it('identity parent leaves child unchanged', () => {
    const parent = makeTransform(0, 0, 1, 1)
    const child  = makeTransform(0.3, 0.4, 0.5, 0.6)
    const result = compose(parent, child)
    expect(result.x).toBeCloseTo(child.x, 6)
    expect(result.y).toBeCloseTo(child.y, 6)
    expect(result.w).toBeCloseTo(child.w, 6)
    expect(result.h).toBeCloseTo(child.h, 6)
  })
})

describe('Transform.decompose round-trip', () => {
  it('compose then decompose returns original child', () => {
    const parent = makeTransform(0.1, 0.2, 0.6, 0.5)
    const child  = makeTransform(0.3, 0.4, 0.7, 0.8)
    const composed  = compose(parent, child)
    const recovered = decompose(parent, composed)
    expect(recovered.x).toBeCloseTo(child.x, 5)
    expect(recovered.y).toBeCloseTo(child.y, 5)
    expect(recovered.w).toBeCloseTo(child.w, 5)
    expect(recovered.h).toBeCloseTo(child.h, 5)
  })

  it('round-trip with rotation and opacity', () => {
    const parent: Transform = { x: 0.1, y: 0.1, w: 0.5, h: 0.5, rotation: 20, opacity: 0.7 }
    const child:  Transform = { x: 0.2, y: 0.3, w: 0.4, h: 0.6, rotation: 10, opacity: 0.9 }
    const composed  = compose(parent, child)
    const recovered = decompose(parent, composed)
    expect(recovered.rotation).toBeCloseTo(child.rotation!, 5)
    expect(recovered.opacity).toBeCloseTo(child.opacity!, 5)
  })
})

// ── JSON round-trip for each node type ───────────────────────────────────────

describe('SceneNode JSON round-trip', () => {
  function roundTrip<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T
  }

  it('waveform node', () => {
    const node: SceneNode = {
      id: 'w1',
      type: 'waveform',
      transform: makeTransform(0.1, 0.7, 0.8, 0.2),
      z: 1,
      props: { style: 'bar', color: '#7C5CFF' } satisfies WaveformProps,
    }
    expect(roundTrip(node)).toEqual(node)
  })

  it('text node with timing and animOut', () => {
    const node: SceneNode = {
      id: 't1',
      type: 'text',
      transform: makeTransform(0.05, 0.05, 0.9, 0.15),
      z: 2,
      timing: { start: 0, end: 30 },
      animOut: { preset: 'fade', duration: 0.4 },
      props: {
        text: 'My Podcast',
        role: 'title',
        color: '#FFFFFF',
        font: 'Arial',
        size: 48,
        align: 'center',
        bold: true,
        italic: false,
      } satisfies TextProps,
    }
    expect(roundTrip(node)).toEqual(node)
  })

  it('caption text node with boundToTranscript', () => {
    const node: SceneNode = {
      id: 'cap1',
      type: 'text',
      transform: makeTransform(0.05, 0.8, 0.9, 0.15),
      z: 3,
      props: {
        text: '',
        role: 'caption',
        boundToTranscript: true,
        color: '#FFFFFF',
        font: 'Arial',
        size: 32,
        align: 'center',
        bold: false,
        italic: false,
      } satisfies TextProps,
    }
    expect(roundTrip(node)).toEqual(node)
  })

  it('image node with shape', () => {
    const node: SceneNode = {
      id: 'img1',
      type: 'image',
      transform: makeTransform(0.35, 0.1, 0.3, 0.3),
      z: 0,
      props: {
        src: '/path/to/avatar.jpg',
        fit: 'cover',
        shape: 'circle',
      } satisfies ImageProps,
    }
    expect(roundTrip(node)).toEqual(node)
  })

  it('sticker node with timing window', () => {
    const node: SceneNode = {
      id: 's1',
      type: 'sticker',
      parentId: 'g1',
      transform: makeTransform(0.5, 0.5, 0.2, 0.2),
      z: 4,
      timing: { start: 3, end: 8 },
      animIn:  { preset: 'scale-in', duration: 0.5 },
      animOut: { preset: 'fade',     duration: 0.3 },
      props: { assetId: 'mic-wave' } satisfies StickerProps,
    }
    expect(roundTrip(node)).toEqual(node)
  })

  it('video background node', () => {
    const node: SceneNode = {
      id: 'vid1',
      type: 'video',
      transform: makeTransform(0, 0, 1, 1),
      z: -1,
      props: {
        src: '/path/to/bg.mp4',
        fit: 'cover',
        loop: true,
        muted: true,
      } satisfies VideoProps,
    }
    expect(roundTrip(node)).toEqual(node)
  })

  it('group node (no props)', () => {
    const node: SceneNode = {
      id: 'g1',
      type: 'group',
      transform: makeTransform(0.1, 0.1, 0.8, 0.8),
      z: 0,
    }
    expect(roundTrip(node)).toEqual(node)
  })
})

// ── Visibility helper ─────────────────────────────────────────────────────────

describe('isVisibleAt', () => {
  function isVisibleAt(node: SceneNode, t: number): boolean {
    if (!node.timing) return true
    return t >= node.timing.start && t <= node.timing.end
  }

  it('node with no timing is always visible', () => {
    const node: SceneNode = {
      id: 'n', type: 'waveform',
      transform: makeTransform(0, 0, 1, 1), z: 0,
    }
    expect(isVisibleAt(node, 0)).toBe(true)
    expect(isVisibleAt(node, 999)).toBe(true)
  })

  it('node with timing window', () => {
    const node: SceneNode = {
      id: 'n', type: 'sticker',
      transform: makeTransform(0, 0, 0.2, 0.2), z: 0,
      timing: { start: 2, end: 5 },
    }
    expect(isVisibleAt(node, 1.9)).toBe(false)
    expect(isVisibleAt(node, 2.0)).toBe(true)
    expect(isVisibleAt(node, 3.5)).toBe(true)
    expect(isVisibleAt(node, 5.0)).toBe(true)
    expect(isVisibleAt(node, 5.1)).toBe(false)
  })
})
