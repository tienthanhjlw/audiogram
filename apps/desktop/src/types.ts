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
export const DEFAULT_ZONES: Record<LayoutTemplate, LayoutZones> = {
  minimal: {
    title:    { x: 0.08, y: 0.05, w: 0.84, h: 0.16 },
    waveform: { x: 0.02, y: 0.30, w: 0.96, h: 0.36 },
    subtitle: { x: 0.04, y: 0.74, w: 0.92, h: 0.10 },
  },
  spotify: {
    avatar:   { x: 0.32, y: 0.08, w: 0.36, h: 0.36 },
    title:    { x: 0.10, y: 0.44, w: 0.80, h: 0.12 },
    waveform: { x: 0.04, y: 0.60, w: 0.92, h: 0.22 },
    subtitle: { x: 0.04, y: 0.85, w: 0.92, h: 0.10 },
  },
  split: {
    avatar:   { x: 0.00, y: 0.00, w: 0.50, h: 1.00 },
    title:    { x: 0.55, y: 0.14, w: 0.40, h: 0.16 },
    waveform: { x: 0.55, y: 0.42, w: 0.41, h: 0.30 },
    subtitle: { x: 0.55, y: 0.80, w: 0.41, h: 0.10 },
  },
  fullbg: {
    avatar:   { x: 0.35, y: 0.07, w: 0.30, h: 0.30 },
    title:    { x: 0.10, y: 0.36, w: 0.80, h: 0.12 },
    waveform: { x: 0.04, y: 0.60, w: 0.92, h: 0.20 },
    subtitle: { x: 0.04, y: 0.83, w: 0.92, h: 0.10 },
  },
  karaoke: {
    title:    { x: 0.06, y: 0.22, w: 0.88, h: 0.56 },
    waveform: { x: 0.04, y: 0.78, w: 0.92, h: 0.10 },
  },
  brand: {
    avatar:   { x: 0.04, y: 0.36, w: 0.16, h: 0.28 },
    title:    { x: 0.24, y: 0.36, w: 0.32, h: 0.28 },
    waveform: { x: 0.55, y: 0.12, w: 0.42, h: 0.76 },
  },
}

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

// Wave styles are now defined per-effect in `src/waves/`. The UI list is derived
// from the effect registry (single source of truth) and re-exported here so
// existing `import { WAVE_STYLES } from '../types'` call sites keep working.
export { WAVE_STYLES } from './waves/registry'

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
