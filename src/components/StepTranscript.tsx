import { useState, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { AppState, Segment, CANVAS_SIZES } from '../types'
import WaveformCanvas from './WaveformCanvas'

interface Props {
  state: AppState
  onChange: (patch: Partial<AppState>) => void
  onBack: () => void
  onNext: () => void
}

const KARAOKE_COLORS = [
  { hex: '#FFD60A', name: 'Yellow' },
  { hex: '#06B6D4', name: 'Cyan'   },
  { hex: '#EC4FC4', name: 'Pink'   },
  { hex: '#6C4FF6', name: 'Purple' },
  { hex: '#22C55E', name: 'Green'  },
  { hex: '#F97316', name: 'Orange' },
]

export default function StepTranscript({ state, onChange, onBack, onNext }: Props) {
  const [error, setError] = useState<string | null>(null)
  const ratio = CANVAS_SIZES[state.canvasSize].w / CANVAS_SIZES[state.canvasSize].h
  const hasSubtitles = state.showSubtitles && state.segments.length > 0

  const transcribe = useCallback(async () => {
    if (!state.audioPath) return
    setError(null)
    onChange({ isTranscribing: true, segments: [], srtPath: '' })
    try {
      const segs = await invoke<Segment[]>('transcribe_audio', { audioPath: state.audioPath })
      const srtPath = await invoke<string>('write_srt', { segments: segs })
      onChange({ segments: segs, srtPath, isTranscribing: false, showSubtitles: true })
    } catch (e: any) {
      setError(String(e?.message ?? e))
      onChange({ isTranscribing: false })
    }
  }, [state.audioPath, onChange])

  const updateSegment = useCallback((id: number, text: string) => {
    const updated = state.segments.map(s => s.id === id ? { ...s, text } : s)
    onChange({ segments: updated })
    invoke<string>('write_srt', { segments: updated })
      .then(p => onChange({ srtPath: p }))
      .catch(() => {})
  }, [state.segments, onChange])

  return (
    <div className="fade-up" style={{ display: 'flex', gap: 20, height: '100%' }}>

      {/* ── Left: transcribe + segment list ── */}
      <div style={{ width: 340, display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0 }}>

        {/* Transcribe card */}
        <div style={{
          background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB',
          padding: 18, display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>Auto Transcript</div>

          <button
            onClick={transcribe}
            disabled={!state.audioPath || state.isTranscribing}
            style={{
              background: state.isTranscribing ? '#A78BFA' : (!state.audioPath ? '#E5E7EB' : '#6C4FF6'),
              color: !state.audioPath ? '#9CA3AF' : '#fff',
              border: 'none', borderRadius: 8, padding: '11px 0',
              fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
              cursor: state.isTranscribing || !state.audioPath ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'background 0.15s',
            }}
          >
            {state.isTranscribing
              ? <><Spinner /> Transcribing…</>
              : state.segments.length > 0
                ? '↺ Re-transcribe'
                : '🎙 Transcribe Audio'}
          </button>

          {!state.audioPath && (
            <div style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center' }}>
              Upload an audio file first
            </div>
          )}

          {error && (
            <div style={{
              padding: '8px 10px', background: '#FEF2F2', borderRadius: 7,
              border: '1px solid #FECACA', fontSize: 11, color: '#DC2626',
            }}>
              {error}
            </div>
          )}
        </div>

        {/* Segment editor */}
        {state.segments.length > 0 && (
          <div style={{
            background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB',
            padding: 18, flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0,
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {state.segments.length} Segments — click to edit
            </div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {state.segments.map(seg => (
                <SegmentRow key={seg.id} seg={seg} onChange={t => updateSegment(seg.id, t)} />
              ))}
            </div>
          </div>
        )}

        {/* Nav */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onBack} style={btnSecondary}>← Back</button>
          <button onClick={onNext} style={btnPrimary}>Export →</button>
        </div>
      </div>

      {/* ── Right: style controls + preview ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>

        {/* Subtitle style card */}
        <div style={{
          background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB',
          padding: 18, display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>Subtitle Style</div>

          {/* Show in export */}
          <RowToggle
            label="Show subtitles in export"
            sub={state.segments.length === 0 ? 'Transcribe audio first' : undefined}
            value={state.showSubtitles && state.segments.length > 0}
            disabled={state.segments.length === 0}
            onChange={v => onChange({ showSubtitles: v })}
          />

          {/* Karaoke toggle */}
          <RowToggle
            label="Karaoke highlight effect"
            sub="Colors sweep word-by-word as audio plays"
            value={state.karaokeEnabled}
            disabled={!hasSubtitles}
            onChange={v => onChange({ karaokeEnabled: v })}
          />

          {/* Color picker — only when karaoke enabled */}
          {state.karaokeEnabled && hasSubtitles && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                Highlight Color
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {KARAOKE_COLORS.map(c => (
                  <button
                    key={c.hex}
                    title={c.name}
                    onClick={() => onChange({ karaokeColor: c.hex })}
                    style={{
                      width: 30, height: 30, borderRadius: 15,
                      background: c.hex, border: 'none', cursor: 'pointer',
                      boxShadow: state.karaokeColor === c.hex
                        ? `0 0 0 2px #fff, 0 0 0 4px ${c.hex}`
                        : '0 1px 3px rgba(0,0,0,0.2)',
                      transition: 'box-shadow 0.15s',
                    }}
                  />
                ))}
                <input
                  type="color"
                  value={state.karaokeColor}
                  onChange={e => onChange({ karaokeColor: e.target.value })}
                  style={{ width: 30, height: 30, border: '1px solid #E5E7EB', borderRadius: 6, padding: 2, cursor: 'pointer', background: 'none' }}
                />
                <span style={{ fontSize: 12, color: '#6B7280', fontFamily: 'monospace' }}>
                  {state.karaokeColor.toUpperCase()}
                </span>
              </div>
            </div>
          )}

          {/* Info when no segments */}
          {state.segments.length === 0 && (
            <div style={{
              padding: '10px 14px', background: '#F9FAFB', borderRadius: 8,
              border: '1px solid #F3F4F6', fontSize: 12, color: '#9CA3AF', textAlign: 'center',
            }}>
              Transcribe your audio to enable subtitle options
            </div>
          )}
        </div>

        {/* Canvas preview */}
        <div style={{
          flex: 1, background: 'linear-gradient(135deg, #1a0f3a 0%, #0f0a1e 100%)',
          borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', minHeight: 180,
        }}>
          <div style={{
            aspectRatio: String(ratio),
            maxWidth: ratio >= 1 ? '80%' : undefined,
            maxHeight: ratio < 1 ? '86%' : undefined,
            height: ratio < 1 ? '86%' : undefined,
            borderRadius: 12, overflow: 'hidden',
            boxShadow: '0 16px 56px rgba(0,0,0,0.55)',
          }}>
            <WaveformCanvas
              audioPath={state.audioPath}
              color={state.waveColor}
              bgColor={state.bgColor}
              waveStyle={state.waveStyle}
              title={state.title}
              canvasRatio={ratio}
              segments={hasSubtitles ? state.segments : []}
              fontSize={state.fontSize}
              fontName={state.fontName}
              karaokeEnabled={state.karaokeEnabled && hasSubtitles}
              karaokeColor={state.karaokeColor}
            />
          </div>
        </div>

        {hasSubtitles && (
          <div style={{ fontSize: 12, color: '#6B7280', textAlign: 'center' }}>
            {state.karaokeEnabled
              ? `Karaoke · sweep color: ${state.karaokeColor.toUpperCase()}`
              : `${state.segments.length} subtitle segments · plain white`}
          </div>
        )}
      </div>
    </div>
  )
}

function RowToggle({
  label, sub, value, disabled, onChange,
}: {
  label: string; sub?: string; value: boolean; disabled?: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12,
      opacity: disabled ? 0.45 : 1,
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{sub}</div>}
      </div>
      <button
        disabled={disabled}
        onClick={() => !disabled && onChange(!value)}
        style={{
          width: 38, height: 22, borderRadius: 11, border: 'none', cursor: disabled ? 'default' : 'pointer',
          padding: 0, flexShrink: 0, marginTop: 1,
          background: value ? '#6C4FF6' : '#D1D5DB', position: 'relative', transition: 'background 0.2s',
        }}
      >
        <span style={{
          position: 'absolute', top: 3, left: value ? 19 : 3, width: 16, height: 16,
          borderRadius: 8, background: '#fff', transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </button>
    </div>
  )
}

function SegmentRow({ seg, onChange }: { seg: Segment; onChange: (t: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(seg.text)

  const commit = () => { onChange(val); setEditing(false) }

  return (
    <div style={{
      display: 'flex', gap: 8, alignItems: 'flex-start',
      padding: '6px 8px', borderRadius: 6, background: '#F9FAFB', border: '1px solid #F3F4F6',
    }}>
      <span style={{
        fontSize: 10, color: '#9CA3AF', fontFamily: 'monospace',
        whiteSpace: 'nowrap', marginTop: 3, flexShrink: 0,
      }}>
        {fmt(seg.start)}
      </span>
      {editing ? (
        <input
          autoFocus value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
          style={{
            flex: 1, fontSize: 12, border: '1px solid #6C4FF6', borderRadius: 4,
            padding: '2px 6px', fontFamily: 'inherit', outline: 'none',
          }}
        />
      ) : (
        <span
          onClick={() => { setVal(seg.text); setEditing(true) }}
          style={{ flex: 1, fontSize: 12, color: '#374151', cursor: 'text', lineHeight: 1.5 }}
        >
          {seg.text}
        </span>
      )}
    </div>
  )
}

function fmt(s: number) {
  const m = Math.floor(s / 60)
  const ss = Math.floor(s % 60)
  return `${m}:${String(ss).padStart(2, '0')}`
}

function Spinner() {
  return (
    <svg style={{ animation: 'spin 0.9s linear infinite' }} width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3"/>
      <path d="M12 2a10 10 0 0110 10" stroke="white" strokeWidth="3" strokeLinecap="round"/>
    </svg>
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
