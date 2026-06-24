// `mirror` — symmetric capsule bars mirrored around the centre. Parity: effects/mirror.rs
import type { WaveEffect } from './types'
import { WAVE_BARS } from './support'

export const mirrorEffect: WaveEffect = {
  id: 'mirror',
  label: 'Mirror',
  desc: 'Symmetric',
  draw({ ctx, color, heights, wx, wy, ww, wh }) {
    const N = WAVE_BARS
    const bw = ww * 0.64 / N, gap = ww * 0.36 / N
    const midY = wy + wh / 2
    heights.forEach((p, i) => {
      const halfH = Math.max(3, p * wh / 2)
      const x0 = wx + i * (bw + gap), x1 = Math.min(wx + ww, x0 + bw)
      const y0 = midY - halfH, y1 = midY + halfH
      const g = ctx.createLinearGradient(0, y0, 0, y1)
      g.addColorStop(0, color + '30'); g.addColorStop(0.5, color + 'FF'); g.addColorStop(1, color + '30')
      ctx.fillStyle = g
      ctx.beginPath(); ctx.roundRect(x0, y0, x1 - x0, y1 - y0, Math.min((x1 - x0) / 2, halfH)); ctx.fill()
    })
  },
}
