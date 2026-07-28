import { beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from '../index'
import { indexById, staticWorldTransform } from '../../domain/scene/group'
import type { SceneNode } from '../../types'

function waveformNode(id: string, x: number, y: number, w: number, h: number, z = 0): SceneNode {
  return {
    id, type: 'waveform',
    transform: { x, y, w, h, rotation: 0, opacity: 1 },
    z,
    props: { type: 'waveform', style: 'bar', color: '#fff' },
  }
}

beforeEach(() => {
  useAppStore.setState({ nodes: [], selectedNodeIds: [] })
})

describe('groupNodes', () => {
  it('wraps 2+ selected root-level nodes in a new group sized to their bounding box', () => {
    useAppStore.setState({
      nodes: [waveformNode('a', 0.1, 0.1, 0.2, 0.2), waveformNode('b', 0.5, 0.5, 0.2, 0.2)],
    })
    useAppStore.getState().groupNodes(['a', 'b'])
    const { nodes, selectedNodeIds } = useAppStore.getState()
    const group = nodes.find(n => n.type === 'group')!
    expect(group).toBeDefined()
    expect(selectedNodeIds).toEqual([group.id])
    expect(nodes.find(n => n.id === 'a')!.parentId).toBe(group.id)
    expect(nodes.find(n => n.id === 'b')!.parentId).toBe(group.id)
    // bbox covers both nodes: x∈[0.1,0.7], y∈[0.1,0.7]
    expect(group.transform.x).toBeCloseTo(0.1, 6)
    expect(group.transform.y).toBeCloseTo(0.1, 6)
    expect(group.transform.w).toBeCloseTo(0.6, 6)
    expect(group.transform.h).toBeCloseTo(0.6, 6)
  })

  it('is a no-op with fewer than 2 ids', () => {
    useAppStore.setState({ nodes: [waveformNode('a', 0, 0, 0.2, 0.2)] })
    useAppStore.getState().groupNodes(['a'])
    expect(useAppStore.getState().nodes).toHaveLength(1)
  })

  it('is a no-op when the selected nodes have different parents', () => {
    useAppStore.setState({
      nodes: [
        { ...waveformNode('a', 0, 0, 0.2, 0.2), parentId: 'g1' },
        waveformNode('b', 0.5, 0.5, 0.2, 0.2), // root level
      ],
    })
    useAppStore.getState().groupNodes(['a', 'b'])
    expect(useAppStore.getState().nodes).toHaveLength(2) // no group created
  })

  it('preserves absolute (world) position of grouped nodes', () => {
    const a = waveformNode('a', 0.1, 0.1, 0.2, 0.2)
    const b = waveformNode('b', 0.5, 0.5, 0.2, 0.2)
    useAppStore.setState({ nodes: [a, b] })
    const before = { a: staticWorldTransform(a, indexById([a, b])), b: staticWorldTransform(b, indexById([a, b])) }

    useAppStore.getState().groupNodes(['a', 'b'])

    const { nodes } = useAppStore.getState()
    const nodesById = indexById(nodes)
    const afterA = staticWorldTransform(nodes.find(n => n.id === 'a')!, nodesById)
    const afterB = staticWorldTransform(nodes.find(n => n.id === 'b')!, nodesById)
    expect(afterA.x).toBeCloseTo(before.a.x, 5)
    expect(afterA.y).toBeCloseTo(before.a.y, 5)
    expect(afterB.x).toBeCloseTo(before.b.x, 5)
    expect(afterB.y).toBeCloseTo(before.b.y, 5)
  })
})

describe('ungroupNode', () => {
  it('dissolves the group, reparents children to root, preserves absolute position, selects the freed children', () => {
    useAppStore.setState({
      nodes: [waveformNode('a', 0.1, 0.1, 0.2, 0.2), waveformNode('b', 0.5, 0.5, 0.2, 0.2)],
    })
    useAppStore.getState().groupNodes(['a', 'b'])
    const groupId = useAppStore.getState().nodes.find(n => n.type === 'group')!.id
    const beforeUngroupById = indexById(useAppStore.getState().nodes)
    const worldA = staticWorldTransform(beforeUngroupById.get('a')!, beforeUngroupById)
    const worldB = staticWorldTransform(beforeUngroupById.get('b')!, beforeUngroupById)

    useAppStore.getState().ungroupNode(groupId)

    const { nodes, selectedNodeIds } = useAppStore.getState()
    expect(nodes.find(n => n.type === 'group')).toBeUndefined()
    expect(selectedNodeIds.sort()).toEqual(['a', 'b'])
    const a = nodes.find(n => n.id === 'a')!
    const b = nodes.find(n => n.id === 'b')!
    expect(a.parentId).toBeUndefined()
    expect(b.parentId).toBeUndefined()
    expect(a.transform.x).toBeCloseTo(worldA.x, 5)
    expect(a.transform.y).toBeCloseTo(worldA.y, 5)
    expect(b.transform.x).toBeCloseTo(worldB.x, 5)
    expect(b.transform.y).toBeCloseTo(worldB.y, 5)
  })

  it('is a no-op for a non-group id', () => {
    useAppStore.setState({ nodes: [waveformNode('a', 0, 0, 0.2, 0.2)] })
    useAppStore.getState().ungroupNode('a')
    expect(useAppStore.getState().nodes).toHaveLength(1)
  })

  it('group round trip: group then move then ungroup lands children at the moved position', () => {
    useAppStore.setState({
      nodes: [waveformNode('a', 0.0, 0.0, 0.2, 0.2), waveformNode('b', 0.3, 0.3, 0.2, 0.2), waveformNode('c', 0.6, 0.6, 0.2, 0.2)],
    })
    useAppStore.getState().groupNodes(['a', 'b', 'c'])
    const groupId = useAppStore.getState().nodes.find(n => n.type === 'group')!.id

    // "Move the group" — shift its transform directly (drag in the UI).
    useAppStore.getState().updateNodeTransform(groupId, {
      x: useAppStore.getState().nodes.find(n => n.id === groupId)!.transform.x + 0.1,
      y: useAppStore.getState().nodes.find(n => n.id === groupId)!.transform.y + 0.1,
    })

    useAppStore.getState().ungroupNode(groupId)

    const { nodes } = useAppStore.getState()
    // Original world x for 'a' was 0.0; group moved +0.1 → expect 0.1.
    expect(nodes.find(n => n.id === 'a')!.transform.x).toBeCloseTo(0.1, 5)
    expect(nodes.find(n => n.id === 'a')!.transform.y).toBeCloseTo(0.1, 5)
  })
})
