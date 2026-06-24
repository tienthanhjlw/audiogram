// `pulse` — bell-windowed bars (centre emphasised, edges tapered). Parity: effects/pulse.rs
import type { WaveEffect } from './types'

export const pulseEffect: WaveEffect = {
  id: 'pulse',
  label: 'Pulse',
  desc: 'Bell-curve bloom',
  draw({ ctx, color, peaks, waveTime, waveDur, waveLoop, wx, wy, ww, wh }) {
    const BARS = 40
    const bw = ww * 0.64 / BARS, gap = ww * 0.36 / BARS
    const midY = wy + wh / 2
    const M = peaks.length
    const loopedT = waveDur > 0 ? waveTime % waveDur : 0
    const cur = Math.round((loopedT / waveDur) * (M - 1))
    const half = Math.floor(BARS / 2)
    for (let i = 0; i < BARS; i++) {
      let idx = cur - half + i
      if (waveLoop) idx = ((idx % M) + M) % M
      else idx = Math.max(0, Math.min(M - 1, idx))
      const rawP = peaks[idx]
      const t = i / (BARS - 1)
      const bell = Math.sin(t * Math.PI) ** 0.65
      const p = rawP * bell
      const halfH = Math.max(2, p * wh / 2)
      const x0 = wx + i * (bw + gap), x1 = Math.min(wx + ww, x0 + bw)
      const barW = x1 - x0, r = Math.min(barW / 2, halfH)
      const g = ctx.createLinearGradient(0, midY - halfH, 0, midY + halfH)
      g.addColorStop(0, color + '44'); g.addColorStop(0.45, color + 'FF')
      g.addColorStop(0.55, color + 'FF'); g.addColorStop(1, color + '44')
      ctx.fillStyle = g
      ctx.beginPath(); ctx.roundRect(x0, midY - halfH, barW, halfH * 2, r); ctx.fill()
    }
  },
}
