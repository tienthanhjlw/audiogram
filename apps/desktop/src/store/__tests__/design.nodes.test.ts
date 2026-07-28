import { beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from '../index'
import type { SceneNode } from '../../types'

function waveformNode(id: string, z = 0): SceneNode {
  return {
    id,
    type: 'waveform',
    transform: { x: 0, y: 0, w: 1, h: 1, rotation: 0, opacity: 1 },
    z,
    props: { type: 'waveform', style: 'bar', color: '#fff' },
  }
}

function textNode(id: string, z = 1): SceneNode {
  return {
    id,
    type: 'text',
    transform: { x: 0.1, y: 0.1, w: 0.5, h: 0.2, rotation: 0, opacity: 1 },
    z,
    props: {
      type: 'text', text: 'Hi', role: 'freeform', boundToTranscript: false,
      color: '#fff', font: 'Arial', size: 40, align: 'center', bold: false, italic: false,
    },
  }
}

beforeEach(() => {
  useAppStore.setState({ nodes: [], selectedNodeIds: [] })
})

describe('design.slice node actions', () => {
  it('addNode appends and selects the new node', () => {
    const node = waveformNode('a')
    useAppStore.getState().addNode(node)
    expect(useAppStore.getState().nodes).toEqual([node])
    expect(useAppStore.getState().selectedNodeIds).toEqual(['a'])
  })

  it('removeNode deletes the node and clears it from selection', () => {
    useAppStore.getState().addNode(waveformNode('a'))
    useAppStore.getState().addNode(textNode('b'))
    useAppStore.getState().setSelectedNodeIds(['a', 'b'])
    useAppStore.getState().removeNode('a')
    expect(useAppStore.getState().nodes.map(n => n.id)).toEqual(['b'])
    expect(useAppStore.getState().selectedNodeIds).toEqual(['b'])
  })

  it('updateNodeTransform shallow-merges into transform', () => {
    useAppStore.getState().addNode(waveformNode('a'))
    useAppStore.getState().updateNodeTransform('a', { x: 0.5, opacity: 0 })
    const node = useAppStore.getState().nodes[0]
    expect(node.transform).toMatchObject({ x: 0.5, y: 0, w: 1, h: 1, opacity: 0 })
  })

  it('updateNodeProps shallow-merges into props, preserving the type tag', () => {
    useAppStore.getState().addNode(textNode('a'))
    useAppStore.getState().updateNodeProps('a', { text: 'Updated', bold: true })
    const node = useAppStore.getState().nodes[0]
    expect(node.props).toMatchObject({ type: 'text', text: 'Updated', bold: true, color: '#fff' })
  })

  it('updateNodeProps is a no-op for a node with no props (group)', () => {
    const group: SceneNode = { id: 'g', type: 'group', transform: { x: 0, y: 0, w: 1, h: 1, rotation: 0, opacity: 1 }, z: 0 }
    useAppStore.getState().addNode(group)
    useAppStore.getState().updateNodeProps('g', { text: 'nope' } as never)
    expect(useAppStore.getState().nodes[0].props).toBeUndefined()
  })

  it('moveNodeZ swaps z with the next node up/down in sort order', () => {
    useAppStore.getState().addNode(waveformNode('a', 0))
    useAppStore.getState().addNode(textNode('b', 1))
    useAppStore.getState().moveNodeZ('a', 'up')
    const byId = Object.fromEntries(useAppStore.getState().nodes.map(n => [n.id, n.z]))
    expect(byId).toEqual({ a: 1, b: 0 })
  })

  it('moveNodeZ is a no-op at the boundary (top node moving up, bottom node moving down)', () => {
    useAppStore.getState().addNode(waveformNode('a', 0))
    useAppStore.getState().addNode(textNode('b', 1))
    useAppStore.getState().moveNodeZ('b', 'up')
    useAppStore.getState().moveNodeZ('a', 'down')
    const byId = Object.fromEntries(useAppStore.getState().nodes.map(n => [n.id, n.z]))
    expect(byId).toEqual({ a: 0, b: 1 })
  })

  it('setSelectedNodeIds replaces the selection', () => {
    useAppStore.getState().setSelectedNodeIds(['x', 'y'])
    expect(useAppStore.getState().selectedNodeIds).toEqual(['x', 'y'])
  })
})
