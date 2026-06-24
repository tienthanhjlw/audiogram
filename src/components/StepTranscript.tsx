import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { convertFileSrc } from '@tauri-apps/api/core'
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'
import { Segment, ModelInfo, CANVAS_SIZES } from '../types'
import WaveformCanvas from './WaveformCanvas'
import { useAppStore } from '../store'

const SPLIT_BPS = 30

// ── Silence-based segment splitting ──────────────────────────────────────────

function findSilence(envelope: number[], startSec: number, endSec: number): number {
  const s = Math.floor(startSec * SPLIT_BPS)
  const e = Math.ceil(endSec * SPLIT_BPS)
  if (e <= s + 1 || envelope.length === 0) return (startSec + endSec) / 2
  let minVal = Infinity, minIdx = Math.floor((s + e) / 2)
  for (let i = s; i <= Math.min(e, envelope.length - 1); i++) {
    if (envelope[i] < minVal) { minVal = envelope[i]; minIdx = i }
  }
  return minIdx / SPLIT_BPS
}

function splitSegments(segs: Segment[], envelope: number[], maxDur = 3.5): Segment[] {
  function recurse(seg: Segment, depth: number): Segment[] {
    const dur = seg.end - seg.start
    if (dur <= maxDur || depth > 6 || !seg.text.trim()) return [seg]
    const margin = Math.min(0.5, dur * 0.15)
    const splitAt = envelope.length > 0
      ? findSilence(envelope, seg.start + margin, seg.end - margin)
      : (seg.start + seg.end) / 2
    const words = seg.text.split(/\s+/).filter(Boolean)
    if (words.length < 2) return [seg]
    const ratio = Math.max(0.1, Math.min(0.9, (splitAt - seg.start) / dur))
    const splitWord = Math.max(1, Math.min(words.length - 1, Math.round(words.length * ratio)))
    const left:  Segment = { id: 0, start: seg.start, end: splitAt,  text: words.slice(0, splitWord).join(' ') }
    const right: Segment = { id: 0, start: splitAt,   end: seg.end,  text: words.slice(splitWord).join(' ') }
    return [...recurse(left, depth + 1), ...recurse(right, depth + 1)]
  }
  let id = 0
  return segs.flatMap(seg => recurse(seg, 0)).filter(s => s.text.trim()).map(s => ({ ...s, id: id++ }))
}

// ── Color palettes ────────────────────────────────────────────────────────────

const KARAOKE_COLORS = [
  { hex: '#FFD60A', name: 'Yellow' }, { hex: '#06B6D4', name: 'Cyan' },
  { hex: '#EC4FC4', name: 'Pink'   }, { hex: '#6C4FF6', name: 'Purple' },
  { hex: '#22C55E', name: 'Green'  }, { hex: '#F97316', name: 'Orange' },
]
const SUBTITLE_COLORS = [
  { hex: '#FFFFFF', name: 'White'    }, { hex: '#FEF9C3', name: 'Cream' },
  { hex: '#BAE6FD', name: 'Sky'      }, { hex: '#BBF7D0', name: 'Mint'  },
  { hex: '#FBCFE8', name: 'Rose'     }, { hex: '#E9D5FF', name: 'Lavender' },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function StepTranscript() {
  const audioPath      = useAppStore(s => s.audioPath)
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
  const zones          = useAppStore(s => s.zones)
  const showSubtitles  = useAppStore(s => s.showSubtitles)
  const isTranscribing = useAppStore(s => s.isTranscribing)
  const whisperModel   = useAppStore(s => s.whisperModel)
  const set            = useAppStore(s => s.set)
  const next           = useAppStore(s => s.next)
  const back           = useAppStore(s => s.back)

  const [error, setError]                             = useState<string | null>(null)
  const [confirmRetranscribe, setConfirmRetranscribe] = useState(false)
  const [elapsed, setElapsed]                         = useState(0)
  const [models, setModels]                           = useState<ModelInfo[]>([])
  const [downloadingModel, setDownloadingModel]       = useState<string | null>(null)
  const [downloadPct, setDownloadPct]                 = useState(0)

  const audioRef    = useRef<HTMLAudioElement>(null)
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const [playing, setPlaying]         = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration]       = useState(0)
  const lastScrolledIdx = useRef(-1)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const ratio        = CANVAS_SIZES[canvasSize].w / CANVAS_SIZES[canvasSize].h
  const hasSubtitles = showSubtitles && segments.length > 0

  const activeIdx = useMemo(() => {
    if (!segments.length) return -1
    return segments.findIndex(s => currentTime >= s.start && currentTime < s.end)
  }, [segments, currentTime])

  const activeSeg = activeIdx >= 0 ? segments[activeIdx] : undefined

  useEffect(() => {
    if (activeIdx >= 0 && activeIdx !== lastScrolledIdx.current) {
      lastScrolledIdx.current = activeIdx
      virtuosoRef.current?.scrollToIndex({ index: activeIdx, behavior: 'smooth', align: 'center' })
    }
  }, [activeIdx])

  // ── Load model list ───────────────────────────────────────────────────────

  const refreshModels = useCallback(() => {
    invoke<ModelInfo[]>('list_models').then(setModels).catch(() => {})
  }, [])

  useEffect(() => { refreshModels() }, [refreshModels])

  useEffect(() => {
    const unlisten = listen<{ name: string; percent: number }>('model_download_progress', e => {
      setDownloadPct(e.payload.percent)
      if (e.payload.percent >= 100) {
        setDownloadingModel(null)
        setDownloadPct(0)
        refreshModels()
      }
    })
    return () => { unlisten.then(f => f()) }
  }, [refreshModels])

  // ── Transcription timer ───────────────────────────────────────────────────

  useEffect(() => {
    if (isTranscribing) {
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isTranscribing])

  // ── Transcription ─────────────────────────────────────────────────────────

  const runTranscribe = useCallback(async () => {
    if (!audioPath) return
    setError(null)
    setConfirmRetranscribe(false)
    set({ isTranscribing: true, segments: [], srtPath: '' })
    try {
      const rawSegs = await invoke<Segment[]>('transcribe_audio', {
        audioPath,
        modelName: whisperModel,
      })
      const segs = splitSegments(rawSegs, peaks, 3.5)
      const srtPath = await invoke<string>('write_srt', { segments: segs })
      set({ segments: segs, srtPath, isTranscribing: false, showSubtitles: true })
    } catch (e: any) {
      setError(String(e?.message ?? e))
      set({ isTranscribing: false })
    }
  }, [audioPath, whisperModel, peaks, set])

  const handleTranscribeClick = () => {
    if (segments.length > 0) setConfirmRetranscribe(true)
    else runTranscribe()
  }

  const updateSegment = useCallback((id: number, text: string) => {
    const updated = segments.map(s => s.id === id ? { ...s, text } : s)
    set({ segments: updated })
    invoke<string>('write_srt', { segments: updated }).then(p => set({ srtPath: p })).catch(() => {})
  }, [segments, set])

  // ── Model download ────────────────────────────────────────────────────────

  const startDownload = async (name: string) => {
    if (downloadingModel) return
    setDownloadingModel(name)
    setDownloadPct(0)
    try {
      await invoke('download_model', { name })
    } catch (e: any) {
      setError(String(e?.message ?? e))
      setDownloadingModel(null)
      setDownloadPct(0)
    }
  }

  // ── Audio player ──────────────────────────────────────────────────────────

  const seekTo = useCallback((time: number) => {
    const el = audioRef.current
    if (!el) return
    el.currentTime = time
    el.play().catch(() => {})
    setPlaying(true)
  }, [])

  const togglePlay = () => {
    const el = audioRef.current
    if (!el) return
    if (playing) { el.pause() } else { el.play().catch(() => {}) }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const audioSrc = audioPath ? convertFileSrc(audioPath) : ''

  return (
    <div className="fade-up" style={{ display: 'flex', gap: 20, height: '100%' }}>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={audioSrc}
        onTimeUpdate={e => setCurrentTime(e.currentTarget.currentTime)}
        onDurationChange={e => setDuration(e.currentTarget.duration)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        style={{ display: 'none' }}
      />

      {/* ── Left column ── */}
      <div style={{ width: 340, display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0 }}>

        {/* Model picker + transcribe button */}
        <div style={{
          background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB',
          padding: 18, display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>Nhận dạng giọng nói</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Chọn model
            </div>

            {models.length === 0 && (
              <div style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', padding: '8px 0' }}>
                Đang tải danh sách…
              </div>
            )}

            {models.map(m => {
              const isSelected    = whisperModel === m.name
              const isDownloading = downloadingModel === m.name
              const sizeLabel     = m.size_mb >= 1000
                ? `${(m.size_mb / 1024).toFixed(1)} GB`
                : `${m.size_mb} MB`

              return (
                <div
                  key={m.name}
                  onClick={() => m.downloaded && set({ whisperModel: m.name })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px', borderRadius: 10,
                    border: `1.5px solid ${isSelected ? '#6C4FF6' : '#E5E7EB'}`,
                    background: isSelected ? '#F5F3FF' : '#FAFAFA',
                    cursor: m.downloaded ? 'pointer' : 'default',
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                >
                  <div style={{
                    width: 16, height: 16, borderRadius: 8, flexShrink: 0,
                    border: `2px solid ${isSelected ? '#6C4FF6' : '#D1D5DB'}`,
                    background: isSelected ? '#6C4FF6' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {isSelected && <div style={{ width: 6, height: 6, borderRadius: 3, background: '#fff' }} />}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{m.label}</span>
                      <span style={{ fontSize: 10, color: '#9CA3AF', fontFamily: 'monospace' }}>{sizeLabel}</span>
                      {m.name === 'base' && !downloadingModel && (
                        <span style={{ fontSize: 9, color: '#059669', fontWeight: 600, background: '#D1FAE5', borderRadius: 4, padding: '1px 5px' }}>
                          BUNDLED
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>{m.note}</div>

                    {isDownloading && (
                      <div style={{ marginTop: 5 }}>
                        <div style={{ height: 4, background: '#E5E7EB', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 2,
                            background: 'linear-gradient(90deg, #6C4FF6, #EC4FC4)',
                            width: `${downloadPct}%`, transition: 'width 0.3s',
                          }} />
                        </div>
                        <div style={{ fontSize: 10, color: '#6C4FF6', marginTop: 3, fontWeight: 600 }}>
                          Đang tải… {downloadPct}%
                        </div>
                      </div>
                    )}
                  </div>

                  {!isDownloading && (
                    m.downloaded ? (
                      <span style={{ fontSize: 10, color: '#6C4FF6', fontWeight: 600 }}>✓</span>
                    ) : (
                      <button
                        onClick={e => { e.stopPropagation(); startDownload(m.name) }}
                        disabled={!!downloadingModel}
                        style={{
                          padding: '4px 8px', borderRadius: 6, border: 'none',
                          background: downloadingModel ? '#E5E7EB' : '#6C4FF6',
                          color: downloadingModel ? '#9CA3AF' : '#fff',
                          fontSize: 11, fontWeight: 600, cursor: downloadingModel ? 'default' : 'pointer',
                          fontFamily: 'inherit', flexShrink: 0,
                        }}
                      >
                        ↓ Tải
                      </button>
                    )
                  )}
                </div>
              )
            })}
          </div>

          <button
            onClick={handleTranscribeClick}
            disabled={!audioPath || isTranscribing}
            style={{
              background: isTranscribing ? '#A78BFA' : (!audioPath ? '#E5E7EB' : '#6C4FF6'),
              color: !audioPath ? '#9CA3AF' : '#fff',
              border: 'none', borderRadius: 8, padding: '11px 0',
              fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
              cursor: isTranscribing || !audioPath ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'background 0.15s',
            }}
          >
            {isTranscribing
              ? <><Spinner /> Đang nhận dạng… {elapsed}s</>
              : segments.length > 0
                ? '↺ Nhận dạng lại'
                : '🎙 Nhận dạng giọng nói'}
          </button>

          {confirmRetranscribe && (
            <div style={{
              padding: '10px 12px', background: '#FFFBEB', borderRadius: 8,
              border: '1px solid #FDE68A', fontSize: 12,
            }}>
              <div style={{ fontWeight: 600, color: '#92400E', marginBottom: 6 }}>Ghi đè edits hiện tại?</div>
              <div style={{ color: '#B45309', marginBottom: 10 }}>
                {segments.length} segments sẽ bị thay thế.
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={runTranscribe} style={{
                  flex: 1, padding: '7px 0', borderRadius: 6, border: 'none',
                  background: '#F59E0B', color: '#fff', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>Đồng ý</button>
                <button onClick={() => setConfirmRetranscribe(false)} style={{
                  flex: 1, padding: '7px 0', borderRadius: 6, border: '1px solid #E5E7EB',
                  background: '#fff', color: '#374151', fontSize: 12, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>Huỷ</button>
              </div>
            </div>
          )}

          {!audioPath && (
            <div style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center' }}>
              Import audio trước
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

        {/* Audio player */}
        {audioPath && (
          <div style={{
            background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB',
            padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={togglePlay}
                style={{
                  width: 36, height: 36, borderRadius: 18, border: 'none',
                  background: '#6C4FF6', color: '#fff', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {playing ? <PauseIcon /> : <PlayIcon />}
              </button>
              <span style={{ fontSize: 11, color: '#6B7280', fontFamily: 'monospace', flexShrink: 0 }}>
                {fmt(currentTime)} / {fmt(duration)}
              </span>
              <div style={{ flex: 1 }}>
                <input
                  type="range"
                  min={0}
                  max={duration || 1}
                  step={0.1}
                  value={currentTime}
                  onChange={e => seekTo(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#6C4FF6', cursor: 'pointer' }}
                />
              </div>
            </div>
            {activeSeg && (
              <div style={{
                fontSize: 11, color: '#6C4FF6', fontWeight: 500,
                background: '#EDE9FF', borderRadius: 6, padding: '4px 8px',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                ▶ {activeSeg.text}
              </div>
            )}
          </div>
        )}

        {/* Segment editor */}
        {segments.length > 0 && (
          <div style={{
            background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB',
            padding: '14px 14px 0', flex: 1, display: 'flex', flexDirection: 'column',
            gap: 8, minHeight: 0,
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {segments.length} Segments — click để sửa / seek
            </div>
            <Virtuoso
              ref={virtuosoRef}
              className="user-select-text"
              style={{ flex: 1, paddingBottom: 14 }}
              totalCount={segments.length}
              itemContent={i => {
                const seg = segments[i]
                return (
                  <div style={{ paddingBottom: 4 }}>
                    <SegmentRow
                      seg={seg}
                      active={i === activeIdx}
                      onSeek={() => seekTo(seg.start)}
                      onChange={t => updateSegment(seg.id, t)}
                    />
                  </div>
                )
              }}
            />
          </div>
        )}

        {/* Nav */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={back} style={btnSecondary}>← Back</button>
          <button onClick={next} style={btnPrimary}>Export →</button>
        </div>
      </div>

      {/* ── Right column ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>

        {/* Subtitle style card */}
        <div style={{
          background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB',
          padding: 18, display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>Subtitle Style</div>

          <RowToggle
            label="Hiển thị subtitle khi export"
            sub={segments.length === 0 ? 'Nhận dạng audio trước' : undefined}
            value={showSubtitles && segments.length > 0}
            disabled={segments.length === 0}
            onChange={v => set({ showSubtitles: v })}
          />

          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 160, opacity: hasSubtitles ? 1 : 0.45 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                Màu chữ subtitle
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                {SUBTITLE_COLORS.map(c => (
                  <button key={c.hex} title={c.name}
                    onClick={() => hasSubtitles && set({ subtitleColor: c.hex })}
                    style={{
                      width: 26, height: 26, borderRadius: 13,
                      background: c.hex, border: '1.5px solid #E5E7EB', flexShrink: 0,
                      cursor: hasSubtitles ? 'pointer' : 'default',
                      boxShadow: subtitleColor === c.hex ? '0 0 0 2px #fff, 0 0 0 4px #6C4FF6' : '0 1px 3px rgba(0,0,0,0.12)',
                      transition: 'box-shadow 0.15s',
                    }}
                  />
                ))}
                <input type="color" value={subtitleColor} disabled={!hasSubtitles}
                  onChange={e => set({ subtitleColor: e.target.value })}
                  style={{ width: 26, height: 26, border: '1px solid #E5E7EB', borderRadius: 6, padding: 1, cursor: hasSubtitles ? 'pointer' : 'default', background: 'none' }}
                />
              </div>
            </div>

            <div style={{ flex: 1, minWidth: 160 }}>
              <RowToggle
                label="Karaoke highlight"
                sub="Chữ sweep theo tiến trình audio"
                value={karaokeEnabled}
                disabled={!hasSubtitles}
                onChange={v => set({ karaokeEnabled: v })}
              />
            </div>
          </div>

          {karaokeEnabled && hasSubtitles && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                Màu highlight karaoke
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {KARAOKE_COLORS.map(c => (
                  <button key={c.hex} title={c.name}
                    onClick={() => set({ karaokeColor: c.hex })}
                    style={{
                      width: 28, height: 28, borderRadius: 14, background: c.hex,
                      border: 'none', cursor: 'pointer', flexShrink: 0,
                      boxShadow: karaokeColor === c.hex ? `0 0 0 2px #fff, 0 0 0 4px ${c.hex}` : '0 1px 3px rgba(0,0,0,0.18)',
                      transition: 'box-shadow 0.15s',
                    }}
                  />
                ))}
                <input type="color" value={karaokeColor}
                  onChange={e => set({ karaokeColor: e.target.value })}
                  style={{ width: 28, height: 28, border: '1px solid #E5E7EB', borderRadius: 6, padding: 2, cursor: 'pointer', background: 'none' }}
                />
                <span style={{ fontSize: 12, color: '#6B7280', fontFamily: 'monospace' }}>
                  {karaokeColor.toUpperCase()}
                </span>
              </div>
            </div>
          )}

          {segments.length === 0 && (
            <div style={{
              padding: '10px 14px', background: '#F9FAFB', borderRadius: 8,
              border: '1px solid #F3F4F6', fontSize: 12, color: '#9CA3AF', textAlign: 'center',
            }}>
              Nhận dạng audio để bật subtitle
            </div>
          )}
        </div>

        {/* Canvas preview */}
        <div style={{
          flex: 1, background: 'linear-gradient(135deg, #1a0f3a 0%, #0f0a1e 100%)',
          borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', minHeight: 200,
        }}>
          <div style={{
            aspectRatio: String(ratio),
            width: ratio >= 1 ? '80%' : undefined,
            height: ratio < 1 ? '86%' : undefined,
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
              karaokeEnabled={karaokeEnabled && hasSubtitles}
              karaokeColor={karaokeColor}
              layoutTemplate={layoutTemplate}
              coverImagePath={coverImagePath}
              subtitleColor={subtitleColor}
              subtitleYPct={subtitleYPct}
              zones={zones}
            />
          </div>
        </div>

        <div style={{ fontSize: 12, color: '#6B7280' }}>
          {hasSubtitles
            ? karaokeEnabled
              ? `Karaoke · ${karaokeColor.toUpperCase()} · chữ ${subtitleColor.toUpperCase()}`
              : `${segments.length} segments · chữ ${subtitleColor.toUpperCase()}`
            : 'Preview layout'}
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function RowToggle({ label, sub, value, disabled, onChange }: {
  label: string; sub?: string; value: boolean; disabled?: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, opacity: disabled ? 0.45 : 1 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{sub}</div>}
      </div>
      <button
        disabled={disabled}
        onClick={() => !disabled && onChange(!value)}
        style={{
          width: 38, height: 22, borderRadius: 11, border: 'none',
          cursor: disabled ? 'default' : 'pointer', padding: 0, flexShrink: 0, marginTop: 1,
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

interface SegmentRowProps {
  seg: Segment
  active: boolean
  onSeek: () => void
  onChange: (t: string) => void
}

function SegmentRow({ seg, active, onSeek, onChange }: SegmentRowProps) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(seg.text)
  const commit = () => { onChange(val); setEditing(false) }
  const dur = seg.end - seg.start

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 3, padding: '6px 8px',
      borderRadius: 6,
      background: active ? '#EDE9FF' : '#F9FAFB',
      border: `1px solid ${active ? '#C4B5FD' : '#F3F4F6'}`,
      transition: 'background 0.15s, border-color 0.15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          onClick={onSeek}
          title="Phát từ đây"
          style={{
            width: 18, height: 18, borderRadius: 9, border: 'none',
            background: active ? '#6C4FF6' : '#E5E7EB',
            color: active ? '#fff' : '#9CA3AF',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0, padding: 0,
            transition: 'background 0.15s',
          }}
        >
          <svg width="7" height="8" viewBox="0 0 7 8" fill="currentColor">
            <path d="M0 0l7 4-7 4V0z"/>
          </svg>
        </button>
        <span style={{ fontSize: 10, color: '#9CA3AF', fontFamily: 'monospace', whiteSpace: 'nowrap', flexShrink: 0 }}>{fmt(seg.start)}</span>
        <span style={{ fontSize: 10, color: '#D1D5DB' }}>→</span>
        <span style={{ fontSize: 10, color: '#9CA3AF', fontFamily: 'monospace', whiteSpace: 'nowrap', flexShrink: 0 }}>{fmt(seg.end)}</span>
        <span style={{ fontSize: 9, color: '#fff', background: dur < 1.2 ? '#F59E0B' : '#D1D5DB', borderRadius: 4, padding: '1px 4px', fontFamily: 'monospace', flexShrink: 0 }}>
          {dur.toFixed(1)}s
        </span>
      </div>
      {editing ? (
        <input autoFocus value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
          style={{ flex: 1, fontSize: 12, border: '1px solid #6C4FF6', borderRadius: 4, padding: '2px 6px', fontFamily: 'inherit', outline: 'none' }}
        />
      ) : (
        <span
          onClick={() => { setVal(seg.text); setEditing(true) }}
          style={{ fontSize: 12, color: active ? '#4C1D95' : '#374151', cursor: 'text', lineHeight: 1.5, fontWeight: active ? 600 : 400 }}
        >
          {seg.text}
        </span>
      )}
    </div>
  )
}

function PlayIcon() {
  return (
    <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor">
      <path d="M0 0l12 7-12 7V0z"/>
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor">
      <rect x="0" y="0" width="4" height="14" rx="1"/>
      <rect x="8" y="0" width="4" height="14" rx="1"/>
    </svg>
  )
}

function fmt(s: number) {
  if (!isFinite(s) || isNaN(s)) return '0:00'
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
