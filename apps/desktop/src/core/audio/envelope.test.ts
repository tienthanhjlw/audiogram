import { describe, expect, it } from 'vitest'
import { buildEnvelope, fallbackEnvelope, WAVE_BPS } from './envelope'

// jsdom has no Web Audio API, so there's no in-process way to run a real
// `AudioContext.decodeAudioData` on a WAV fixture in this test environment.
// `buildEnvelope` takes exactly what decodeAudioData would hand back — one
// channel's Float32Array plus the decoded duration — so we exercise that
// same pure math directly against a synthetic sine, which covers the actual
// arithmetic (bucket count, windowing, normalization) without needing a
// decoder.
function sineWave(durationSeconds: number, sampleRate = 44100): Float32Array {
  const n = Math.round(durationSeconds * sampleRate)
  const data = new Float32Array(n)
  for (let i = 0; i < n; i++) data[i] = Math.sin((i / sampleRate) * 2 * Math.PI * 440)
  return data
}

describe('buildEnvelope', () => {
  it('produces duration * WAVE_BPS buckets for a mid-length clip', () => {
    const duration = 2.5 // 2.5 * 120 = 300, comfortably inside the [64, 18000] clamp
    const env = buildEnvelope(sineWave(duration), duration)
    expect(env.length).toBe(duration * WAVE_BPS)
  })

  it('clamps to a minimum of 64 buckets for very short clips', () => {
    const duration = 0.05
    const env = buildEnvelope(sineWave(duration), duration)
    expect(env.length).toBe(64)
  })

  it('normalizes so the loudest bucket is exactly 1', () => {
    const duration = 1
    const env = buildEnvelope(sineWave(duration), duration)
    expect(Math.max(...env)).toBeCloseTo(1, 5)
  })

  it('keeps every bucket within [0, 1]', () => {
    const duration = 1
    const env = buildEnvelope(sineWave(duration), duration)
    expect(env.every(v => v >= 0 && v <= 1)).toBe(true)
  })
})

describe('fallbackEnvelope', () => {
  it('returns 30s of buckets at WAVE_BPS when decode fails', () => {
    const { peaks, duration } = fallbackEnvelope()
    expect(duration).toBe(30)
    expect(peaks.length).toBe(30 * WAVE_BPS)
  })
})
