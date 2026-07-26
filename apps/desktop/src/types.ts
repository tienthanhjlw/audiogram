export type Step = 'upload' | 'layout' | 'transcript' | 'export'
export type WaveStyle = 'bar' | 'line' | 'mirror' | 'dot' | 'neon' | 'orb' | 'pulse' | 'eq' | 'player'
export type CanvasSize = '16:9' | '1:1' | '9:16'
export type LayoutTemplate = 'spotify' | 'split' | 'minimal' | 'fullbg' | 'karaoke' | 'brand'

export interface LayoutTemplateDef {
  id: LayoutTemplate
  name: string
  desc: string
  tags: string[]
  needsAvatar: boolean
  defaultWaveColor: string
  defaultBgColor: string
  defaultWaveStyle: WaveStyle
  defaultKaraoke: boolean
}

export const LAYOUT_TEMPLATES: LayoutTemplateDef[] = [
  { id: 'spotify',  name: 'Podcast',    desc: 'Avatar center · wave below',     tags: ['1:1','9:16'],       needsAvatar: true,  defaultWaveColor: '#6C4FF6', defaultBgColor: '#0F0A1E', defaultWaveStyle: 'bar',    defaultKaraoke: false },
  { id: 'split',    name: 'Split',      desc: 'Image left · wave right',         tags: ['16:9','1:1'],       needsAvatar: true,  defaultWaveColor: '#06B6D4', defaultBgColor: '#0A1628', defaultWaveStyle: 'bar',    defaultKaraoke: false },
  { id: 'minimal',  name: 'Minimal',    desc: 'Wave is the main character',      tags: ['all'],              needsAvatar: false, defaultWaveColor: '#FFFFFF', defaultBgColor: '#111827', defaultWaveStyle: 'bar',    defaultKaraoke: false },
  { id: 'fullbg',   name: 'Full Cover', desc: 'Full image bg · overlay on top',  tags: ['9:16','1:1'],       needsAvatar: true,  defaultWaveColor: '#EC4FC4', defaultBgColor: '#1A0A2E', defaultWaveStyle: 'bar',    defaultKaraoke: false },
  { id: 'karaoke',  name: 'Karaoke',    desc: 'Large text center · wave below',  tags: ['1:1','9:16'],       needsAvatar: false, defaultWaveColor: '#FFD60A', defaultBgColor: '#0A0A14', defaultWaveStyle: 'bar',    defaultKaraoke: true  },
  { id: 'brand',    name: 'Brand',      desc: 'Logo left · visualizer right',    tags: ['16:9'],             needsAvatar: true,  defaultWaveColor: '#6C4FF6', defaultBgColor: '#0A1628', defaultWaveStyle: 'mirror', defaultKaraoke: false },
]

// ─── Layout zones ─────────────────────────────────────────────────────────────
// All values are fractions of canvas width/height (0–1)

export interface LayoutZone {
  x: number   // left edge
  y: number   // top edge
  w: number   // width
  h: number   // height
}

export interface LayoutZones {
  waveform:  LayoutZone
  title:     LayoutZone
  avatar?:   LayoutZone
  subtitle?: LayoutZone
}

// Default zones match the hardcoded positions in each draw function exactly.
// These values ensure the overlay boxes align with canvas content by default.
// Sourced from contract/zones.json via @audiogram/contract (T14/T17) —
// re-exported here so every existing `import { DEFAULT_ZONES } from
// '../types'` call site keeps working unchanged.
export { DEFAULT_ZONES } from '@audiogram/contract'

export interface AppState {
  step: Step
  audioPath: string
  audioName: string
  title: string
  canvasSize: CanvasSize
  layoutTemplate: LayoutTemplate
  coverImagePath: string
  waveStyle: WaveStyle
  waveColor: string
  bgColor: string
  fps: number
  logs: string[]
  isRendering: boolean
  lastOutput: string
  // Whisper
  segments: Segment[]
  srtPath: string
  isTranscribing: boolean
  showSubtitles: boolean
  whisperModel: string
  peaks: number[]
  fontSize: number         // percentage multiplier, 70–140, default 100
  fontName: string         // "Arial" | "Georgia" | "Impact" | "Verdana"
  karaokeEnabled: boolean
  karaokeColor: string
  subtitleColor: string
  subtitleYPct: number | null   // 0–1 fraction from top; null = layout default
  zones: LayoutZones | null     // null = use DEFAULT_ZONES[layoutTemplate]
  titleColor:  string
  titleAlign:  'left' | 'center' | 'right'
  titleBold:   boolean
  titleItalic: boolean
}

export const CANVAS_SIZES: Record<CanvasSize, { w: number; h: number; label: string }> = {
  '16:9': { w: 1280, h: 720,  label: '16:9  YouTube' },
  '1:1':  { w: 1080, h: 1080, label: '1:1   Instagram' },
  '9:16': { w: 1080, h: 1920, label: '9:16  Reels' },
}

export const WAVE_COLORS = [
  { hex: '#6C4FF6', name: 'Purple' },
  { hex: '#EC4FC4', name: 'Pink' },
  { hex: '#06B6D4', name: 'Cyan' },
  { hex: '#22C55E', name: 'Green' },
  { hex: '#F59E0B', name: 'Amber' },
  { hex: '#EF4444', name: 'Red' },
  { hex: '#FFFFFF', name: 'White' },
]

export const BG_COLORS = [
  { hex: '#0F0A1E', name: 'Deep Purple' },
  { hex: '#0A1628', name: 'Navy' },
  { hex: '#0A1A0F', name: 'Forest' },
  { hex: '#1A0A0A', name: 'Crimson' },
  { hex: '#111827', name: 'Dark' },
  { hex: '#1E1E2E', name: 'Catppuccin' },
]

// Wave styles are defined per-effect in @audiogram/wave-effects (T17). The UI
// list is derived from that package's effect registry (single source of
// truth) — re-exported here, narrowed back to WaveStyle (the package itself
// only knows `id: string`, since it can't depend on this file's types), so
// existing `import { WAVE_STYLES } from '../types'` call sites keep working
// with the same shape as before.
import { WAVE_STYLES as WAVE_STYLES_UNTYPED } from '@audiogram/wave-effects'
export const WAVE_STYLES = WAVE_STYLES_UNTYPED as { id: WaveStyle; label: string; desc: string }[]

// ─── Whisper Transcription ────────────────────────────────
export interface ModelInfo {
  name: string
  label: string
  size_mb: number
  note: string
  downloaded: boolean
}

export interface Segment {
  id: number
  start: number   // seconds
  end: number     // seconds
  text: string
}
