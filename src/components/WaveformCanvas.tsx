import { useEffect, useRef, useCallback } from 'react'
import { convertFileSrc } from '@tauri-apps/api/core'
import { WaveStyle, Segment } from '../types'

interface Props {
  audioPath: string
  color: string
  bgColor: string
  waveStyle: WaveStyle
  title: string
  canvasRatio?: number
  segments?: Segment[]
  onPeaksReady?: (peaks: number[]) => void
  fontSize?: number        // percentage 70–140, default 100
  fontName?: string        // "Arial" | "Georgia" | "Impact" | "Verdana"
  karaokeEnabled?: boolean
  karaokeColor?: string    // hex highlight color
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let cur = ''
  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word
    if (cur && ctx.measureText(test).width > maxWidth) {
      lines.push(cur)
      cur = word
    } else {
      cur = test
    }
  }
  if (cur) lines.push(cur)
  return lines.slice(0, 2)
}

export default function WaveformCanvas({
  audioPath, color, bgColor, waveStyle, title, canvasRatio = 1,
  segments = [], onPeaksReady, fontSize = 100, fontName = 'Arial',
  karaokeEnabled = false, karaokeColor = '#FFD60A',
}: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const peaksRef   = useRef<number[]>([])
  const frameRef   = useRef<number>(0)
  const loadedRef  = useRef('')

  // Decode audio → peaks
  useEffect(() => {
    if (!audioPath || audioPath === loadedRef.current) return
    loadedRef.current = audioPath

    fetch(convertFileSrc(audioPath))
      .then(r => r.arrayBuffer())
      .then(buf => new AudioContext().decodeAudioData(buf))
      .then(decoded => {
        const data = decoded.getChannelData(0)
        const N = 80
        const block = Math.floor(data.length / N)
        const peaks = Array.from({ length: N }, (_, i) => {
          let max = 0.02
          for (let j = 0; j < block; j++) {
            const v = Math.abs(data[i * block + j])
            if (v > max) max = v
          }
          return Math.min(max, 1)
        })
        peaksRef.current = peaks
        onPeaksReady?.(peaks)
      })
      .catch(() => {
        const peaks = Array.from({ length: 80 }, (_, i) =>
          0.25 + 0.55 * Math.abs(Math.sin(i * 0.35)) * (0.7 + 0.3 * Math.random())
        )
        peaksRef.current = peaks
        onPeaksReady?.(peaks)
      })
  }, [audioPath])

  const draw = useCallback((ts: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width
    const H = canvas.height
    const t = ts / 1200

    ctx.clearRect(0, 0, W, H)

    // Background
    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, W, H)
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, 'rgba(0,0,0,0.25)')
    grad.addColorStop(1, 'rgba(0,0,0,0.55)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)

    const peaks = peaksRef.current.length > 0
      ? peaksRef.current
      : Array.from({ length: 80 }, (_, i) => 0.3 + 0.4 * Math.abs(Math.sin(i * 0.3)))

    const N = peaks.length
    // Waveform sits in middle 50% of canvas height, shifted up to make room for subtitle
    const hasSubtitle = segments.length > 0
    const waveAreaH = H * (hasSubtitle ? 0.42 : 0.52)
    const waveY = H * (hasSubtitle ? 0.22 : 0.24)

    if (waveStyle === 'bar') {
      const barW = (W * 0.64) / N
      const gap = (W * 0.36) / N
      peaks.forEach((peak, i) => {
        const anim = peak * (0.78 + 0.22 * Math.sin(t * 1.6 + i * 0.28))
        const bH = Math.max(4, anim * waveAreaH)
        const x = i * (barW + gap)
        const y = waveY + (waveAreaH - bH) / 2
        const g = ctx.createLinearGradient(0, y, 0, y + bH)
        g.addColorStop(0, color + 'FF')
        g.addColorStop(1, color + '55')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.roundRect(x, y, barW, bH, Math.min(barW / 2, 3))
        ctx.fill()
      })
    } else if (waveStyle === 'line') {
      ctx.beginPath()
      ctx.strokeStyle = color
      ctx.lineWidth = 2.5
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      peaks.forEach((peak, i) => {
        const anim = peak * (0.78 + 0.22 * Math.sin(t * 1.6 + i * 0.28))
        const x = (i / (N - 1)) * W
        const y = waveY + waveAreaH / 2 - anim * waveAreaH / 2
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      })
      ctx.stroke()
    } else {
      const barW = (W * 0.64) / N
      const gap  = (W * 0.36) / N
      peaks.forEach((peak, i) => {
        const anim   = peak * (0.78 + 0.22 * Math.sin(t * 1.6 + i * 0.28))
        const halfH  = Math.max(3, anim * waveAreaH / 2)
        const x      = i * (barW + gap)
        const midY   = waveY + waveAreaH / 2
        const g = ctx.createLinearGradient(0, midY - halfH, 0, midY + halfH)
        g.addColorStop(0, color + '30')
        g.addColorStop(0.5, color + 'FF')
        g.addColorStop(1, color + '30')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.roundRect(x, midY - halfH, barW, halfH * 2, Math.min(barW / 2, 2))
        ctx.fill()
      })
    }

    // Title — word-wrapped, selected font & size
    if (title) {
      const fs = Math.round(H * 0.058 * (fontSize / 100))
      ctx.font = `700 ${fs}px '${fontName}', Arial, sans-serif`
      ctx.fillStyle = 'rgba(255,255,255,0.95)'
      ctx.textAlign = 'center'
      const maxW = W * 0.84
      const lines = wrapText(ctx, title, maxW)
      const lineH = fs * 1.4
      const totalH = lines.length * lineH
      const centerY = H * 0.11
      const startY  = centerY - totalH / 2 + fs * 0.85 // baseline offset
      lines.forEach((line, i) => {
        ctx.fillText(line, W / 2, startY + i * lineH)
      })
    }

    // ── Subtitle / Karaoke preview ──
    if (segments.length > 0) {
      const cycleSeconds = 30
      const elapsed = (ts / 1000) % cycleSeconds
      const totalDur = segments.reduce((s, seg) => s + (seg.end - seg.start), 0)
      const scale = totalDur > 0 ? cycleSeconds / totalDur : 1

      let acc = 0
      let activeSeg: Segment | undefined
      let slotStart = 0
      let slotDur = 0
      for (const seg of segments) {
        const dur = (seg.end - seg.start) * scale
        if (elapsed >= acc && elapsed < acc + dur) {
          activeSeg = seg; slotStart = acc; slotDur = dur; break
        }
        acc += dur
      }

      if (activeSeg) {
        const text = activeSeg.text.trim()
        const subFs = Math.round(H * 0.046)
        const subFont = `700 ${subFs}px '${fontName}', Arial, sans-serif`
        ctx.font = subFont

        const padX = W * 0.04, padY = H * 0.015
        const maxTW = W * 0.86
        const tw = Math.min(ctx.measureText(text).width, maxTW)
        const boxW = tw + padX * 2
        const boxH = subFs + padY * 2
        const boxX = (W - boxW) / 2
        const boxY = H * 0.74
        const textY = boxY + padY + subFs * 0.85

        // Pill background
        ctx.fillStyle = 'rgba(0,0,0,0.60)'
        ctx.beginPath()
        ctx.roundRect(boxX, boxY, boxW, boxH, boxH / 2)
        ctx.fill()

        if (karaokeEnabled) {
          // Draw dim (unlit) text
          ctx.fillStyle = 'rgba(255,255,255,0.30)'
          ctx.textAlign = 'center'
          ctx.fillText(text, W / 2, textY, maxTW)

          // Sweep clip from left → right based on segment progress
          const progress = slotDur > 0 ? Math.min((elapsed - slotStart) / slotDur, 1) : 0
          const clipW = tw * progress
          ctx.save()
          ctx.beginPath()
          ctx.rect(W / 2 - tw / 2, boxY, clipW, boxH + 2)
          ctx.clip()
          ctx.fillStyle = karaokeColor
          ctx.fillText(text, W / 2, textY, maxTW)
          ctx.restore()

          // Sweeping underline
          ctx.fillStyle = karaokeColor
          ctx.globalAlpha = 0.7
          ctx.beginPath()
          ctx.roundRect(W / 2 - tw / 2, boxY + boxH + 3, tw * progress, 3, 2)
          ctx.fill()
          ctx.globalAlpha = 1
        } else {
          // Plain subtitle
          ctx.fillStyle = '#FFFFFF'
          ctx.textAlign = 'center'
          ctx.fillText(text, W / 2, textY, maxTW)

          ctx.fillStyle = color
          ctx.beginPath()
          ctx.roundRect(W / 2 - boxW * 0.2, boxY + boxH + 4, boxW * 0.4, 3, 2)
          ctx.fill()
        }
      }
    }

    // Bottom watermark
    ctx.font = `400 ${Math.round(H * 0.028)}px Inter, system-ui, sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.textAlign = 'center'
    ctx.fillText('audiogram', W / 2, H * 0.94)

    frameRef.current = requestAnimationFrame(draw)
  }, [color, bgColor, waveStyle, title, segments, fontSize, fontName, karaokeEnabled, karaokeColor])

  useEffect(() => {
    frameRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frameRef.current)
  }, [draw])

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={Math.round(400 / canvasRatio)}
      style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 16, display: 'block' }}
    />
  )
}
