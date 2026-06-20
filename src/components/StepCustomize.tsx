import { AppState, WAVE_COLORS, BG_COLORS, WAVE_STYLES, CANVAS_SIZES, WaveStyle } from '../types'
import WaveformCanvas from './WaveformCanvas'

interface Props {
  state: AppState
  onChange: (patch: Partial<AppState>) => void
  onBack: () => void
  onNext: () => void
}

export default function StepCustomize({ state, onChange, onBack, onNext }: Props) {
  const ratio = CANVAS_SIZES[state.canvasSize].w / CANVAS_SIZES[state.canvasSize].h

  return (
    <div className="fade-up" style={{ display: 'flex', gap: 20, height: '100%' }}>

      {/* ── Left controls ── */}
      <div style={{
        width: 260, display: 'flex', flexDirection: 'column', gap: 0,
        flexShrink: 0, overflowY: 'auto',
      }}>
        <div style={{
          background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB',
          padding: 18, display: 'flex', flexDirection: 'column', gap: 18,
        }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>Visual</div>

          {/* Waveform style */}
          <Section label="Waveform Style">
            <div style={{ display: 'flex', gap: 8 }}>
              {WAVE_STYLES.map(s => (
                <button key={s.id} onClick={() => onChange({ waveStyle: s.id as WaveStyle })}
                  style={{
                    flex: 1, padding: '8px 4px', borderRadius: 8, cursor: 'pointer',
                    border: `1.5px solid ${state.waveStyle === s.id ? '#6C4FF6' : '#E5E7EB'}`,
                    background: state.waveStyle === s.id ? '#EDE9FF' : '#F9FAFB',
                    fontSize: 12, fontWeight: state.waveStyle === s.id ? 600 : 400,
                    color: state.waveStyle === s.id ? '#6C4FF6' : '#374151',
                    fontFamily: 'inherit', textAlign: 'center',
                  }}
                >{s.label}</button>
              ))}
            </div>
          </Section>

          {/* Wave color */}
          <Section label="Wave Color">
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
              {WAVE_COLORS.map(c => (
                <button key={c.hex} title={c.name} onClick={() => onChange({ waveColor: c.hex })}
                  style={{
                    width: 28, height: 28, borderRadius: 14, background: c.hex,
                    border: 'none', cursor: 'pointer',
                    boxShadow: state.waveColor === c.hex
                      ? `0 0 0 2px #fff, 0 0 0 3.5px ${c.hex}`
                      : '0 1px 3px rgba(0,0,0,0.15)',
                    outline: c.hex === '#FFFFFF' ? '1px solid #E5E7EB' : 'none',
                    transition: 'box-shadow 0.15s',
                  }} />
              ))}
              <input type="color" value={state.waveColor} onChange={e => onChange({ waveColor: e.target.value })}
                style={{ width: 28, height: 28, border: '1px solid #E5E7EB', borderRadius: 6, padding: 2, cursor: 'pointer', background: 'none' }} />
            </div>
          </Section>

          {/* BG color */}
          <Section label="Background">
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
              {BG_COLORS.map(c => (
                <button key={c.hex} title={c.name} onClick={() => onChange({ bgColor: c.hex })}
                  style={{
                    width: 28, height: 28, borderRadius: 14, background: c.hex,
                    border: 'none', cursor: 'pointer', outline: '1px solid rgba(0,0,0,0.1)',
                    boxShadow: state.bgColor === c.hex ? `0 0 0 2px #fff, 0 0 0 3.5px #6C4FF6` : '0 1px 3px rgba(0,0,0,0.2)',
                    transition: 'box-shadow 0.15s',
                  }} />
              ))}
              <input type="color" value={state.bgColor} onChange={e => onChange({ bgColor: e.target.value })}
                style={{ width: 28, height: 28, border: '1px solid #E5E7EB', borderRadius: 6, padding: 2, cursor: 'pointer', background: 'none' }} />
            </div>
          </Section>

          {/* Title */}
          <Section label="Episode Title">
            <input
              value={state.title}
              onChange={e => onChange({ title: e.target.value })}
              placeholder="My Podcast Episode"
              style={{
                width: '100%', padding: '9px 12px', border: '1px solid #E5E7EB',
                borderRadius: 8, fontSize: 13, color: '#111827', fontFamily: 'inherit',
                outline: 'none', boxSizing: 'border-box',
              }}
              onFocus={e => (e.target.style.borderColor = '#6C4FF6')}
              onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
            />
          </Section>

          {/* Font family */}
          <Section label="Font">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['Arial', 'Georgia', 'Impact', 'Verdana'] as const).map(f => (
                <button key={f} onClick={() => onChange({ fontName: f })}
                  style={{
                    padding: '6px 10px', borderRadius: 7, cursor: 'pointer',
                    border: `1.5px solid ${state.fontName === f ? '#6C4FF6' : '#E5E7EB'}`,
                    background: state.fontName === f ? '#EDE9FF' : '#F9FAFB',
                    fontSize: 12, fontWeight: state.fontName === f ? 700 : 400,
                    color: state.fontName === f ? '#6C4FF6' : '#374151',
                    fontFamily: f, letterSpacing: f === 'Impact' ? '0.02em' : undefined,
                  }}
                >{f}</button>
              ))}
            </div>
          </Section>

          {/* Font size */}
          <Section label={`Font Size — ${state.fontSize}%`}>
            <input
              type="range" min={70} max={140} step={5}
              value={state.fontSize}
              onChange={e => onChange({ fontSize: Number(e.target.value) })}
              style={{ width: '100%', accentColor: '#6C4FF6' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>
              <span>Smaller</span><span>Larger</span>
            </div>
          </Section>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
            <button onClick={onBack} style={btnSecondary}>← Back</button>
            <button onClick={onNext} style={btnPrimary}>Export →</button>
          </div>
        </div>

      </div>

      {/* ── Center: animated preview ── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #1a0f3a 0%, #0f0a1e 100%)',
        borderRadius: 16, padding: 24, gap: 16, overflow: 'hidden',
      }}>
        {/* Preview label */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {(['16:9', '1:1', '9:16'] as const).map(s => (
            <button key={s} onClick={() => onChange({ canvasSize: s })}
              style={{
                padding: '4px 10px', borderRadius: 20, border: 'none', cursor: 'pointer',
                background: state.canvasSize === s ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)',
                color: state.canvasSize === s ? '#fff' : 'rgba(255,255,255,0.4)',
                fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
              }}>{s}</button>
          ))}
          {state.segments.length > 0 && (
            <div style={{
              padding: '4px 10px', borderRadius: 20,
              background: state.showSubtitles ? 'rgba(108,79,246,0.4)' : 'rgba(255,255,255,0.06)',
              color: state.showSubtitles ? '#C4B5FD' : 'rgba(255,255,255,0.4)',
              fontSize: 11, fontWeight: 600,
            }}>
              {state.showSubtitles ? '💬 Subtitles ON' : '💬 Subtitles OFF'}
            </div>
          )}
        </div>

        {/* Canvas */}
        <div style={{
          aspectRatio: String(ratio),
          maxWidth: ratio >= 1 ? '85%' : undefined,
          maxHeight: ratio < 1 ? '78%' : undefined,
          height: ratio < 1 ? '78%' : undefined,
          borderRadius: 16, overflow: 'hidden',
          boxShadow: '0 24px 80px rgba(108,79,246,0.35)',
          position: 'relative',
        }}>
          <WaveformCanvas
            audioPath={state.audioPath}
            color={state.waveColor}
            bgColor={state.bgColor}
            waveStyle={state.waveStyle}
            title={state.title}
            canvasRatio={ratio}
            segments={state.showSubtitles ? state.segments : []}
            onPeaksReady={peaks => onChange({ peaks })}
            fontSize={state.fontSize}
            fontName={state.fontName}
          />
        </div>

        {/* Transcript segments count */}
        {state.segments.length > 0 && (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
            {state.segments.length} subtitle segments ready · {state.showSubtitles ? 'visible in preview' : 'hidden'}
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
        {label}
      </div>
      {children}
    </div>
  )
}

const btnPrimary: React.CSSProperties = {
  flex: 1, background: '#6C4FF6', color: '#fff', border: 'none',
  borderRadius: 10, padding: '11px 0', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
}
const btnSecondary: React.CSSProperties = {
  flex: 1, background: '#F3F4F6', color: '#374151', border: 'none',
  borderRadius: 10, padding: '11px 0', fontSize: 13, fontWeight: 500,
  cursor: 'pointer', fontFamily: 'inherit',
}
