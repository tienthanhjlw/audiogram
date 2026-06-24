// `neon` — glowing bars (shadow glow + bright white core). Parity: effects/neon.rs
import type { WaveEffect } from './types'
import { WAVE_BARS } from './support'

export const neonEffect: WaveEffect = {
  id: 'neon',
  label: 'Neon',
  desc: 'Glow bars',
  draw({ ctx, color, heights, wx, wy, ww, wh }) {
    const N = WAVE_BARS
    const bw = ww * 0.64 / N, gap = ww * 0.36 / N
    const midY = wy + wh / 2
    ctx.save()
    ctx.shadowColor = color; ctx.shadowBlur = bw * 3.5; ctx.fillStyle = color
    heights.forEach((p, i) => {
      const bH = Math.max(4, p * wh)
      const x0 = wx + i * (bw + gap), x1 = Math.min(wx + ww, x0 + bw)
      const r = Math.min((x1 - x0) / 2, 3)
      ctx.beginPath(); ctx.roundRect(x0, midY - bH / 2, x1 - x0, bH, r); ctx.fill()
    })
    ctx.restore()
    heights.forEach((p, i) => {
      const bH = Math.max(4, p * wh)
      const x0 = wx + i * (bw + gap), x1 = Math.min(wx + ww, x0 + bw)
      const coreW = (x1 - x0) * 0.55, r = coreW / 2
      ctx.fillStyle = 'rgba(255,255,255,0.90)'
      ctx.beginPath(); ctx.roundRect(x0 + (x1 - x0) * 0.225, midY - bH / 2, coreW, bH, r); ctx.fill()
    })
  },
}
