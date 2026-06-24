import { useState, useCallback } from 'react'
import { AppState, Step } from './types'
import Sidebar from './components/Sidebar'
import StepUpload from './components/StepUpload'
import StepLayout from './components/StepLayout'
import StepTranscript from './components/StepTranscript'
import StepExport from './components/StepExport'

const STEPS: Step[] = ['upload', 'layout', 'transcript', 'export']

const STEP_META: Record<Step, { label: string; num: number }> = {
  upload:     { label: 'Import',     num: 1 },
  layout:     { label: 'Layout',     num: 2 },
  transcript: { label: 'Transcript', num: 3 },
  export:     { label: 'Export',     num: 4 },
}

const DEFAULT_STATE: AppState = {
  step: 'upload',
  audioPath: '',
  audioName: '',
  title: '',
  canvasSize: '1:1',
  layoutTemplate: 'minimal',
  coverImagePath: '',
  waveStyle: 'bar',
  waveColor: '#FFFFFF',
  bgColor: '#111827',
  fps: 30,
  logs: [],
  isRendering: false,
  lastOutput: '',
  segments: [],
  srtPath: '',
  isTranscribing: false,
  showSubtitles: true,
  whisperModel: 'base',
  peaks: [],
  fontSize: 100,
  fontName: 'Arial',
  karaokeEnabled: false,
  karaokeColor: '#FFD60A',
  subtitleColor: '#FFFFFF',
  subtitleYPct: null,
  zones: null,
}

export default function App() {
  const [state, setState] = useState<AppState>(DEFAULT_STATE)

  const onChange = useCallback((patch: Partial<AppState>) => {
    setState(s => ({ ...s, ...patch }))
  }, [])

  const goTo = (step: Step) => setState(s => ({ ...s, step }))
  const next = () => {
    const idx = STEPS.indexOf(state.step)
    if (idx < STEPS.length - 1) goTo(STEPS[idx + 1])
  }
  const back = () => {
    const idx = STEPS.indexOf(state.step)
    if (idx > 0) goTo(STEPS[idx - 1])
  }

  const currentNum = STEP_META[state.step].num

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#F8F9FA' }}>
      {state.isTranscribing && (
        <div className="loading-bar-track">
          <div className="loading-bar-fill" />
        </div>
      )}
      <Sidebar step={state.step} audioReady={!!state.audioPath} onNav={goTo} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top bar */}
        <div style={{
          height: 60, background: '#fff',
          borderBottom: '1px solid #E5E7EB',
          display: 'flex', alignItems: 'center',
          padding: '0 24px', gap: 16, flexShrink: 0,
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>Create Audiogram</div>
            <div style={{ fontSize: 11, color: '#9CA3AF' }}>
              Step {currentNum} of 4 · {STEP_META[state.step].label}
              {state.segments.length > 0 && (
                <span style={{ marginLeft: 8, color: '#6C4FF6' }}>
                  · {state.segments.length} segments{state.karaokeEnabled ? ' · karaoke' : ''}
                </span>
              )}
            </div>
          </div>

          <div style={{ flex: 1 }} />

          {/* Step progress pills */}
          <div style={{ display: 'flex', gap: 6 }}>
            {STEPS.map((s, i) => {
              const num = i + 1
              const done = num < currentNum
              const active = s === state.step
              return (
                <div
                  key={s}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 12px', borderRadius: 20,
                    background: active ? '#6C4FF6' : done ? '#EDE9FF' : '#F3F4F6',
                    color: active ? '#fff' : done ? '#6C4FF6' : '#9CA3AF',
                    fontSize: 12, fontWeight: active ? 600 : 500,
                  }}
                >
                  <span style={{
                    width: 18, height: 18, borderRadius: 9,
                    background: active ? 'rgba(255,255,255,0.25)' : done ? '#6C4FF6' : '#E5E7EB',
                    color: active ? '#fff' : done ? '#fff' : '#9CA3AF',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700,
                  }}>
                    {done ? '✓' : num}
                  </span>
                  {STEP_META[s].label}
                </div>
              )
            })}
          </div>
        </div>

        {/* Content area */}
        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {state.step === 'upload' && (
            <StepUpload state={state} onChange={onChange} onNext={next} />
          )}
          {state.step === 'layout' && (
            <StepLayout state={state} onChange={onChange} onBack={back} onNext={next} />
          )}
          {state.step === 'transcript' && (
            <StepTranscript state={state} onChange={onChange} onBack={back} onNext={next} />
          )}
          {state.step === 'export' && (
            <StepExport state={state} onChange={onChange} onBack={back} />
          )}
        </div>
      </div>
    </div>
  )
}
