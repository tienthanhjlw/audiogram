import { describe, expect, it } from 'vitest'
import { indexById, isVisibleWithAncestors, worldTransform } from '../scene/group'
import { decompose } from '../scene/transform'
import type { SceneNode, Transform } from '../../types'

function t(x: number, y: number, w: number, h: number): Transform {
  return { x, y, w, h, rotation: 0, opacity: 1 }
}

function groupNode(id: string, transform: Transform, overrides: Partial<SceneNode> = {}): SceneNode {
  return { id, type: 'group', transform, z: 0, ...overrides }
}

function childNode(id: string, parentId: string, transform: Transform, z = 0): SceneNode {
  return {
    id, type: 'waveform', parentId, transform, z,
    props: { type: 'waveform', style: 'bar', color: '#fff' },
  }
}

describe('worldTransform (group composition)', () => {
  it('a root node with no parent returns its own transform', () => {
    const node = childNode('a', '', t(0.1, 0.1, 0.5, 0.5))
    node.parentId = undefined
    const nodesById = indexById([node])
    expect(worldTransform(node, nodesById, 0, 0)).toEqual(node.transform)
  })

  it('composes parent ⊗ child for a grouped node', () => {
    const group = groupNode('g', t(0.2, 0.2, 0.4, 0.4))
    const child = childNode('c', 'g', t(0.1, 0.1, 0.5, 0.5))
    const nodesById = indexById([group, child])
    const world = worldTransform(child, nodesById, 0, 0)
    expect(world.x).toBeCloseTo(0.24, 6)
    expect(world.y).toBeCloseTo(0.24, 6)
    expect(world.w).toBeCloseTo(0.20, 6)
    expect(world.h).toBeCloseTo(0.20, 6)
  })
})

describe('round-trip: group → move → ungroup preserves absolute child position', () => {
  it('ungrouping a root-level group: child.transform becomes its world transform, parentId cleared', () => {
    const original = [
      childNode('a', 'g', t(0.0, 0.0, 0.2, 0.2)),
      childNode('b', 'g', t(0.3, 0.3, 0.2, 0.2)),
      childNode('c', 'g', t(0.6, 0.6, 0.2, 0.2)),
    ]
    const groupBefore = groupNode('g', t(0.1, 0.1, 0.5, 0.5))
    const beforeById = indexById([groupBefore, ...original])
    const worldBefore = original.map(n => worldTransform(n, beforeById, 0, 0))

    // "Move the group" — shift its transform (drag in the UI).
    const groupAfter = groupNode('g', t(0.1 + 0.15, 0.1 + 0.05, 0.5, 0.5))
    const afterById = indexById([groupAfter, ...original])
    const worldAfterMove = original.map(n => worldTransform(n, afterById, 0, 0))

    // Every child's world position shifted by exactly the group's delta.
    for (let i = 0; i < original.length; i++) {
      expect(worldAfterMove[i].x).toBeCloseTo(worldBefore[i].x + 0.15, 6)
      expect(worldAfterMove[i].y).toBeCloseTo(worldBefore[i].y + 0.05, 6)
    }

    // "Ungroup" — design.slice.ts's ungroupNode sets each child's own
    // `transform` to its current world transform (root has no parent, so
    // world IS the new local transform) and clears `parentId`. A node
    // rendered standalone with this transform must land at the exact same
    // screen position it had a moment ago as part of the group.
    const ungrouped = original.map(n => ({ ...n, parentId: undefined, transform: worldTransform(n, afterById, 0, 0) }))
    const rootOnlyById = indexById(ungrouped)
    for (let i = 0; i < ungrouped.length; i++) {
      const worldAfterUngroup = worldTransform(ungrouped[i], rootOnlyById, 0, 0)
      expect(worldAfterUngroup.x).toBeCloseTo(worldAfterMove[i].x, 6)
      expect(worldAfterUngroup.y).toBeCloseTo(worldAfterMove[i].y, 6)
      expect(worldAfterUngroup.w).toBeCloseTo(worldAfterMove[i].w, 6)
      expect(worldAfterUngroup.h).toBeCloseTo(worldAfterMove[i].h, 6)
    }
  })

  it('ungrouping a NESTED group: decompose against the grandparent recovers the correct local transform', () => {
    // grandparent (root) → group "g" → child "c". Ungrouping "g" makes "c"
    // a direct child of the grandparent — its `transform` must become
    // local-to-grandparent (decompose), not world-space, since it still has
    // a parent after ungroup.
    const grandparent = groupNode('gp', t(0.1, 0.1, 0.8, 0.8))
    const group = groupNode('g', t(0.2, 0.2, 0.5, 0.5), { parentId: 'gp' })
    const child = childNode('c', 'g', t(0.1, 0.1, 0.3, 0.3))
    const nodesById = indexById([grandparent, group, child])

    const worldBefore = worldTransform(child, nodesById, 0, 0)

    // Ungroup "g": child's new parent is "gp"; new local transform is
    // decompose(grandparent's world transform, child's current world transform).
    const grandparentWorld = worldTransform(grandparent, nodesById, 0, 0)
    const newLocal = decompose(grandparentWorld, worldBefore)
    const ungroupedChild = { ...child, parentId: 'gp', transform: newLocal }
    const afterById = indexById([grandparent, ungroupedChild])
    const worldAfter = worldTransform(ungroupedChild, afterById, 0, 0)

    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 5)
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 5)
    expect(worldAfter.w).toBeCloseTo(worldBefore.w, 5)
    expect(worldAfter.h).toBeCloseTo(worldBefore.h, 5)
  })
})

describe('isVisibleWithAncestors', () => {
  it('a group with timing hides the whole subtree even though children have none', () => {
    const group = groupNode('g', t(0, 0, 1, 1), { timing: { start: 2, end: 5 } })
    const child = childNode('c', 'g', t(0, 0, 1, 1))
    const nodesById = indexById([group, child])
    expect(isVisibleWithAncestors(child, nodesById, 1, 0)).toBe(false)
    expect(isVisibleWithAncestors(child, nodesById, 3, 0)).toBe(true)
    expect(isVisibleWithAncestors(child, nodesById, 6, 0)).toBe(false)
  })

  it('a child with its own timing inside an always-visible group still respects its own window', () => {
    const group = groupNode('g', t(0, 0, 1, 1))
    const child = childNode('c', 'g', t(0, 0, 1, 1))
    child.timing = { start: 2, end: 5 }
    const nodesById = indexById([group, child])
    expect(isVisibleWithAncestors(child, nodesById, 1, 0)).toBe(false)
    expect(isVisibleWithAncestors(child, nodesById, 3, 0)).toBe(true)
  })
})

describe('group animIn applies to the whole group (P5-T10 step 6)', () => {
  it('a fading-in group scales down the opacity of every child too', () => {
    const group = groupNode('g', t(0.1, 0.1, 0.5, 0.5), {
      timing: { start: 0, end: 10 },
      animIn: { preset: 'fade', duration: 2 },
    })
    const child = childNode('c', 'g', t(0, 0, 1, 1))
    const nodesById = indexById([group, child])
    // At t=0 (window start), group opacity should be 0 → child's world opacity is 0 too.
    const worldAtStart = worldTransform(child, nodesById, 0, 0)
    expect(worldAtStart.opacity).toBeCloseTo(0, 6)
    // At t=2 (animIn.duration elapsed), fully faded in.
    const worldAtEnd = worldTransform(child, nodesById, 2, 0)
    expect(worldAtEnd.opacity).toBeCloseTo(1, 6)
  })
})
