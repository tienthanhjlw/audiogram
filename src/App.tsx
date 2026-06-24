import { useAppStore } from './store'
import Sidebar from './components/Sidebar'
import StepUpload from './components/StepUpload'
import StepLayout from './components/StepLayout'
import StepTranscript from './components/StepTranscript'
import StepExport from './components/StepExport'

const STEP_META = {
  upload:     { label: 'Import',     num: 1 },
  layout:     { label: 'Layout',     num: 2 },
  transcript: { label: 'Transcript', num: 3 },
  export:     { label: 'Export',     num: 4 },
} as const

const STEP_ORDER = ['upload', 'layout', 'transcript', 'export'] as const

export default function App() {
  const step           = useAppStore(s => s.step)
  const audioPath      = useAppStore(s => s.audioPath)
  const isTranscribing = useAppStore(s => s.isTranscribing)
  const karaokeEnabled = useAppStore(s => s.karaokeEnabled)
  const segments       = useAppStore(s => s.segments)
  const goTo           = useAppStore(s => s.goTo)

  const currentNum = STEP_META[step].num

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#F8F9FA' }}>
      {isTranscribing && (
        <div className="loading-bar-track">
          <div className="loading-bar-fill" />
        </div>
      )}
      <Sidebar step={step} audioReady={!!audioPath} onNav={goTo} />

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
              Step {currentNum} of 4 · {STEP_META[step].label}
              {segments.length > 0 && (
                <span style={{ marginLeft: 8, color: '#6C4FF6' }}>
                  · {segments.length} segments{karaokeEnabled ? ' · karaoke' : ''}
                </span>
              )}
            </div>
          </div>

          <div style={{ flex: 1 }} />

          {/* Step progress pills */}
          <div style={{ display: 'flex', gap: 6 }}>
            {STEP_ORDER.map((s, i) => {
              const num    = i + 1
              const done   = num < currentNum
              const active = s === step
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
          {step === 'upload'     && <StepUpload />}
          {step === 'layout'     && <StepLayout />}
          {step === 'transcript' && <StepTranscript />}
          {step === 'export'     && <StepExport />}
        </div>
      </div>
    </div>
  )
}
