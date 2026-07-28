import type { StateCreator } from 'zustand'
import { LAYOUT_TEMPLATES, type LayoutTemplate, type LayoutZones, type SceneNode, type WaveStyle } from '../types'
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
