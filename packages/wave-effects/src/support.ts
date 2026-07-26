// Shared waveform helpers + constants. Parity: src-tauri/.../render/wave/support.rs
// WAVE_BARS must match Rust's WAVE_BARS (frame.rs) — sourced from
// contract/constants.json via @audiogram/contract (T14/T17), re-exported
// here so every existing `import { WAVE_BARS } from '@audiogram/wave-effects'`
// call site keeps working unchanged.
export { WAVE_BARS } from '@audiogram/contract'
import { WAVE_BARS } from '@audiogram/contract'

/** Window `WAVE_BARS` amplitude buckets centred on `tSec`. Mirrors `wave_heights()` in Rust. */
export function waveHeights(env: number[], tSec: number, dur: number, loop: boolean): number[] {
  const M = env.length
  const out = new Array<number>(WAVE_BARS).fill(0)
  if (M === 0 || dur <= 0) return out
  const cur = Math.round((tSec / dur) * (M - 1))
  const half = Math.floor(WAVE_BARS / 2)
  for (let i = 0; i < WAVE_BARS; i++) {
    let idx = cur - half + i
    if (loop) idx = ((idx % M) + M) % M
    else idx = Math.max(0, Math.min(M - 1, idx))
    out[i] = env[idx]
  }
  return out
}
