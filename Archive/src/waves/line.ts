// `line` — connected amplitude polyline. Parity: effects/line.rs
import type { WaveEffect } from './types'
import { WAVE_BARS } from './support'

export const lineEffect: WaveEffect = {
  id: 'line',
  label: 'Wave',
  desc: 'Smooth curve',
  draw({ ctx, color, heights, wx, wy, ww, wh }) {
    const N = WAVE_BARS
    ctx.beginPath()
    ctx.strokeStyle = color; ctx.lineWidth = 2.5
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'
    heights.forEach((p, i) => {
      const x = wx + (i / (N - 1)) * ww
      const y = wy + wh / 2 - p * wh / 2
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    })
    ctx.stroke()
  },
}
