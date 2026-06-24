// `player` — media player style: amplitude texture + progress fill + play triangle + time text
import type { WaveEffect } from './types'
import { WAVE_BARS } from './support'

export const playerEffect: WaveEffect = {
  id: 'player',
  label: 'Player',
  desc: 'Media player',
  draw({ ctx, color, peaks, heights, waveTime, waveDur, wx, wy, ww, wh }) {
    const N = WAVE_BARS
    const bw = ww * 0.64 / N
    const gap = ww * 0.36 / N
    const midY = wy + wh / 2

    // progress 0–1
    const progress = waveDur > 0 ? Math.min(1, waveTime / waveDur) : 0

    // Background amplitude bars (dim)
    heights.forEach((p, i) => {
      const bH = Math.max(3, p * wh * 0.7)
      const x0 = wx + i * (bw + gap)
      const barW = Math.min(wx + ww - x0, bw)
      const y0 = midY - bH / 2
      ctx.fillStyle = color + '28'
      ctx.beginPath(); ctx.roundRect(x0, y0, barW, bH, 2); ctx.fill()
    })

    // Progress fill: draw bars with full color up to progress point
    const fillX = wx + ww * progress
    ctx.save()
    ctx.beginPath(); ctx.rect(wx, wy, fillX - wx, wh); ctx.clip()
    heights.forEach((p, i) => {
      const bH = Math.max(3, p * wh * 0.7)
      const x0 = wx + i * (bw + gap)
      const barW = Math.min(wx + ww - x0, bw)
      const y0 = midY - bH / 2
      const g = ctx.createLinearGradient(0, y0, 0, y0 + bH)
      g.addColorStop(0, color + 'FF'); g.addColorStop(1, color + '88')
      ctx.fillStyle = g
      ctx.beginPath(); ctx.roundRect(x0, y0, barW, bH, 2); ctx.fill()
    })
    ctx.restore()

    // Thin progress scrubber line
    ctx.fillStyle = color
    ctx.fillRect(fillX - 1, wy, 2, wh)

    // Play triangle at left edge
    const triH = wh * 0.38
    const triX = wx - triH * 1.2
    ctx.fillStyle = color + 'CC'
    ctx.beginPath()
    ctx.moveTo(triX, midY - triH / 2)
    ctx.lineTo(triX + triH * 0.85, midY)
    ctx.lineTo(triX, midY + triH / 2)
    ctx.closePath()
    ctx.fill()

    // Time text: elapsed / total (right edge)
    const fmtTime = (s: number) => {
      const m = Math.floor(s / 60)
      const sec = Math.floor(s % 60)
      return `${m}:${String(sec).padStart(2, '0')}`
    }
    const elapsed = waveDur * progress
    const timeStr = `${fmtTime(elapsed)} / ${fmtTime(waveDur)}`
    const fs = Math.max(10, wh * 0.35)
    ctx.font = `600 ${fs}px monospace`
    ctx.fillStyle = color + 'CC'
    ctx.textAlign = 'right'
    ctx.fillText(timeStr, wx + ww, midY + fs * 0.35)

    void peaks // unused but part of API
    void N
  },
}
