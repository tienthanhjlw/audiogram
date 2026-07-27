import { useEffect, useRef } from 'react'
import { WAVE_BARS } from '@audiogram/wave-effects'
import { useAppStore } from '../../store'
import { assetUrl } from '../../core/assetUrl'
import { audioEngine } from '../../core/audio/AudioEngine'
import { drawFrame, type FrameSpec } from '../../domain/preview/renderer'
import { DEFAULT_ZONES, type Segment } from '../../types'
import { useFftSpectrum } from './useFftSpectrum'

/** Referentially stable stand-in for "no captions to draw". A `[]` literal
 * written inside a zustand selector is a *new* array on every call, and
 * zustand v5 compares snapshots with `Object.is` via useSyncExternalStore —
 * React then sees the store as changed on every render and loops forever
 * ("The result of getSnapshot should be cached to avoid an infinite loop"),
 * taking the whole tree down rather than just wasting a render. */
const NO_SEGMENTS: Segment[] = []

interface PreviewCanvasProps {
  /** Backing canvas resolution's width in px; height derives from `ratio`.
   * Defaults to a 720px-long-edge preview resolution (matches the previous
   * WaveformCanvas.tsx default) when omitted. */
  width?: number
  ratio: number
  className?: string
  /** PHASE3_TASKS.md T8 — Captions mode's CaptionsCanvas passes true so the
   * preview shows the real caption text/karaoke sweep currently playing,
   * same activeSeg/slotStart/slotDur/elapsed derivation as the legacy
   * WaveformCanvas.tsx adapter. Design mode's CanvasStage omits this
   * (defaults false) — its canvas never showed live caption text, only the
   * subtitle zone's placeholder box when one exists. */
  showCaptions?: boolean
}

/** Live canvas preview — reads current template/wave/caption style straight
 * from the store and paints via domain/preview/renderer.ts's `drawFrame`.
 * Time comes from AudioEngine.onFrame (TECH_ARCHITECTURE.md §2.6): once
 * `duration > 0` the waveform follows the real transport playhead instead of
 * looping its own demo clock — this is what makes the preview and the
 * transport bar agree on what's currently playing. */
export function PreviewCanvas({ width, ratio, className, showCaptions = false }: PreviewCanvasProps) {
  const audioPath      = useAppStore(s => s.audioPath)
  const title          = useAppStore(s => s.title)
  const waveStyle      = useAppStore(s => s.waveStyle)
  const waveColor      = useAppStore(s => s.waveColor)
  const bgColor        = useAppStore(s => s.bgColor)
  const layoutTemplate = useAppStore(s => s.layoutTemplate)
  const coverImagePath = useAppStore(s => s.coverImagePath)
  const fontSize       = useAppStore(s => s.fontSize)
  const fontName       = useAppStore(s => s.fontName)
  const karaokeColor   = useAppStore(s => s.karaokeColor)
  const subtitleColor  = useAppStore(s => s.subtitleColor)
  const subtitleYPct   = useAppStore(s => s.subtitleYPct)
  const zones          = useAppStore(s => s.zones)
  const titleColor     = useAppStore(s => s.titleColor)
  const titleAlign     = useAppStore(s => s.titleAlign)
  const titleBold      = useAppStore(s => s.titleBold)
  const titleItalic    = useAppStore(s => s.titleItalic)
  const peaks          = useAppStore(s => s.peaks)
  const duration       = useAppStore(s => s.duration)
  // Each selector returns either a primitive or the store's own array
  // reference — never a freshly built one. The caption gating happens
  // *after* the selectors, not inside them (see NO_SEGMENTS above).
  const storeSegments   = useAppStore(s => s.segments)
  const showSubtitles   = useAppStore(s => s.showSubtitles)
  const storeKaraoke    = useAppStore(s => s.karaokeEnabled)

  const captionsOn      = showCaptions && showSubtitles
  const captionSegments = captionsOn ? storeSegments : NO_SEGMENTS
  const karaokeEnabled  = captionsOn && storeKaraoke

  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const coverImgRef  = useRef<HTMLImageElement | null>(null)
  const coverLoadRef = useRef('')
  const eqStateRef   = useRef<Float32Array>(new Float32Array(WAVE_BARS).fill(0))

  const { fftPeaksRef, fftBucketsRef } = useFftSpectrum(audioPath, waveStyle)

  // Cover image load — moved from WaveformCanvas.tsx, per-instance cache
  // (each PreviewCanvas mount owns one <img>, reloaded only when the path
  // changes) rather than the module-level FFT cache above: a decoded image
  // element isn't safely shareable across canvases the way a Float32Array is.
  useEffect(() => {
    if (!coverImagePath) { coverImgRef.current = null; coverLoadRef.current = ''; return }
    if (coverImagePath === coverLoadRef.current) return
    coverLoadRef.current = coverImagePath
    const img = new Image()
    img.src = assetUrl(coverImagePath)
    img.onload = () => { coverImgRef.current = img }
    img.onerror = () => { coverImgRef.current = null }
  }, [coverImagePath])

  const effectiveZones = zones ?? DEFAULT_ZONES[layoutTemplate]
  const subtitlePreview = !!effectiveZones.subtitle

  useEffect(() => {
    const unsub = audioEngine.onFrame(currentTime => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const W = canvas.width, H = canvas.height
      ctx.clearRect(0, 0, W, H)

      const hasAudio = duration > 0
      const waveDur  = hasAudio ? duration : 30
      const waveTime = hasAudio ? currentTime : performance.now() / 1000

      // Same activeSeg/slotStart/slotDur derivation as the legacy
      // WaveformCanvas.tsx adapter — copied rather than rewritten
      // (PHASE3_TASKS.md T8 step 3). Design mode passes showCaptions=false,
      // so captionSegments is always [] there and this loop is a no-op —
      // it never showed live caption text, only the subtitle zone's
      // placeholder box (subtitlePreview below) when one exists.
      let activeSeg: FrameSpec['activeSeg'], slotStart = 0, slotDur = 0
      const elapsed = waveTime % waveDur
      if (captionSegments.length > 0) {
        for (const seg of captionSegments) {
          if (elapsed >= seg.start && elapsed < seg.end) {
            activeSeg = seg; slotStart = seg.start; slotDur = seg.end - seg.start; break
          }
        }
      }

      const spec: FrameSpec = {
        t: performance.now() / 1200,
        peaks,
        color: waveColor,
        bgColor,
        waveStyle,
        title,
        fontSize,
        fontName,
        karaokeEnabled,
        karaokeColor,
        activeSeg,
        slotStart,
        slotDur,
        elapsed,
        segments: captionSegments,
        coverImg: coverImgRef.current,
        waveTime,
        waveDur,
        waveLoop: !hasAudio,
        eqState: eqStateRef.current,
        fftPeaks: fftPeaksRef.current,
        fftBuckets: fftBucketsRef.current,
        subtitleColor,
        subtitleYPct,
        zones,
        layoutTemplate,
        titleColor,
        titleAlign,
        titleBold,
        titleItalic,
        subtitlePreview,
      }
      drawFrame(ctx, W, H, spec)
    })
    return unsub
  }, [
    peaks, waveColor, bgColor, waveStyle, title, fontSize, fontName, karaokeEnabled, karaokeColor,
    captionSegments, subtitleColor, subtitleYPct, zones, layoutTemplate, titleColor, titleAlign,
    titleBold, titleItalic, subtitlePreview, duration, fftPeaksRef, fftBucketsRef,
  ])

  const LONG = 720
  const cvW = width ?? (ratio >= 1 ? LONG : Math.round(LONG * ratio))
  const cvH = width ? Math.round(width / ratio) : (ratio >= 1 ? Math.round(LONG / ratio) : LONG)

  return (
    <canvas
      ref={canvasRef}
      width={cvW}
      height={cvH}
      className={className}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}
