import { useAppStore } from './store'
import StepLayout from './components/StepLayout'
import StepTranscript from './components/StepTranscript'
import StepExport from './components/StepExport'
import StartScreen from './features/start/StartScreen'
import { StudioLayout } from './features/studio/StudioLayout'
import { Toolbar } from './features/studio/Toolbar'
import { TransportBar } from './features/transport/TransportBar'
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
        <StudioLayout toolbar={<Toolbar />} transport={<TransportBar />}>
          <div key={step === 'export' ? 'export' : mode} className="animate-mode-fade-slide h-full">
            {step === 'export' ? <StepExport /> : mode === 'design' ? <StepLayout /> : <StepTranscript />}
          </div>
        </StudioLayout>
      )}
    </>
  )
}
