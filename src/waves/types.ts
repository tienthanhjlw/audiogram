import type { WaveStyle } from '../types'

/** Everything a wave effect needs to draw. Built once per frame by the canvas dispatcher. */
export interface WaveDrawCtx {
  ctx: CanvasRenderingContext2D
  color: string
  /** Raw amplitude envelope (full track). pulse/eq window it themselves. */
  peaks: number[]
  /** Pre-windowed `WAVE_BARS` amplitudes centred on the current time. */
  heights: number[]
  waveTime: number
  waveDur: number
  waveLoop: boolean
  /** EMA state for the eq effect — mutated in place across frames. */
  eqState: Float32Array
  fftPeaks: Float32Array | null
  fftBuckets: number
  /** Waveform rect. */
  wx: number
  wy: number
  ww: number
  wh: number
}

/** A self-contained waveform visual style. Register in `registry.ts`. */
export interface WaveEffect {
  id: WaveStyle
  label: string
  desc: string
  draw(c: WaveDrawCtx): void
}
