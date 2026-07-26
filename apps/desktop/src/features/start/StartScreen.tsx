import { DropZone } from './DropZone'
import { RecentGrid } from './RecentGrid'

// screens/StartScreen.tsx — UI_DESIGN_SPEC.md §2 (real drop-zone/recents
// design, replacing P1-T11's temporary StepUpload wrapper). No settings, no
// canvas size, no hero marketing (UI_REBUILD_PLAN.md §2.1) — just the drop
// target and, once there's at least one, the Recents grid.
export default function StartScreen() {
  return (
    <div className="flex h-screen flex-col bg-bg-app">
      {/* Drag strip — UI_DESIGN_SPEC.md §2.1: transparent, small centered
       * logo text, keeps the window movable before a toolbar exists. */}
      <div data-tauri-drag-region className="flex h-12 flex-shrink-0 items-center justify-center">
        <span className="select-none text-[13px] text-text-2">≈ Audiogram</span>
      </div>
      <div className="flex flex-1 flex-col items-center gap-10 overflow-auto px-6 pb-12 pt-2">
        <DropZone />
        <RecentGrid />
      </div>
    </div>
  )
}
