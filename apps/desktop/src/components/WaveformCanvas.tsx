import { useEffect, useRef } from 'react'
import { WAVE_BARS } from '@audiogram/wave-effects'
import { WaveStyle, Segment, LayoutTemplate, LayoutZones } from '../types'
import { useAppStore } from '../store'
import { assetUrl } from '../core/assetUrl'
import { audioEngine } from '../core/audio/AudioEngine'
import { drawFrame, type FrameSpec } from '../domain/preview/renderer'
import { useFftSpectrum } from '../features/preview/useFftSpectrum'

interface Props {
  audioPath: string
  color: string
  bgColor: string
  waveStyle: WaveStyle
  title: string
  canvasRatio?: number
  segments?: Segment[]
  onPeaksReady?: (peaks: number[]) => void
  fontSize?: number
  fontName?: string
  karaokeEnabled?: boolean
  karaokeColor?: string
  layoutTemplate?: LayoutTemplate
  coverImagePath?: string
  subtitleColor?: string
  subtitleYPct?: number | null
  zones?: LayoutZones | null
  titleColor?:      string
  titleAlign?:      'left' | 'center' | 'right'
  titleBold?:       boolean
  titleItalic?:     boolean
  subtitlePreview?: boolean
}

// Thin adapter kept for the 3 remaining legacy consumers (StepLayout,
// StepTranscript, StepExport — PHASE2_TASKS.md T2, luật A.5: same default
// export, same prop signature/behavior as before this task). All actual
// drawing lives in domain/preview/renderer.ts's `drawFrame`; this component
// only turns props + shared audio/FFT state into one `FrameSpec` per frame.
//
// Unlike features/preview/PreviewCanvas.tsx (the new store-driven
// component), most fields here still come from props, not the store — the
// 3 callers each pass deliberately different values for the same store
// field (e.g. StepExport passes `segments={hasSubtitles ? segments : []}`,
// not the raw store segments). Only peaks/duration/FFT/cover-image are
// always sourced from the shared AudioEngine/store/cache rather than
// decoded locally — that's the actual fix this task makes: this component
// used to decode the audio file itself and run its own spectrum analysis
// IPC call on every mount, duplicating AudioEngine's decode and never
// gating that call by wave style (OPTIMIZATION_PLAN.md F5/F6).
export default function WaveformCanvas({
  audioPath, color, bgColor, waveStyle, title, canvasRatio = 1,
  segments = [], onPeaksReady, fontSize = 100, fontName = 'Arial',
  karaokeEnabled = false, karaokeColor = '#FFD60A',
  layoutTemplate = 'minimal', coverImagePath = '',
  subtitleColor = '#FFFFFF', subtitleYPct = null,
  zones = null,
  titleColor = '#FFFFFF', titleAlign = 'center', titleBold = false, titleItalic = false,
  subtitlePreview = false,
}: Props) {
  const peaks    = useAppStore(s => s.peaks)
  const duration = useAppStore(s => s.duration)

  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const coverImgRef   = useRef<HTMLImageElement | null>(null)
  const coverLoadRef  = useRef('')
  const eqStateRef    = useRef<Float32Array>(new Float32Array(WAVE_BARS).fill(0))

  const { fftPeaksRef, fftBucketsRef } = useFftSpectrum(audioPath, waveStyle)

  useEffect(() => {
    if (peaks.length > 0) onPeaksReady?.(peaks)
  }, [peaks, onPeaksReady])

  useEffect(() => {
    if (!coverImagePath) { coverImgRef.current = null; coverLoadRef.current = ''; return }
    if (coverImagePath === coverLoadRef.current) return
    coverLoadRef.current = coverImagePath
    const img = new Image()
    img.src = assetUrl(coverImagePath)
    img.onload = () => { coverImgRef.current = img }
    img.onerror = () => { coverImgRef.current = null }
  }, [coverImagePath])

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

      let activeSeg: Segment | undefined, slotStart = 0, slotDur = 0
      const elapsed = waveTime % waveDur
      if (segments.length > 0) {
        for (const seg of segments) {
          if (elapsed >= seg.start && elapsed < seg.end) {
            activeSeg = seg; slotStart = seg.start; slotDur = seg.end - seg.start; break
          }
        }
      }

      const spec: FrameSpec = {
        t: performance.now() / 1200,
        peaks, color, bgColor, waveStyle, title, fontSize, fontName,
        karaokeEnabled, karaokeColor, activeSeg, slotStart, slotDur, elapsed, segments,
        coverImg: coverImgRef.current,
        waveTime, waveDur, waveLoop: !hasAudio,
        eqState: eqStateRef.current,
        fftPeaks: fftPeaksRef.current,
        fftBuckets: fftBucketsRef.current,
        subtitleColor, subtitleYPct,
        zones, layoutTemplate,
        titleColor, titleAlign, titleBold, titleItalic, subtitlePreview,
      }
      drawFrame(ctx, W, H, spec)
    })
    return unsub
  }, [
    peaks, duration, color, bgColor, waveStyle, title, segments, fontSize, fontName,
    karaokeEnabled, karaokeColor, layoutTemplate, subtitleColor, subtitleYPct, zones,
    titleColor, titleAlign, titleBold, titleItalic, subtitlePreview, fftPeaksRef, fftBucketsRef,
  ])

  const LONG = 720
  const cvW = canvasRatio >= 1 ? LONG : Math.round(LONG * canvasRatio)
  const cvH = canvasRatio >= 1 ? Math.round(LONG / canvasRatio) : LONG

  return (
    <canvas
      ref={canvasRef}
      width={cvW}
      height={cvH}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}
