export type Step = 'upload' | 'customize' | 'transcript' | 'export'
export type WaveStyle = 'bar' | 'line' | 'mirror'
export type CanvasSize = '16:9' | '1:1' | '9:16'

export interface AppState {
  step: Step
  audioPath: string
  audioName: string
  title: string
  canvasSize: CanvasSize
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
  peaks: number[]
  fontSize: number      // percentage multiplier, 70–140, default 100
  fontName: string      // "Arial" | "Georgia" | "Impact" | "Verdana"
  karaokeEnabled: boolean
  karaokeColor: string  // hex highlight color
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

export const WAVE_STYLES: { id: WaveStyle; label: string; desc: string }[] = [
  { id: 'bar',    label: 'Bars',   desc: 'Vertical bars' },
  { id: 'line',   label: 'Wave',   desc: 'Smooth curve' },
  { id: 'mirror', label: 'Mirror', desc: 'Symmetric' },
]

// ─── Whisper Transcription ────────────────────────────────
export interface Segment {
  id: number
  start: number   // seconds
  end: number     // seconds
  text: string
}
