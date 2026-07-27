import type { StateCreator } from 'zustand'
import type { Step } from '../types'
import type { AppStore } from './index'

export type Mode = 'design' | 'captions'

/** Which canvas element the Design mode inspector shows (UI_DESIGN_SPEC.md
 * §4.3) — null means the global Canvas section. Lives in ui.slice (not a
 * local component state) per PHASE2_TASKS.md's front-matter decision table:
 * the canvas stage (P2-T7), design panel (P2-T6), and inspector (P2-T8) are
 * sibling features and none may import another directly, so the store is
 * the only shared channel between them. */
export type SelectedEl = 'wave' | 'title' | 'subtitle' | 'avatar' | null

/** Export Sheet's 4 sequential states (UI_DESIGN_SPEC.md §7) — 'closed'
 * means the sheet isn't rendered at all. TECH_ARCHITECTURE.md §2.2 calls
 * this `exportSheetState`; kept as `exportSheet` to match the feature
 * folder/component name. Not persisted (SessionRepository, P2-T4) — an
 * export in flight doesn't survive an app restart, and reopening one
 * mid-render would have nothing to reconnect to. */
export type ExportSheetState = 'closed' | 'settings' | 'rendering' | 'success' | 'error'

const STEPS: Step[] = ['upload', 'layout', 'transcript', 'export']

export interface UiSlice {
  /** Legacy 4-step wizard position — the old Step components still read
   * this via goTo/next/back. New code should prefer `screen`/`mode`. */
  step: Step
  /** New in Phase 1 (T7) — which panel set Studio mode shows (T11). */
  mode: Mode
  selectedEl: SelectedEl
  selectEl: (el: SelectedEl) => void
  /** New in P3-T7 — which row SegmentList shows as selected (click once =
   * select, click/Enter again = edit). Lives in ui.slice per the same
   * cross-feature-channel rule as `selectedEl`: P3-T9's transport segment
   * blocks read this too, to stay in sync with the list. */
  selectedSegmentId: number | null
  selectSegment: (id: number | null) => void
  /** New in P3-T9 — bumped by the transport bar's now-playing chip so
   * SegmentList force-scrolls to the active row even if the playhead has
   * been inside the same segment the whole time (its own auto-scroll only
   * fires when the active segment *changes*, so a manually-scrolled-away
   * list wouldn't otherwise snap back). An incrementing counter rather than
   * a boolean so two clicks in a row (no segment change in between) both
   * still trigger a scroll. */
  scrollToActiveSegmentRequest: number
  requestScrollToActiveSegment: () => void
  /** New in P3-T10 — Export Sheet visibility/state, opened by
   * app/actions.ts's exportProject (⌘E, toolbar button, menu) instead of
   * the legacy `goTo('export')`. */
  exportSheet: ExportSheetState
  setExportSheet: (state: ExportSheetState) => void
  /** New in P3-T11 — minimize (UI_DESIGN_SPEC.md §7.2): clicking the sheet's
   * overlay backdrop while a render is in flight hides the sheet (this
   * flips true) without touching `exportSheet` itself, so the render
   * pipeline and its `stage`/`progressPct` keep running untouched. The
   * toolbar's progress chip (Toolbar.tsx) flips it back via
   * app/actions.ts's exportProject. Reset to false by setExportSheet so a
   * fresh 'settings'/'closed' transition never inherits a stale minimize. */
  exportSheetMinimized: boolean
  setExportSheetMinimized: (minimized: boolean) => void
  /** New in T13 — set by the Help > Keyboard Shortcuts native menu item
   * (app/actions.ts's openShortcutsHelp), read by ShortcutsHelpModal.tsx. */
  shortcutsHelpOpen: boolean
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
  selectedEl: null,
  selectEl: (el) => set({ selectedEl: el }),
  selectedSegmentId: null,
  selectSegment: (id) => set({ selectedSegmentId: id }),
  scrollToActiveSegmentRequest: 0,
  requestScrollToActiveSegment: () => set(s => ({ scrollToActiveSegmentRequest: s.scrollToActiveSegmentRequest + 1 })),
  exportSheet: 'closed',
  setExportSheet: (state) => set({ exportSheet: state, exportSheetMinimized: false }),
  exportSheetMinimized: false,
  setExportSheetMinimized: (minimized) => set({ exportSheetMinimized: minimized }),
  shortcutsHelpOpen: false,
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
