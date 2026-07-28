// Waveform node renderer — thin adapter over the existing wave-effect plugins.
// Does not reimplement any wave drawing: dispatches straight to
// `WAVE_EFFECTS[style].draw()`, same as the legacy `drawWaveform` in
// ../renderer.ts (P5-T3 step 2: "gọi thẳng WAVE_EFFECTS... không viết lại").
import { WAVE_EFFECTS, waveHeights } from '@audiogram/wave-effects'
import { SceneNode, WaveStyle, WaveformProps } from '../../../types'

/** Shared per-frame waveform inputs — the same fields wave-effects plugins need. */
export interface WaveformShared {
  peaks: number[]
  waveTime: number
  waveDur: number
  waveLoop: boolean
  eqState: Float32Array
  fftPeaks: Float32Array | null
  fftBuckets: number
}

export function drawWaveformNode(ctx: CanvasRenderingContext2D, W: number, H: number, node: SceneNode, shared: WaveformShared): void {
  const props = node.props as WaveformProps
  if (shared.peaks.length === 0) return
  const { transform } = node
  const wx = transform.x * W, wy = transform.y * H, ww = transform.w * W, wh = transform.h * H
  ctx.save()
  ctx.globalAlpha = transform.opacity ?? 1
  WAVE_EFFECTS[props.style as WaveStyle].draw({
    ctx,
    color: props.color,
    peaks: shared.peaks,
    heights: waveHeights(shared.peaks, shared.waveTime, shared.waveDur, shared.waveLoop),
    waveTime: shared.waveTime,
    waveDur: shared.waveDur,
    waveLoop: shared.waveLoop,
    eqState: shared.eqState,
    fftPeaks: shared.fftPeaks,
    fftBuckets: shared.fftBuckets,
    wx, wy, ww, wh,
  })
  ctx.restore()
}
