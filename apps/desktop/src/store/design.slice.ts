import type { StateCreator } from 'zustand'
import {
  LAYOUT_TEMPLATES,
  type AnimationClip, type LayoutTemplate, type LayoutZones, type SceneNode, type SceneNodeProps,
  type Timing, type Transform, type WaveStyle,
} from '../types'
import { indexById, groupDepth, MAX_GROUP_DEPTH, staticWorldTransform } from '../domain/scene/group'
import { compose, decompose } from '../domain/scene/transform'
import type { AppStore } from './index'

let nextGroupId = 0
function makeGroupId(): string {
  nextGroupId += 1
  return `group-${Date.now()}-${nextGroupId}`
}

export interface DesignSlice {
  layoutTemplate: LayoutTemplate
  waveStyle: WaveStyle
  waveColor: string
  bgColor: string
  coverImagePath: string
  zones: LayoutZones | null
  titleColor: string
  titleAlign: 'left' | 'center' | 'right'
  titleBold: boolean
  titleItalic: boolean
  fontSize: number
  fontName: string
  /** Scene graph (Phase 5 T6) — coexists with the fields above (the legacy
   * render path reads those directly; T18 removes them once the node
   * renderer is the only one left). Backfilled from legacy fields on
   * session load by core/persistence/migrations.ts's `migrate()` when a
   * saved session predates this field (domain/scene/fromLegacy.ts). */
  nodes: SceneNode[]
  /** Multi-select is an array up front (not a single id) — T10's group/
   * ungroup needs multi-select from day one, no later refactor. Not part of
   * undo history, same as the legacy `selectedEl` (store/ui.slice.ts). */
  selectedNodeIds: string[]
  /** Appends a node (Layers panel's "+ Text"/"+ Image"/"+ Sticker", P5-T7)
   * and selects it, so the Inspector immediately shows it. */
  addNode: (node: SceneNode) => void
  removeNode: (id: string) => void
  /** Shallow-merges `patch` into the node's `transform`. */
  updateNodeTransform: (id: string, patch: Partial<Transform>) => void
  /** Shallow-merges `patch` into the node's `props` — callers pass only the
   * changed fields; `type` is preserved from the existing props (a node's
   * props variant never changes after creation). No-op for a node with no
   * `props` (group nodes). */
  updateNodeProps: (id: string, patch: Partial<SceneNodeProps>) => void
  /** Swaps `z` with the next node up/down in z-order (Layers panel's
   * reorder buttons — P5-T7 ships buttons before drag-reorder). */
  moveNodeZ: (id: string, direction: 'up' | 'down') => void
  setSelectedNodeIds: (ids: string[]) => void
  /** Sets or clears the node's `timing` window (P5-T8). `undefined` = always
   * visible (removes the constraint entirely, not a zero-length window). */
  updateNodeTiming: (id: string, timing: Timing | undefined) => void
  /** Sets or clears the node's `animIn`/`animOut` clip. */
  updateNodeAnim: (id: string, which: 'animIn' | 'animOut', clip: AnimationClip | undefined) => void
  /** ⌘G — wraps 2+ nodes (must share the same parent; v1 doesn't support
   * grouping across different parents) in a new `type:'group'` node sized
   * to their bounding box, reparenting them under it. No-op (returns
   * unchanged state) if fewer than 2 ids are given, they don't share a
   * parent, or grouping would exceed MAX_GROUP_DEPTH (3 levels, T10 step 7). */
  groupNodes: (ids: string[]) => void
  /** ⇧⌘G — dissolves a group, reparenting its children under the group's
   * own parent (root if the group was root-level) with their `transform`
   * recomputed so their absolute on-canvas position is unchanged
   * (domain/scene/transform.ts's compose/decompose — T10 step 5's
   * round-trip guarantee). Selects the freed children. No-op for a
   * non-group id or a group with no children. */
  ungroupNode: (groupId: string) => void
  /** Applies a template's defaults (wave style/color, bg color, karaoke) and
   * resets zones — originally StepLayout.tsx's local `handleTemplateChange`
   * (P1-T7 moved it here so the Design mode template gallery could call it
   * without going through that component; P2-T12 deleted StepLayout.tsx
   * itself, once DesignPanel.tsx became the only caller). */
  applyTemplate: (id: LayoutTemplate) => void
}

export const createDesignSlice: StateCreator<AppStore, [], [], DesignSlice> = (set) => ({
  layoutTemplate: 'minimal',
  waveStyle: 'bar',
  waveColor: '#FFFFFF',
  bgColor: '#111827',
  coverImagePath: '',
  zones: null,
  titleColor: '#FFFFFF',
  titleAlign: 'center',
  titleBold: false,
  titleItalic: false,
  fontSize: 100,
  fontName: 'Arial',
  nodes: [],
  selectedNodeIds: [],
  addNode: (node) => set(s => ({ nodes: [...s.nodes, node], selectedNodeIds: [node.id] })),
  removeNode: (id) => set(s => ({
    nodes: s.nodes.filter(n => n.id !== id),
    selectedNodeIds: s.selectedNodeIds.filter(sid => sid !== id),
  })),
  updateNodeTransform: (id, patch) => set(s => ({
    nodes: s.nodes.map(n => n.id === id ? { ...n, transform: { ...n.transform, ...patch } } : n),
  })),
  updateNodeProps: (id, patch) => set(s => ({
    nodes: s.nodes.map(n => n.id === id && n.props ? { ...n, props: { ...n.props, ...patch } as SceneNodeProps } : n),
  })),
  moveNodeZ: (id, direction) => set(s => {
    const sorted = [...s.nodes].sort((a, b) => a.z - b.z)
    const idx = sorted.findIndex(n => n.id === id)
    const swapIdx = direction === 'up' ? idx + 1 : idx - 1
    if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return {}
    const a = sorted[idx], b = sorted[swapIdx]
    const [za, zb] = [a.z, b.z]
    return {
      nodes: s.nodes.map(n => n.id === a.id ? { ...n, z: zb } : n.id === b.id ? { ...n, z: za } : n),
    }
  }),
  setSelectedNodeIds: (ids) => set({ selectedNodeIds: ids }),
  updateNodeTiming: (id, timing) => set(s => ({
    nodes: s.nodes.map(n => n.id === id ? { ...n, timing } : n),
  })),
  updateNodeAnim: (id, which, clip) => set(s => ({
    nodes: s.nodes.map(n => n.id === id ? { ...n, [which]: clip } : n),
  })),
  groupNodes: (ids) => set(s => {
    const nodesById = indexById(s.nodes)
    const selected = ids.map(id => nodesById.get(id)).filter((n): n is SceneNode => !!n)
    if (selected.length < 2) return {}
    const parentId = selected[0].parentId
    if (!selected.every(n => n.parentId === parentId)) return {}
    const parentDepth = parentId ? groupDepth(selected[0], nodesById) : 0
    if (parentDepth >= MAX_GROUP_DEPTH) return {}

    const worlds = selected.map(n => staticWorldTransform(n, nodesById))
    const minX = Math.min(...worlds.map(w => w.x))
    const minY = Math.min(...worlds.map(w => w.y))
    const maxX = Math.max(...worlds.map(w => w.x + w.w))
    const maxY = Math.max(...worlds.map(w => w.y + w.h))
    const bboxWorld: Transform = { x: minX, y: minY, w: maxX - minX, h: maxY - minY, rotation: 0, opacity: 1 }

    const parentWorld = parentId ? staticWorldTransform(nodesById.get(parentId)!, nodesById) : null
    const groupLocal = parentWorld ? decompose(parentWorld, bboxWorld) : bboxWorld

    const groupId = makeGroupId()
    const maxZ = s.nodes.reduce((m, n) => Math.max(m, n.z), 0)
    const groupNode: SceneNode = { id: groupId, type: 'group', parentId, transform: groupLocal, z: maxZ + 1 }

    const selectedIds = new Set(ids)
    const nodes = s.nodes.map(n => {
      if (!selectedIds.has(n.id)) return n
      const local = decompose(bboxWorld, staticWorldTransform(n, nodesById))
      return { ...n, parentId: groupId, transform: local }
    })

    return { nodes: [...nodes, groupNode], selectedNodeIds: [groupId] }
  }),
  ungroupNode: (groupId) => set(s => {
    const nodesById = indexById(s.nodes)
    const group = nodesById.get(groupId)
    if (!group || group.type !== 'group') return {}
    const groupWorld = staticWorldTransform(group, nodesById)
    const newParentId = group.parentId
    const newParentWorld = newParentId ? staticWorldTransform(nodesById.get(newParentId)!, nodesById) : null

    const childIds = s.nodes.filter(n => n.parentId === groupId).map(n => n.id)
    const nodes = s.nodes
      .filter(n => n.id !== groupId)
      .map(n => {
        if (n.parentId !== groupId) return n
        const childWorld = compose(groupWorld, n.transform)
        const newLocal = newParentWorld ? decompose(newParentWorld, childWorld) : childWorld
        return { ...n, parentId: newParentId, transform: newLocal }
      })

    return { nodes, selectedNodeIds: childIds }
  }),
  applyTemplate: (id) => {
    const tDef = LAYOUT_TEMPLATES.find(t => t.id === id)!
    set({
      layoutTemplate: id,
      zones: null,
      waveColor: tDef.defaultWaveColor,
      bgColor: tDef.defaultBgColor,
      waveStyle: tDef.defaultWaveStyle,
      karaokeEnabled: tDef.defaultKaraoke,
    })
  },
})
