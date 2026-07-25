// `orb` — radial visualiser: bars radiate from a centre ring. Parity: effects/orb.rs
import type { WaveEffect } from './types'
import { WAVE_BARS } from './support'

export const orbEffect: WaveEffect = {
  id: 'orb',
  label: 'Orbit',
  desc: 'Radial / circular',
  draw({ ctx, color, heights, wx, wy, ww, wh }) {
    const N = WAVE_BARS
    const cx = wx + ww / 2, cy = wy + wh / 2
    const R = Math.min(ww, wh) * 0.28
    const maxExt = (Math.min(ww, wh) / 2 - R) * 0.94
    const penW = Math.max(1.5, ww * 0.006)
    ctx.lineCap = 'round'
    heights.forEach((p, i) => {
      const angle = (i / N) * Math.PI * 2 - Math.PI / 2
      const ext = R * 0.04 + p * maxExt
      const cos = Math.cos(angle), sin = Math.sin(angle)
      const x0 = cx + cos * R, y0 = cy + sin * R
      const x1 = cx + cos * (R + ext), y1 = cy + sin * (R + ext)
      const g = ctx.createLinearGradient(x0, y0, x1, y1)
      g.addColorStop(0, color + '44'); g.addColorStop(0.5, color + 'BB'); g.addColorStop(1, '#FFFFFF')
      ctx.strokeStyle = g; ctx.lineWidth = penW
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke()
    })
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2)
    ctx.strokeStyle = color + '30'; ctx.lineWidth = 1.5; ctx.stroke()
  },
}
