import { useAppStore } from './store'
import StepExport from './components/StepExport'
import StartScreen from './features/start/StartScreen'
import { StudioLayout } from './features/studio/StudioLayout'
import { Toolbar } from './features/studio/Toolbar'
import { TransportBar } from './features/transport/TransportBar'
import { DesignPanel } from './features/design/DesignPanel'
import { CanvasStage } from './features/design/CanvasStage'
import { DesignInspector } from './features/design/DesignInspector'
import { CaptionsPanel } from './features/captions/CaptionsPanel'
import { CaptionsCanvas } from './features/captions/CaptionsCanvas'
import { ShortcutsHelpModal } from './app/ShortcutsHelpModal'

// UI_DESIGN_SPEC.md §2.2 — picking/dropping a file jumps straight into
// Studio Design, no intermediate confirmation step. Both entry points
// (app/actions.ts's openAudio/importAudioPath) set `screen`/`mode` directly
// in the same store update, so this component no longer needs a bridging
// effect to watch audioPath and flip the screen itself (that was P1-T11's
// temporary seam, removed here per PHASE2_TASKS.md T5 step 3).
export default function App() {
  const screen          = useAppStore(s => s.screen)
  const step            = useAppStore(s => s.step)
  const mode            = useAppStore(s => s.mode)
  const isTranscribing  = useAppStore(s => s.isTranscribing)

  // Design mode has a real 3-pane split (DesignPanel/CanvasStage/
  // DesignInspector, P2-T6/T7/T8). Captions mode now does too (CaptionsPanel/
  // CaptionsCanvas, P3-T6 — CaptionsInspector is P3-T8, undefined until
  // then). The export step still uses the pre-Phase-1 StepExport monolith,
  // which builds its own wide internal layout — StudioLayout expands
  // `children` across the inspector column too when leftPanel/inspector are
  // omitted (P2-T9).
  const isDesign = step !== 'export' && mode === 'design'
  const isCaptions = step !== 'export' && mode === 'captions'

  return (
    <>
      {isTranscribing && (
        <div className="loading-bar-track">
          <div className="loading-bar-fill" />
        </div>
      )}

      <ShortcutsHelpModal />

      {screen === 'start' ? (
        <StartScreen />
      ) : (
        <StudioLayout
          toolbar={<Toolbar />}
          transport={<TransportBar />}
          leftPanel={isDesign ? <DesignPanel /> : isCaptions ? <CaptionsPanel /> : undefined}
          inspector={isDesign ? <DesignInspector /> : undefined}
        >
          <div key={step === 'export' ? 'export' : mode} className="animate-mode-fade-slide h-full">
            {step === 'export' ? <StepExport /> : mode === 'design' ? <CanvasStage /> : <CaptionsCanvas />}
          </div>
        </StudioLayout>
      )}
    </>
  )
}
