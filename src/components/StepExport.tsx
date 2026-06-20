import { useEffect, useRef } from 'react'
import { save } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { AppState, CANVAS_SIZES } from '../types'
import WaveformCanvas from './WaveformCanvas'

interface Props {
  state: AppState
  onChange: (patch: Partial<AppState>) => void
  onBack: () => void
}

export default function StepExport({ state, onChange, onBack }: Props) {
  const logRef = useRef<HTMLDivElement>(null)
  const ratio  = CANVAS_SIZES[state.canvasSize].w / CANVAS_SIZES[state.canvasSize].h
  const unsubRef = useRef<(() => void) | undefined>(undefined)

  useEffect(() => {
    listen<string>('log', e => {
      onChange({ logs: [...state.logs, e.payload] })
    }).then(f => { unsubRef.current = f })
    return () => unsubRef.current?.()
  }, [])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [state.logs])

  const render = async () => {
    const outPath = await save({
      defaultPath: `${state.title || 'audiogram'}.mp4`,
      filters: [{ name: 'Video', extensions: ['mp4'] }],
    })
    if (!outPath) return

    const { w, h } = CANVAS_SIZES[state.canvasSize]

    // Build captions path: ASS (karaoke) or SRT (plain)
    let captionsPath: string | null = null
    if (state.showSubtitles && state.segments.length > 0) {
      if (state.karaokeEnabled) {
        captionsPath = await invoke<string>('write_ass', {
          segments: state.segments,
          highlightColor: state.karaokeColor,
        })
      } else if (state.srtPath) {
        captionsPath = state.srtPath
      }
    }

    onChange({ isRendering: true, logs: ['🎬 Starting render…', captionsPath ? `💬 ${state.karaokeEnabled ? 'Karaoke' : 'Subtitles'}: ${captionsPath}` : '(no subtitles)'] })
    try {
      const res = await invoke<string>('render_audiogram', {
        params: {
          audio_path: state.audioPath,
          peaks: state.peaks,
          bg_color: state.bgColor,
          captions_path: captionsPath,
          width: w,
          height: h,
          fps: state.fps,
          wave_color: state.waveColor,
          wave_style: state.waveStyle,
          intro_title: state.title || null,
          intro_duration: 3,
          font_size: state.fontSize,
          font_name: state.fontName,
          output_path: outPath,
        },
      })
      onChange({ lastOutput: res, isRendering: false, logs: [...state.logs, `✅ Done: ${res}`] })
    } catch (e: any) {
      onChange({ logs: [...state.logs, `❌ ${e?.message ?? String(e)}`], isRendering: false })
    }
  }

  const openOutput = () => {
    if (!state.lastOutput) return
    const dir = state.lastOutput.replace(/\\/g, '/').replace(/\/[^/]*$/, '')
    invoke('open_folder', { path: dir })
  }

  const hasSubtitles = state.showSubtitles && state.srtPath && state.segments.length > 0

  return (
    <div className="fade-up" style={{ display: 'flex', gap: 20, height: '100%' }}>

      {/* ── Left summary ── */}
      <div style={{ width: 300, display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0 }}>

        {/* Summary card */}
        <div style={{
          background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB',
          padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginBottom: 14 }}>Export</div>

          {[
            { label: 'File',       value: state.audioName },
            { label: 'Title',      value: state.title || '—' },
            { label: 'Resolution', value: `${CANVAS_SIZES[state.canvasSize].w}×${CANVAS_SIZES[state.canvasSize].h}` },
            { label: 'Ratio',      value: state.canvasSize },
            { label: 'FPS',        value: `${state.fps} fps` },
            { label: 'Wave',       value: state.waveStyle },
          ].map(({ label, value }) => (
            <div key={label} style={{
              display: 'flex', justifyContent: 'space-between', padding: '6px 0',
              borderBottom: '1px solid #F3F4F6', fontSize: 13,
            }}>
              <span style={{ color: '#6B7280' }}>{label}</span>
              <span style={{ color: '#111827', fontWeight: 500, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>
                {value}
              </span>
            </div>
          ))}

          {/* Color swatches */}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13 }}>
            <span style={{ color: '#6B7280' }}>Wave / BG</span>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <div style={{ width: 16, height: 16, borderRadius: 4, background: state.waveColor, border: '1px solid rgba(0,0,0,0.1)' }} />
              <span style={{ color: '#D1D5DB', fontSize: 10 }}>/</span>
              <div style={{ width: 16, height: 16, borderRadius: 4, background: state.bgColor, border: '1px solid rgba(0,0,0,0.1)' }} />
            </div>
          </div>

          {/* Subtitle badge */}
          <div style={{
            marginTop: 8, padding: '8px 12px', borderRadius: 8,
            background: hasSubtitles ? '#EDE9FF' : '#F9FAFB',
            border: `1px solid ${hasSubtitles ? '#C4B5FD' : '#E5E7EB'}`,
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
          }}>
            <span style={{ fontSize: 16 }}>{hasSubtitles ? '💬' : '🔇'}</span>
            <div>
              <div style={{ fontWeight: 600, color: hasSubtitles ? '#6C4FF6' : '#9CA3AF' }}>
                {hasSubtitles ? 'Subtitles enabled' : 'No subtitles'}
              </div>
              {hasSubtitles && (
                <div style={{ color: '#7C3AED', fontSize: 11 }}>
                  {state.segments.length} segments from Whisper
                </div>
              )}
              {!hasSubtitles && state.segments.length > 0 && (
                <div style={{ color: '#9CA3AF', fontSize: 11 }}>
                  Transcribed but disabled
                </div>
              )}
            </div>
          </div>
        </div>

        <button onClick={onBack} style={{ background: '#F3F4F6', color: '#374151', border: 'none', borderRadius: 10, padding: '11px 0', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
          ← Back
        </button>

        <button
          onClick={render}
          disabled={state.isRendering}
          style={{
            background: state.isRendering ? '#A78BFA' : '#6C4FF6', color: '#fff',
            border: 'none', borderRadius: 10, padding: '13px 0',
            fontSize: 14, fontWeight: 700, cursor: state.isRendering ? 'default' : 'pointer',
            fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'background 0.15s',
          }}
        >
          {state.isRendering ? <><Spinner /> Rendering…</> : '⬇  Export MP4'}
        </button>

        {state.lastOutput && (
          <button onClick={openOutput} style={{
            background: '#ECFDF5', color: '#059669', border: '1.5px solid #6EE7B7',
            borderRadius: 10, padding: '11px 0', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            ✓ Open Output Folder
          </button>
        )}
      </div>

      {/* ── Right: preview + logs ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
        {/* Preview */}
        <div style={{
          flex: 1, background: 'linear-gradient(135deg, #1a0f3a 0%, #0f0a1e 100%)',
          borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', minHeight: 180,
        }}>
          <div style={{
            aspectRatio: String(ratio),
            maxWidth: ratio >= 1 ? '82%' : undefined,
            maxHeight: ratio < 1 ? '88%' : undefined,
            height: ratio < 1 ? '88%' : undefined,
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
              karaokeEnabled={state.karaokeEnabled && !!hasSubtitles}
              karaokeColor={state.karaokeColor}
            />
          </div>
        </div>

        {/* Log panel */}
        <div style={{
          background: '#0F172A', borderRadius: 12,
          padding: '12px 16px', height: 150, flexShrink: 0,
          border: '1px solid #1E293B',
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Logs
          </div>
          <div ref={logRef} style={{
            height: 'calc(100% - 22px)', overflowY: 'auto',
            fontSize: 11, fontFamily: 'monospace', color: '#94A3B8', lineHeight: 1.7,
          }}>
            {state.logs.length === 0
              ? <span style={{ color: '#334155' }}>Ready — click Export MP4 to start.</span>
              : state.logs.map((l, i) => (
                  <div key={i} style={{ color: l.startsWith('❌') ? '#F87171' : l.startsWith('✅') ? '#4ADE80' : l.startsWith('🎬') ? '#A78BFA' : '#94A3B8' }}>
                    {l}
                  </div>
                ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <svg style={{ animation: 'spin 0.9s linear infinite' }} width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3"/>
      <path d="M12 2a10 10 0 0110 10" stroke="white" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  )
}
