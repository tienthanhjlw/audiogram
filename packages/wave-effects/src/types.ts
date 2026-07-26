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

/** A self-contained waveform visual style. Register in `registry.ts`.
 * `id` is a plain string (not the app's `WaveStyle` union) — this package
 * can't depend on its own consumer's types; apps/desktop/src/types.ts keeps
 * the `WaveStyle` union for store typing and validates against this
 * package's registry where it needs to narrow a string back to it. */
export interface WaveEffect {
  id: string
  label: string
  desc: string
  draw(c: WaveDrawCtx): void
}
