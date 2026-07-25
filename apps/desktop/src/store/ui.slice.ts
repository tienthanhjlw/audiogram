import type { StateCreator } from 'zustand'
import type { Step } from '../types'
import type { AppStore } from './index'

export type Mode = 'design' | 'captions'

const STEPS: Step[] = ['upload', 'layout', 'transcript', 'export']

export interface UiSlice {
  /** Legacy 4-step wizard position — the old Step components still read
   * this via goTo/next/back. New code should prefer `screen`/`mode`. */
  step: Step
  /** New in Phase 1 (T7) — which panel set Studio mode shows (T11). */
  mode: Mode
  /** Generic patch escape hatch, unchanged signature/behavior from the
   * pre-Phase-1 store (widened to the full new state shape so new code can
   * set the new fields too — every old call site's patch shape is still
   * valid, since AppState's old fields are a subset of AppStore's). */
  set: (patch: Partial<AppStore>) => void
  goTo: (step: Step) => void
  next: () => void
  back: () => void
}

export const createUiSlice: StateCreator<AppStore, [], [], UiSlice> = (set, get) => ({
  step: 'upload',
  mode: 'design',
  set: (patch) => set(patch),
  goTo: (step) => set({ step }),
  next: () => {
    const idx = STEPS.indexOf(get().step)
    if (idx < STEPS.length - 1) set({ step: STEPS[idx + 1] })
  },
  back: () => {
    const idx = STEPS.indexOf(get().step)
    if (idx > 0) set({ step: STEPS[idx - 1] })
  },
})
