import StepUpload from '../../components/StepUpload'

// screens/StartScreen.tsx — TEMPORARY per PHASE1_TASKS.md T11: the real
// drop-zone/recents design (UI_DESIGN_SPEC.md §2) is Phase 2. This just
// centers the legacy StepUpload on the new dark shell so screen==='start'
// isn't rendering the old light-mode top bar. App.tsx watches audioPath and
// flips to screen:'studio' the instant it's set (§2.2's "no confirmation
// step in between"), so StepUpload's own file-info-card/title-input/Next
// button are only visible for the one render before that effect fires.
export default function StartScreen() {
  return (
    <div className="flex h-screen flex-col bg-bg-app">
      {/* Minimal drag strip (UI_DESIGN_SPEC.md §2.1) so the window stays
       * movable before a toolbar exists — the real content below isn't a
       * drag region. */}
      <div data-tauri-drag-region className="h-12 flex-shrink-0" />
      <div className="flex flex-1 items-center justify-center overflow-auto px-6 pb-12">
        <div className="w-full max-w-[640px]">
          <StepUpload />
        </div>
      </div>
    </div>
  )
}
