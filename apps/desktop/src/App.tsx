import { useEffect } from 'react'
import { useAppStore } from './store'
import StepLayout from './components/StepLayout'
import StepTranscript from './components/StepTranscript'
import StepExport from './components/StepExport'
import StartScreen from './features/start/StartScreen'
import { StudioLayout } from './features/studio/StudioLayout'
import { Toolbar } from './features/studio/Toolbar'

export default function App() {
  const screen          = useAppStore(s => s.screen)
  const step            = useAppStore(s => s.step)
  const mode            = useAppStore(s => s.mode)
  const audioPath       = useAppStore(s => s.audioPath)
  const isTranscribing  = useAppStore(s => s.isTranscribing)
  const set             = useAppStore(s => s.set)

  // UI_DESIGN_SPEC.md §2.2 — picking a file jumps straight into Studio, no
  // intermediate confirmation step. The real StartScreen (Phase 2) will set
  // this directly; StepUpload (wrapped as-is per T11) still just sets
  // audioPath, so this effect is the seam that does the screen flip today.
  useEffect(() => {
    if (audioPath && screen === 'start') {
      set({ screen: 'studio', mode: 'design', step: 'layout' })
    }
  }, [audioPath, screen, set])

  return (
    <>
      {isTranscribing && (
        <div className="loading-bar-track">
          <div className="loading-bar-fill" />
        </div>
      )}

      {screen === 'start' ? (
        <StartScreen />
      ) : (
        <StudioLayout toolbar={<Toolbar />}>
          <div key={step === 'export' ? 'export' : mode} className="animate-mode-fade-slide h-full">
            {step === 'export' ? <StepExport /> : mode === 'design' ? <StepLayout /> : <StepTranscript />}
          </div>
        </StudioLayout>
      )}
    </>
  )
}
