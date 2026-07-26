// Envelope math COPIED VERBATIM from the pre-Phase-1 decode effect in
// WaveformCanvas.tsx (see PHASE1_TASKS.md T10 — "di chuyển" = copy, don't
// change the arithmetic). WaveformCanvas keeps its own copy for now (it
// still self-decodes until Phase 2 ports the preview onto AudioEngine); this
// is the version AudioEngine uses so playback.slice.peaks come from one
// place. WAVE_BPS is duplicated here the same way it's already duplicated
// between TS/Rust per CLAUDE.md's parity table — T14's contract codegen
// unifies all copies.
export const WAVE_BPS = 120

/** `data` is one decoded audio channel (Float32Array of samples in [-1, 1]).
 * Builds a time-resolved amplitude envelope at WAVE_BPS buckets/second,
 * clamped to [64, 18000] buckets total, gamma-compressed by ^0.7 so quiet
 * passages stay visible in the waveform. */
export function buildEnvelope(data: Float32Array, duration: number): number[] {
  const M = Math.min(Math.max(Math.round(duration * WAVE_BPS), 64), 18000)
  const block = Math.max(1, Math.floor(data.length / M))
  let maxV = 1e-4
  const env = new Array<number>(M)
  for (let i = 0; i < M; i++) {
    let max = 0
    const base = i * block
    for (let j = 0; j < block; j++) { const v = Math.abs(data[base + j]); if (v > max) max = v }
    env[i] = max
    if (max > maxV) maxV = max
  }
  for (let i = 0; i < M; i++) env[i] = Math.pow(env[i] / maxV, 0.7)
  return env
}

/** Simulated envelope used when decode fails (bad/missing file) — same
 * fallback shape as WaveformCanvas's catch branch, 30s of a fake waveform. */
export function fallbackEnvelope(): { peaks: number[]; duration: number } {
  const M = WAVE_BPS * 30
  const peaks = Array.from({ length: M }, (_, i) =>
    0.3 + 0.5 * Math.abs(Math.sin(i * 0.12)) * (0.6 + 0.4 * Math.abs(Math.sin(i * 0.031))))
  return { peaks, duration: 30 }
}
