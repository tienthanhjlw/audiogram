import type { StateCreator } from 'zustand'
import {
  LAYOUT_TEMPLATES,
  type AnimationClip, type LayoutTemplate, type LayoutZones, type SceneNode, type SceneNodeProps,
  type Timing, type Transform, type WaveStyle,
} from '../types'
import type { AppStore } from './index'

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
