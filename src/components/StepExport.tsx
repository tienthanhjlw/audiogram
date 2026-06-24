import { useEffect, useRef, useState } from 'react'
import { save } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { CANVAS_SIZES } from '../types'
import WaveformCanvas from './WaveformCanvas'
import { useAppStore } from '../store'

export default function StepExport() {
  const audioPath      = useAppStore(s => s.audioPath)
  const audioName      = useAppStore(s => s.audioName)
  const title          = useAppStore(s => s.title)
  const waveStyle      = useAppStore(s => s.waveStyle)
  const waveColor      = useAppStore(s => s.waveColor)
  const bgColor        = useAppStore(s => s.bgColor)
  const canvasSize     = useAppStore(s => s.canvasSize)
  const layoutTemplate = useAppStore(s => s.layoutTemplate)
  const coverImagePath = useAppStore(s => s.coverImagePath)
  const segments       = useAppStore(s => s.segments)
  const peaks          = useAppStore(s => s.peaks)
  const fontSize       = useAppStore(s => s.fontSize)
  const fontName       = useAppStore(s => s.fontName)
  const karaokeEnabled = useAppStore(s => s.karaokeEnabled)
  const karaokeColor   = useAppStore(s => s.karaokeColor)
  const subtitleColor  = useAppStore(s => s.subtitleColor)
  const subtitleYPct   = useAppStore(s => s.subtitleYPct)
  const showSubtitles  = useAppStore(s => s.showSubtitles)
  const srtPath        = useAppStore(s => s.srtPath)
  const zones          = useAppStore(s => s.zones)
  const fps            = useAppStore(s => s.fps)
  const isRendering    = useAppStore(s => s.isRendering)
  const logs           = useAppStore(s => s.logs)
  const lastOutput     = useAppStore(s => s.lastOutput)
  const back           = useAppStore(s => s.back)

  const logRef    = useRef<HTMLDivElement>(null)
  const unsubRef  = useRef<(() => void) | undefined>(undefined)
  const [progress, setProgress] = useState(0)

  const { w, h } = CANVAS_SIZES[canvasSize]
  const ratio = w / h

  // Fix stale closure: use store.setState with updater fn so the listener always
  // sees current state instead of the value captured at mount time.
  useEffect(() => {
    const unsubs: (() => void)[] = []
    listen<string>('log', e => {
      useAppStore.setState(s => ({ logs: [...s.logs, e.payload] }))
    }).then(f => unsubs.push(f))
    listen<number>('render_progress', e => {
      setProgress(e.payload)
    }).then(f => unsubs.push(f))
    unsubRef.current = () => unsubs.forEach(f => f())
    return () => unsubRef.current?.()
  }, [])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs])

  const render = async () => {
    const outPath = await save({
      defaultPath: `${title || 'audiogram'}.mp4`,
      filters: [{ name: 'Video', extensions: ['mp4'] }],
    })
    if (!outPath) return

    let captionsPath: string | null = null
    if (showSubtitles && segments.length > 0) {
      captionsPath = await invoke<string>('write_ass', {
        segments,
        params: {
          highlightColor: karaokeColor,
          videoWidth: w,
          videoHeight: h,
          fontSizePct: fontSize,
          layoutTemplate,
          karaokeEnabled,
          fontName,
          subtitleYPct: subtitleYPct ?? undefined,
          subtitleColor,
        },
      })
    }

    setProgress(0)
    useAppStore.setState({
      isRendering: true,
      logs: [
        'Starting render…',
        captionsPath
          ? `Subtitles${karaokeEnabled ? ' (karaoke)' : ''}: ${captionsPath}`
          : '(no subtitles)',
      ],
    })

    try {
      const res = await invoke<string>('render_audiogram', {
        params: {
          audio_path: audioPath,
          peaks,
          bg_color: bgColor,
          captions_path: captionsPath,
          width: w,
          height: h,
          fps,
          wave_color: waveColor,
          wave_style: waveStyle,
          intro_title: title || null,
          intro_duration: 3,
          font_size: fontSize,
          font_name: fontName,
          layout_template: layoutTemplate,
          output_path: outPath,
        },
      })
      setProgress(100)
      useAppStore.setState(s => ({ lastOutput: res, isRendering: false, logs: [...s.logs, `Done: ${res}`] }))
    } catch (e: any) {
      useAppStore.setState(s => ({ logs: [...s.logs, `Error: ${e?.message ?? String(e)}`], isRendering: false }))
    }
  }

  const openOutput = () => {
    if (!lastOutput) return
    const dir = lastOutput.replace(/\\/g, '/').replace(/\/[^/]*$/, '')
    invoke('open_folder', { path: dir })
  }

  const hasSubtitles = showSubtitles && srtPath && segments.length > 0

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
            { label: 'File',       value: audioName },
            { label: 'Title',      value: title || '—' },
            { label: 'Resolution', value: `${w}×${h}` },
            { label: 'Format',     value: canvasSize },
            { label: 'FPS',        value: `${fps} fps` },
            { label: 'Wave',       value: waveStyle },
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
              <div style={{ width: 16, height: 16, borderRadius: 4, background: waveColor, border: '1px solid rgba(0,0,0,0.1)' }} />
              <span style={{ color: '#D1D5DB', fontSize: 10 }}>/</span>
              <div style={{ width: 16, height: 16, borderRadius: 4, background: bgColor, border: '1px solid rgba(0,0,0,0.1)' }} />
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
                  {segments.length} segments from Whisper
                </div>
              )}
              {!hasSubtitles && segments.length > 0 && (
                <div style={{ color: '#9CA3AF', fontSize: 11 }}>Transcribed but disabled</div>
              )}
            </div>
          </div>
        </div>

        <button onClick={back} style={{
          background: '#F3F4F6', color: '#374151', border: 'none',
          borderRadius: 10, padding: '11px 0', fontSize: 13, fontWeight: 500,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>← Back</button>

        {/* Progress bar */}
        {isRendering && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 11, color: '#6B7280' }}>
              <span>Rendering…</span>
              <span style={{ fontWeight: 600, color: '#6C4FF6' }}>{Math.round(progress)}%</span>
            </div>
            <div style={{ height: 6, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #6C4FF6, #EC4FC4)',
                borderRadius: 3,
                transition: 'width 0.4s ease',
              }} />
            </div>
          </div>
        )}

        <button
          onClick={render}
          disabled={isRendering}
          style={{
            background: isRendering ? '#A78BFA' : '#6C4FF6', color: '#fff',
            border: 'none', borderRadius: 10, padding: '13px 0',
            fontSize: 14, fontWeight: 700, cursor: isRendering ? 'default' : 'pointer',
            fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'background 0.15s',
          }}
        >
          {isRendering ? <><Spinner /> Rendering…</> : 'Export MP4'}
        </button>

        {lastOutput && (
          <button onClick={openOutput} style={{
            background: '#ECFDF5', color: '#059669', border: '1.5px solid #6EE7B7',
            borderRadius: 10, padding: '11px 0', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            Open Output Folder
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
            width: ratio >= 1 ? '82%' : undefined,
            height: ratio < 1 ? '88%' : undefined,
            borderRadius: 12, overflow: 'hidden',
            boxShadow: '0 16px 56px rgba(0,0,0,0.55)',
          }}>
            <WaveformCanvas
              audioPath={audioPath}
              color={waveColor}
              bgColor={bgColor}
              waveStyle={waveStyle}
              title={title}
              canvasRatio={ratio}
              segments={hasSubtitles ? segments : []}
              fontSize={fontSize}
              fontName={fontName}
              karaokeEnabled={karaokeEnabled && !!hasSubtitles}
              karaokeColor={karaokeColor}
              layoutTemplate={layoutTemplate}
              coverImagePath={coverImagePath}
              subtitleColor={subtitleColor}
              subtitleYPct={subtitleYPct}
              zones={zones}
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
            {logs.length === 0
              ? <span style={{ color: '#334155' }}>Ready — click Export MP4 to start.</span>
              : logs.map((l, i) => (
                  <div key={i} style={{ color: l.startsWith('Error') ? '#F87171' : l.startsWith('Done') ? '#4ADE80' : '#94A3B8' }}>
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
