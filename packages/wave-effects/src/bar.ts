// `bar` — capsule bars with gradient. Default style. Parity: effects/bar.rs
import type { WaveEffect } from './types'
import { WAVE_BARS } from './support'
import { BAR_FILL, GAP_FILL } from '@audiogram/contract'

export const barEffect: WaveEffect = {
  id: 'bar',
  label: 'Bars',
  desc: 'Vertical bars',
  draw({ ctx, color, heights, wx, wy, ww, wh }) {
    const N = WAVE_BARS
    const bw = ww * BAR_FILL / N, gap = ww * GAP_FILL / N
    const midY = wy + wh / 2
    heights.forEach((p, i) => {
      const bH = Math.max(4, p * wh)
      const x0 = wx + i * (bw + gap), x1 = Math.min(wx + ww, x0 + bw)
      const barW = x1 - x0
      const y0 = midY - bH / 2, y1 = midY + bH / 2
      const r = Math.min(barW / 2, bH / 2)
      const g = ctx.createLinearGradient(0, y0, 0, y1)
      g.addColorStop(0, color + 'FF'); g.addColorStop(1, color + '55')
      ctx.fillStyle = g
      ctx.beginPath(); ctx.roundRect(x0, y0, barW, y1 - y0, r); ctx.fill()
    })
  },
}
