import { useState, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Segment, AppState } from '../types'

interface Props {
  state: AppState
  onChange: (patch: Partial<AppState>) => void
}

export default function TranscriptPanel({ state, onChange }: Props) {
  const [error, setError] = useState<string | null>(null)

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

  const updateSegment = (id: number, text: string) => {
    const updated = state.segments.map(s => s.id === id ? { ...s, text } : s)
    onChange({ segments: updated })
    invoke<string>('write_srt', { segments: updated })
      .then(p => onChange({ srtPath: p }))
      .catch(() => {})
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Auto Transcript
        </div>
        {state.segments.length > 0 && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#374151', cursor: 'pointer' }}>
            <Toggle value={state.showSubtitles} onChange={v => onChange({ showSubtitles: v })} />
            Show in export
          </label>
        )}
      </div>

      {/* Transcribe button */}
      <button
        onClick={transcribe}
        disabled={!state.audioPath || state.isTranscribing}
        style={{
          background: state.isTranscribing ? '#A78BFA' : (!state.audioPath ? '#E5E7EB' : '#6C4FF6'),
          color: !state.audioPath ? '#9CA3AF' : '#fff',
          border: 'none', borderRadius: 8, padding: '10px 0',
          fontSize: 13, fontWeight: 600,
          cursor: state.isTranscribing || !state.audioPath ? 'default' : 'pointer',
          fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'background 0.15s',
        }}
      >
        {state.isTranscribing
          ? <><MiniSpinner /> Transcribing…</>
          : state.segments.length > 0
            ? '↺ Re-transcribe'
            : '🎙 Transcribe Audio'}
      </button>

      {!state.audioPath && (
        <div style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center' }}>
          Import an audio file first
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          padding: '8px 10px', background: '#FEF2F2', borderRadius: 7,
          border: '1px solid #FECACA', fontSize: 11, color: '#DC2626',
        }}>
          {error}
        </div>
      )}

      {/* Segment editor */}
      {state.segments.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: '#9CA3AF', marginBottom: 2 }}>
            {state.segments.length} segments — click to edit
          </div>
          <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {state.segments.map(seg => (
              <SegmentRow key={seg.id} seg={seg} onChange={text => updateSegment(seg.id, text)} />
            ))}
          </div>
        </div>
      )}
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
      <span style={{ fontSize: 10, color: '#9CA3AF', fontFamily: 'monospace', whiteSpace: 'nowrap', marginTop: 2, flexShrink: 0 }}>
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

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 32, height: 18, borderRadius: 9, border: 'none', cursor: 'pointer', padding: 0,
        background: value ? '#6C4FF6' : '#D1D5DB', position: 'relative', transition: 'background 0.2s',
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: value ? 16 : 2, width: 14, height: 14,
        borderRadius: 7, background: '#fff', transition: 'left 0.2s',
      }} />
    </button>
  )
}

function MiniSpinner() {
  return (
    <svg style={{ animation: 'spin 0.9s linear infinite' }} width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3"/>
      <path d="M12 2a10 10 0 0110 10" stroke="white" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  )
}
