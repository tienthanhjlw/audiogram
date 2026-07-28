import { useEffect, useRef } from 'react'
import { EQ_BANDS } from '@audiogram/contract'
import { waveHeights } from '@audiogram/wave-effects'
import { fallbackEnvelope } from '../../core/audio/envelope'
import { wavePoint } from '../../extensions'
import { subscribeWaveMiniTick } from './waveMiniScheduler'

// Fixed fake waveform, shared by every card — same fallback envelope
// AudioEngine uses when a real decode fails (deterministic, no audio
// needed). Computed once at module load, not per mounted card.
const { peaks: FAKE_PEAKS, duration: FAKE_DUR } = fallbackEnvelope()

interface WaveMiniPreviewProps {
  /** Extension id, e.g. 'com.audiogram.wave.bar' — same id the wave style gallery (T6) uses. */
  extensionId: string
  /** Default mirrors --color-accent (ui/tokens.css); a literal because this
   * is a canvas fillStyle, which can't read CSS custom properties (P4-T7). */
  color?: string
  className?: string
}

/** Mini animated waveform for one wave style card (UI_DESIGN_SPEC.md §4.1) —
 * runs the style's own draw function against a fixed fake waveform, ticked
 * by the shared scheduler in waveMiniScheduler.ts rather than its own rAF
 * loop. */
export function WaveMiniPreview({ extensionId, color = '#7C5CFF', className }: WaveMiniPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const eqStateRef = useRef<Float32Array>(new Float32Array(EQ_BANDS).fill(0))

  useEffect(() => {
    const ext = wavePoint.get(extensionId)
    if (!ext) return
    const unsub = subscribeWaveMiniTick(ts => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const W = canvas.width, H = canvas.height
      ctx.clearRect(0, 0, W, H)
      const waveTime = (ts / 1000) % FAKE_DUR
      ext.draw({
        ctx,
        color,
        peaks: FAKE_PEAKS,
        heights: waveHeights(FAKE_PEAKS, waveTime, FAKE_DUR, true),
        waveTime,
        waveDur: FAKE_DUR,
        waveLoop: true,
        eqState: eqStateRef.current,
        fftPeaks: null,
        fftBuckets: 0,
        wx: 0, wy: 0, ww: W, wh: H,
      })
    })
    return unsub
  }, [extensionId, color])

  const W = 216 // 2x of the 108×44 card size in UI_DESIGN_SPEC.md §4.1, for retina
  const H = 88

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      className={className}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}
