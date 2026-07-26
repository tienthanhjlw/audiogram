// `dot` — vertical dot-matrix columns, fading from centre. Parity: effects/dot.rs
import type { WaveEffect } from './types'
import { WAVE_BARS } from './support'
import { BAR_FILL, GAP_FILL } from '../domain/contract.gen'

export const dotEffect: WaveEffect = {
  id: 'dot',
  label: 'LED',
  desc: 'Dot matrix',
  draw({ ctx, color, heights, wx, wy, ww, wh }) {
    const N = WAVE_BARS
    const DOT_ROWS = 18
    const bw = ww * BAR_FILL / N, gap = ww * GAP_FILL / N
    const rowH = wh / DOT_ROWS
    const dotR = Math.max(1.2, Math.min(bw * 0.38, rowH * 0.42))
    heights.forEach((p, i) => {
      const cx = wx + i * (bw + gap) + bw * 0.5
      const active = Math.round(p * DOT_ROWS * 0.5)
      for (let r = 0; r < DOT_ROWS; r++) {
        const cy = wy + (r + 0.5) * rowH
        const dist = Math.abs(r - (DOT_ROWS - 1) / 2)
        if (dist <= active) {
          const intensity = 1 - dist / (DOT_ROWS / 2)
          ctx.fillStyle = color + Math.round(Math.max(0.1, intensity) * 255).toString(16).padStart(2, '0')
          ctx.beginPath(); ctx.arc(cx, cy, dotR, 0, Math.PI * 2); ctx.fill()
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.05)'
          ctx.beginPath(); ctx.arc(cx, cy, dotR * 0.7, 0, Math.PI * 2); ctx.fill()
        }
      }
    })
  },
}
