import type { StateCreator } from 'zustand'
import type { RenderEvent, RenderStage } from '../core/ipc/renderEvent'
import type { CanvasSize } from '../types'
import type { AppStore } from './index'

export type RenderUiStage = 'idle' | RenderStage | 'done' | 'failed'

const ETA_WINDOW_MS = 10_000

export interface RenderSlice {
  fps: number
  canvasSize: CanvasSize
  logs: string[]
  isRendering: boolean
  lastOutput: string
  /** Legacy plain 0-100 number from the 'render_progress' event
   * (core/ipc/events.ts) — no UI reads this anymore since Toolbar.tsx
   * switched to `progressPct` (P3-T11) and StepExport.tsx (its last reader)
   * was deleted (P3-T13). Left in place rather than removed mid-cleanup;
   * safe to delete along with the 'render_progress' listener whenever
   * someone next touches this file. */
  progress: number
  /** T9 — structured render_event feed (TECH_ARCHITECTURE.md §2.3),
   * additive: not read by any Phase-1 component yet, for the Export sheet
   * (Phase 3) to use. */
  stage: RenderUiStage
  progressPct: number
  frame: number
  totalFrames: number
  etaSeconds: number | null
  onRenderEvent: (ev: RenderEvent) => void
  /** New in P3-T12 — the friendly AppError.message for Export Sheet State D
   * (never the raw exception, TECH_ARCHITECTURE §4.1); the technical detail
   * still only lives in `logs`, behind "Show details". Set by
   * features/export/useRenderExport.ts's catch block. */
  lastErrorMessage: string
}

export const createRenderSlice: StateCreator<AppStore, [], [], RenderSlice> = (set) => {
  // Rolling [timestampMs, pct] window, module-scoped to this one
  // createRenderSlice() call (i.e. one per store instance) rather than
  // reactive state — it's pure bookkeeping for the ETA estimate, nothing
  // ever needs to read the history itself.
  let pctHistory: [number, number][] = []

  function estimateEtaSeconds(pct: number): number | null {
    const now = Date.now()
    pctHistory.push([now, pct])
    pctHistory = pctHistory.filter(([t]) => now - t <= ETA_WINDOW_MS)
    const [t0, p0] = pctHistory[0]
    const dtSec = (now - t0) / 1000
    const dPct = pct - p0
    if (dtSec <= 0 || dPct <= 0) return null
    const pctPerSecond = dPct / dtSec
    return (100 - pct) / pctPerSecond
  }

  return {
    fps: 30,
    canvasSize: '1:1',
    logs: [],
    isRendering: false,
    lastOutput: '',
    lastErrorMessage: '',
    progress: 0,
    stage: 'idle',
    progressPct: 0,
    frame: 0,
    totalFrames: 0,
    etaSeconds: null,

    onRenderEvent: (ev) => {
      switch (ev.kind) {
        case 'stage':
          if (ev.stage === 'preparing') pctHistory = []
          set({ stage: ev.stage })
          break
        case 'progress':
          set({
            stage: 'frames',
            progressPct: ev.pct,
            frame: ev.frame,
            totalFrames: ev.total,
            etaSeconds: estimateEtaSeconds(ev.pct),
          })
          break
        case 'log':
          set(s => ({ logs: [...s.logs, ev.line] }))
          break
        case 'failed':
          set({ stage: 'failed', etaSeconds: null })
          break
        case 'done':
          set({ stage: 'done', progressPct: 100, etaSeconds: null })
          break
      }
    },
  }
}
