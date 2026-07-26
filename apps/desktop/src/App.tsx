import { useAppStore } from './store'
import StepTranscript from './components/StepTranscript'
import StepExport from './components/StepExport'
import StartScreen from './features/start/StartScreen'
import { StudioLayout } from './features/studio/StudioLayout'
import { Toolbar } from './features/studio/Toolbar'
import { TransportBar } from './features/transport/TransportBar'
import { DesignPanel } from './features/design/DesignPanel'
import { CanvasStage } from './features/design/CanvasStage'
import { DesignInspector } from './features/design/DesignInspector'
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
  // DesignInspector, P2-T6/T7/T8). Captions mode and the export step still
  // use the pre-Phase-1 monolithic components, each of which builds its own
  // wide internal layout — StudioLayout expands `children` across the
  // inspector column too when leftPanel/inspector are omitted (P2-T9).
  const isDesign = step !== 'export' && mode === 'design'

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
          leftPanel={isDesign ? <DesignPanel /> : undefined}
          inspector={isDesign ? <DesignInspector /> : undefined}
        >
          <div key={step === 'export' ? 'export' : mode} className="animate-mode-fade-slide h-full">
            {step === 'export' ? <StepExport /> : mode === 'design' ? <CanvasStage /> : <StepTranscript />}
          </div>
        </StudioLayout>
      )}
    </>
  )
}
