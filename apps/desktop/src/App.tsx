import { useAppStore } from './store'
import StartScreen from './features/start/StartScreen'
import { StudioLayout } from './features/studio/StudioLayout'
import { Toolbar } from './features/studio/Toolbar'
import { TransportBar } from './features/transport/TransportBar'
import { DesignPanel } from './features/design/DesignPanel'
import { CanvasStage } from './features/design/CanvasStage'
import { DesignInspector } from './features/design/DesignInspector'
import { CaptionsPanel } from './features/captions/CaptionsPanel'
import { CaptionsCanvas } from './features/captions/CaptionsCanvas'
import { CaptionsInspector } from './features/captions/CaptionsInspector'
import { ExportSheet } from './features/export/ExportSheet'
import { CloseGuardDialog } from './features/export/CloseGuardDialog'
import { ShortcutsHelpModal } from './app/ShortcutsHelpModal'

// UI_DESIGN_SPEC.md §2.2 — picking/dropping a file jumps straight into
// Studio Design, no intermediate confirmation step. Both entry points
// (app/actions.ts's openAudio/importAudioPath) set `screen`/`mode` directly
// in the same store update, so this component no longer needs a bridging
// effect to watch audioPath and flip the screen itself (that was P1-T11's
// temporary seam, removed here per PHASE2_TASKS.md T5 step 3).
export default function App() {
  const screen          = useAppStore(s => s.screen)
  const mode            = useAppStore(s => s.mode)
  const isTranscribing  = useAppStore(s => s.isTranscribing)

  // Design mode has a real 3-pane split (DesignPanel/CanvasStage/
  // DesignInspector, P2-T6/T7/T8). Captions mode now does too (CaptionsPanel/
  // CaptionsCanvas/CaptionsInspector, P3-T6/T8). Export is no longer a wizard
  // step (`goTo('export')`) — P3-T10's ExportSheet opens as an overlay on
  // top of whichever mode is showing, driven by `ui.slice`'s `exportSheet`
  // instead of `step`.
  const isDesign = mode === 'design'
  const isCaptions = mode === 'captions'

  return (
    <>
      {isTranscribing && (
        <div className="loading-bar-track">
          <div className="loading-bar-fill" />
        </div>
      )}

      <ShortcutsHelpModal />
      <ExportSheet />
      <CloseGuardDialog />

      {screen === 'start' ? (
        <StartScreen />
      ) : (
        <StudioLayout
          toolbar={<Toolbar />}
          transport={<TransportBar />}
          leftPanel={isDesign ? <DesignPanel /> : isCaptions ? <CaptionsPanel /> : undefined}
          inspector={isDesign ? <DesignInspector /> : isCaptions ? <CaptionsInspector /> : undefined}
        >
          <div key={mode} className="animate-mode-fade-slide h-full">
            {mode === 'design' ? <CanvasStage /> : <CaptionsCanvas />}
          </div>
        </StudioLayout>
      )}
    </>
  )
}
