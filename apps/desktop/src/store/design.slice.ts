import type { StateCreator } from 'zustand'
import { LAYOUT_TEMPLATES, type LayoutTemplate, type LayoutZones, type WaveStyle } from '../types'
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
