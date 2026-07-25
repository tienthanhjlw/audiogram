import type { StateCreator } from 'zustand'
import type { CanvasSize } from '../types'
import type { AppStore } from './index'

// T9 replaces `progress` with the richer stage/progressPct/frame/
// totalFrames/etaSeconds shape (structured RenderEvent) — kept as a plain
// 0-100 number here since that's exactly what the pre-Phase-1
// `render_progress` event payload already was (StepExport.tsx's local
// `progress` useState, now centralized via core/ipc/events.ts instead).
export interface RenderSlice {
  fps: number
  canvasSize: CanvasSize
  logs: string[]
  isRendering: boolean
  lastOutput: string
  progress: number
}

export const createRenderSlice: StateCreator<AppStore, [], [], RenderSlice> = () => ({
  fps: 30,
  canvasSize: '1:1',
  logs: [],
  isRendering: false,
  lastOutput: '',
  progress: 0,
})
