import type { StateCreator } from 'zustand'
import type { CanvasSize } from '../types'
import type { AppStore } from './index'

// T9 adds render-event fields (stage, progressPct, frame, totalFrames,
// etaSeconds, onRenderEvent) on top of this — kept minimal here to match
// what the pre-Phase-1 store already had.
export interface RenderSlice {
  fps: number
  canvasSize: CanvasSize
  logs: string[]
  isRendering: boolean
  lastOutput: string
}

export const createRenderSlice: StateCreator<AppStore, [], [], RenderSlice> = () => ({
  fps: 30,
  canvasSize: '1:1',
  logs: [],
  isRendering: false,
  lastOutput: '',
})
