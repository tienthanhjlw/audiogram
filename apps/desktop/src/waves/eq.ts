// `eq` — spectrum analyser bars. Uses real FFT when available, else a
// time-lagged EMA simulation. Mutates `eqState` in place. Parity: effects/eq.rs
import type { WaveEffect, WaveDrawCtx } from './types'
import { BAR_FILL, EQ_BANDS, GAP_FILL } from '../domain/contract.gen'

export const eqEffect: WaveEffect = {
  id: 'eq',
  label: 'EQ',
  desc: 'Spectrum analyzer',
  draw(c: WaveDrawCtx) {
    const { ctx, color, peaks, waveTime, waveDur, eqState, fftPeaks, fftBuckets, wx, wy, ww, wh } = c
    const BARS = EQ_BANDS
    const bw = ww * BAR_FILL / BARS, gap = ww * GAP_FILL / BARS
    const midY = wy + wh / 2
    const loopedT = waveDur > 0 ? waveTime % waveDur : 0
    const drawBar = (i: number, target: number) => {
      const frac = i / (BARS - 1)
      const a = target > eqState[i] ? 0.40 : 0.045 + frac * 0.055
      eqState[i] = a * target + (1 - a) * eqState[i]
      const p = eqState[i]
      const halfH = Math.max(2, p * wh / 2)
      const x0 = wx + i * (bw + gap), x1 = Math.min(wx + ww, x0 + bw)
      const barW = x1 - x0, r = Math.min(barW / 2, halfH)
      const g = ctx.createLinearGradient(0, midY - halfH, 0, midY + halfH)
      g.addColorStop(0, color + '33'); g.addColorStop(0.45, color + 'FF')
      g.addColorStop(0.55, color + 'FF'); g.addColorStop(1, color + '33')
      ctx.fillStyle = g
      ctx.beginPath(); ctx.roundRect(x0, midY - halfH, barW, halfH * 2, r); ctx.fill()
    }
    if (fftPeaks && fftBuckets > 0) {
      const fftCur = Math.min(fftBuckets - 1, Math.round((loopedT / waveDur) * (fftBuckets - 1)))
      for (let i = 0; i < BARS; i++) drawBar(i, fftPeaks[fftCur * BARS + i])
    } else {
      const M = peaks.length
      if (M === 0) return
      const cur = Math.min(M - 1, Math.round((loopedT / waveDur) * (M - 1)))
      const LAG = 2
      for (let i = 0; i < BARS; i++) {
        const sampleIdx = ((cur - (BARS - 1 - i) * LAG) % M + M) % M
        let sum = 0, cnt = 0
        for (let j = Math.max(0, sampleIdx - 2); j <= sampleIdx; j++) { sum += peaks[j]; cnt++ }
        drawBar(i, cnt > 0 ? sum / cnt : 0)
      }
    }
  },
}
