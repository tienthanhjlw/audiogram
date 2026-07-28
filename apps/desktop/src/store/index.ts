import { create } from 'zustand'
import { temporal, type ZundoOptions } from 'zundo'
import { shallow } from 'zustand/shallow'
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

// Undo/redo scope (P4-T9, UI_REBUILD_PLAN.md §5/21, TECH_ARCHITECTURE.md
// §2.5) — Design mode edits + caption text edits only. Deliberately
// excludes: project identity (audioPath/title — opening a different file
// isn't an "edit" to undo), playback/render state (transient/derived,
// undoing `isRendering` mid-export would be actively wrong), and UI-only
// state (selectedEl, exportSheet, etc.).
function partializeTemporal(state: AppStore) {
  return {
    layoutTemplate: state.layoutTemplate,
    waveStyle: state.waveStyle,
    waveColor: state.waveColor,
    bgColor: state.bgColor,
    coverImagePath: state.coverImagePath,
    zones: state.zones,
    titleColor: state.titleColor,
    titleAlign: state.titleAlign,
    titleBold: state.titleBold,
    titleItalic: state.titleItalic,
    fontSize: state.fontSize,
    fontName: state.fontName,
    segments: state.segments,
    showSubtitles: state.showSubtitles,
    karaokeEnabled: state.karaokeEnabled,
    karaokeColor: state.karaokeColor,
    subtitleColor: state.subtitleColor,
    subtitleYPct: state.subtitleYPct,
  }
}

type UndoableState = ReturnType<typeof partializeTemporal>

const HISTORY_DEBOUNCE_MS = 400

/** Collapses a burst of rapid-fire `set()` calls (a slider/Rnd drag fires
 * one per pixel via React's onChange-on-'input' quirk) into one history
 * entry — remembers the state from *before* the first call in the burst,
 * and only actually records it once the burst goes quiet. A single
 * discrete commit (SegmentList's edit-commit, a zone's onDragStop) is
 * already just one call, so it round-trips through this unchanged, just
 * delayed by one debounce window. */
function debouncedHandleSet(
  handleSet: (pastState: UndoableState, replace?: boolean) => void,
): (pastState: UndoableState, replace?: boolean) => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  let burstStart: UndoableState | null = null

  return (pastState, replace) => {
    if (timer === null) burstStart = pastState
    else clearTimeout(timer)
    timer = setTimeout(() => {
      handleSet(burstStart!, replace)
      timer = null
      burstStart = null
    }, HISTORY_DEBOUNCE_MS)
  }
}

export const useAppStore = create<AppStore>()(
  temporal<AppStore, [], [], UndoableState>(
    (...a) => ({
      ...createProjectSlice(...a),
      ...createDesignSlice(...a),
      ...createCaptionsSlice(...a),
      ...createPlaybackSlice(...a),
      ...createRenderSlice(...a),
      ...createUiSlice(...a),
    }),
    {
      partialize: partializeTemporal,
      equality: shallow,
      // zundo@2.3.0's .d.ts types this callback's `pastState`/`replace`
      // against the full store's setState (StoreApi<AppStore>) instead of
      // the partialized UndoableState it's actually invoked with at
      // runtime (verified against zundo/dist/index.js: `pastState` is
      // always `options.partialize(get())`) — cast around that mismatch
      // rather than fight it with `any` on the whole options object.
      handleSet: debouncedHandleSet as unknown as NonNullable<ZundoOptions<AppStore, UndoableState>['handleSet']>,
      limit: 100,
    },
  ),
)

export type { ProjectSlice, Screen } from './project.slice'
export type { DesignSlice } from './design.slice'
export type { CaptionsSlice } from './captions.slice'
export type { PlaybackSlice } from './playback.slice'
export type { RenderSlice } from './render.slice'
export type { UiSlice, Mode, SelectedEl } from './ui.slice'
