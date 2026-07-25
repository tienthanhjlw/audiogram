import { create } from 'zustand'
import { createProjectSlice, type ProjectSlice } from './project.slice'
import { createDesignSlice, type DesignSlice } from './design.slice'
import { createCaptionsSlice, type CaptionsSlice } from './captions.slice'
import { createPlaybackSlice, type PlaybackSlice } from './playback.slice'
import { createRenderSlice, type RenderSlice } from './render.slice'
import { createUiSlice, type UiSlice } from './ui.slice'

// The composed store is intentionally flat — TECH_ARCHITECTURE.md §2.5:
// slices are a file-organization device only. The 4 legacy Step components
// (and anything imported from '../store' going forward) see one plain
// object with every field at the top level, exactly like the pre-Phase-1
// store, plus the new fields listed in PHASE1_TASKS.md T7 (screen, mode,
// playing, currentTime, duration — the last three wired up for real by
// T10's AudioEngine).
export type AppStore =
  & ProjectSlice
  & DesignSlice
  & CaptionsSlice
  & PlaybackSlice
  & RenderSlice
  & UiSlice

export const useAppStore = create<AppStore>()((...a) => ({
  ...createProjectSlice(...a),
  ...createDesignSlice(...a),
  ...createCaptionsSlice(...a),
  ...createPlaybackSlice(...a),
  ...createRenderSlice(...a),
  ...createUiSlice(...a),
}))

export type { ProjectSlice, Screen } from './project.slice'
export type { DesignSlice } from './design.slice'
export type { CaptionsSlice } from './captions.slice'
export type { PlaybackSlice } from './playback.slice'
export type { RenderSlice } from './render.slice'
export type { UiSlice, Mode } from './ui.slice'
