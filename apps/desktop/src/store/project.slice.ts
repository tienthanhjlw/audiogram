import type { StateCreator } from 'zustand'
import type { AppStore } from './index'

export type Screen = 'start' | 'studio'

export interface ProjectSlice {
  audioPath: string
  audioName: string
  title: string
  /** New in Phase 1 (T7) — replaces the old 4-step wizard's implicit
   * "which screen" state. UI_REBUILD_PLAN.md §2.1. */
  screen: Screen
}

const DEFAULT_AUDIO_PATH = ''

export const createProjectSlice: StateCreator<AppStore, [], [], ProjectSlice> = () => ({
  audioPath: DEFAULT_AUDIO_PATH,
  audioName: '',
  title: '',
  screen: DEFAULT_AUDIO_PATH ? 'studio' : 'start',
})
