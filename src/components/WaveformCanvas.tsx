import { useEffect, useRef, useCallback } from 'react'
import { convertFileSrc } from '@tauri-apps/api/core'
import { invoke } from '@tauri-apps/api/core'
import { WaveStyle, Segment, LayoutTemplate, LayoutZones, DEFAULT_ZONES } from '../types'
import { WAVE_EFFECTS } from '../waves/registry'
import { WAVE_BARS, waveHeights } from '../waves/support'

interface Props {
  audioPath: string
  color: string
  bgColor: string
  waveStyle: WaveStyle
  title: string
  canvasRatio?: number
  segments?: Segment[]
  onPeaksReady?: (peaks: number[]) => void
  fontSize?: number
  fontName?: string
  karaokeEnabled?: boolean
  karaokeColor?: string
  layoutTemplate?: LayoutTemplate
  coverImagePath?: string
  subtitleColor?: string
  subtitleYPct?: number | null
  zones?: LayoutZones | null
  titleColor?:      string
  titleAlign?:      'left' | 'center' | 'right'
  titleBold?:       boolean
  titleItalic?:     boolean
  subtitlePreview?: boolean
}

// ── Draw context passed to each layout function ───────────────────────────────
interface DC {
  ctx: CanvasRenderingContext2D
  W: number; H: number; t: number
  peaks: number[]
  color: string; bgColor: string; waveStyle: WaveStyle
  title: string; fontSize: number; fontName: string
  karaokeEnabled: boolean; karaokeColor: string
  activeSeg?: Segment; slotStart: number; slotDur: number; elapsed: number
  segments: Segment[]
  coverImg: HTMLImageElement | null
  waveTime: number; waveDur: number; waveLoop: boolean
  eqState: Float32Array
  fftPeaks: Float32Array | null
  fftBuckets: number
  subtitleColor: string
  subtitleYPct: number | null
  zones: LayoutZones | null
  layoutTemplate: LayoutTemplate
  titleColor: string
  titleAlign: 'left' | 'center' | 'right'
  titleBold: boolean
  titleItalic: boolean
  subtitlePreview: boolean
}

// Effective zones for a given DC (zone override or layout default)
function getZ(dc: DC): LayoutZones {
  return dc.zones ?? DEFAULT_ZONES[dc.layoutTemplate]
}

const WAVE_BPS  = 120
// WAVE_BARS + waveHeights live in ../waves/support (shared with the effect plugins)

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let cur = ''
  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word
    if (cur && ctx.measureText(test).width > maxW) { lines.push(cur); cur = word }
    else cur = test
  }
  if (cur) lines.push(cur)
  return lines.slice(0, 2)
}

// ── Waveform helper ───────────────────────────────────────────────────────────

// ── Waveform dispatcher ───────────────────────────────────────────────────────
// Builds a WaveDrawCtx from the canvas DC + rect and hands off to the selected
// effect plugin. Each style lives in its own file under ../waves/.
function drawWaveform(dc: DC, wx: number, wy: number, ww: number, wh: number) {
  if (dc.peaks.length === 0) return
  WAVE_EFFECTS[dc.waveStyle].draw({
    ctx: dc.ctx,
    color: dc.color,
    peaks: dc.peaks,
    heights: waveHeights(dc.peaks, dc.waveTime, dc.waveDur, dc.waveLoop),
    waveTime: dc.waveTime,
    waveDur: dc.waveDur,
    waveLoop: dc.waveLoop,
    eqState: dc.eqState,
    fftPeaks: dc.fftPeaks,
    fftBuckets: dc.fftBuckets,
    wx, wy, ww, wh,
  })
}

// ── Avatar helper ─────────────────────────────────────────────────────────────

function drawAvatar(dc: DC, cx: number, cy: number, r: number) {
  const { ctx, color } = dc
  ctx.save()
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip()
  if (dc.coverImg) {
    const img = dc.coverImg
    const scale = Math.max((r * 2) / img.width, (r * 2) / img.height)
    const dw = img.width * scale, dh = img.height * scale
    ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh)
  } else {
    const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r)
    g.addColorStop(0, '#EC4FC4'); g.addColorStop(1, color)
    ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
  }
  ctx.restore()
  ctx.beginPath(); ctx.arc(cx, cy, r + 2, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2; ctx.stroke()
}

// ── Text helpers ──────────────────────────────────────────────────────────────

function drawTitle(dc: DC, yCenter: number, maxW?: number, xCenter?: number) {
  if (!dc.title) return
  const { ctx, W, H, fontSize, fontName, titleColor, titleAlign, titleBold, titleItalic } = dc
  const fs = Math.round(H * 0.058 * (fontSize / 100))
  const weight = titleBold ? '700' : '400'
  const style  = titleItalic ? 'italic ' : ''
  ctx.font = `${style}${weight} ${fs}px '${fontName}', Arial, sans-serif`
  ctx.fillStyle = titleColor
  ctx.textAlign = titleAlign
  const mw = maxW ?? W * 0.84
  let cx: number
  if (xCenter !== undefined) {
    cx = xCenter
  } else if (titleAlign === 'left') {
    cx = (W - mw) / 2
  } else if (titleAlign === 'right') {
    cx = (W + mw) / 2
  } else {
    cx = W / 2
  }
  const lines = wrapText(ctx, dc.title, mw)
  const lineH = fs * 1.4
  const totalH = lines.length * lineH
  const startY = yCenter - totalH / 2 + fs * 0.85
  lines.forEach((line, i) => ctx.fillText(line, cx, startY + i * lineH, mw))
}

function drawSubtitle(dc: DC, defaultBoxY: number) {
  const seg = dc.activeSeg ?? (dc.subtitlePreview ? { id: -1, start: 0, end: 99999, text: 'Subtitle text…' } : undefined)
  if (!seg) return
  const subZone = getZ(dc).subtitle
  const boxY = subZone
    ? dc.H * subZone.y
    : dc.subtitleYPct !== null
      ? dc.H * dc.subtitleYPct
      : defaultBoxY
  const { ctx, W, H, fontName, fontSize, karaokeEnabled, karaokeColor, color, subtitleColor } = dc
  const text = seg.text.trim()
  const subFs = Math.round(H * 0.046 * (fontSize / 100))
  ctx.font = `700 ${subFs}px '${fontName}', Arial, sans-serif`
  const padX = W * 0.038, padY = H * 0.012
  const maxTW = W * 0.80
  const lines = wrapText(ctx, text, maxTW)
  const lineH = subFs * 1.35
  const maxLineW = Math.max(...lines.map(l => ctx.measureText(l).width))
  const boxW = Math.min(maxLineW + padX * 2, W * 0.88)
  const boxH = lines.length * lineH + padY * 2
  const boxX = (W - boxW) / 2
  const fp = dc.slotDur > 0 ? Math.min(Math.max((dc.elapsed - dc.slotStart) / dc.slotDur, 0), 1) : 1
  const FADE = 0.12
  const fade = fp < FADE ? fp / FADE : fp > 1 - FADE ? (1 - fp) / FADE : 1
  const slideY = fp < 0.18 ? H * 0.026 * (1 - fp / 0.18) : 0
  ctx.save()
  ctx.globalAlpha = Math.max(0, fade)
  ctx.translate(0, slideY)
  ctx.fillStyle = 'rgba(0,0,0,0.65)'
  ctx.beginPath(); ctx.roundRect(boxX, boxY, boxW, boxH, Math.min(boxH / 3, subFs * 0.45)); ctx.fill()
  if (karaokeEnabled) {
    const progress = fp
    lines.forEach((line, li) => {
      const textY = boxY + padY + subFs * 0.85 + li * lineH
      const lw = Math.min(ctx.measureText(line).width, maxTW)
      ctx.fillStyle = 'rgba(255,255,255,0.28)'
      ctx.textAlign = 'center'; ctx.fillText(line, W / 2, textY, maxTW)
      ctx.save()
      ctx.beginPath(); ctx.rect(W / 2 - lw / 2, boxY, lw * progress, boxH + 2); ctx.clip()
      ctx.fillStyle = karaokeColor; ctx.fillText(line, W / 2, textY, maxTW)
      ctx.restore()
    })
    const lw = Math.min(ctx.measureText(lines[0]).width, maxTW)
    ctx.fillStyle = karaokeColor; ctx.globalAlpha = Math.max(0, fade) * 0.7
    ctx.beginPath(); ctx.roundRect(W / 2 - lw / 2, boxY + boxH + 3, lw * fp, 3, 2); ctx.fill()
  } else {
    lines.forEach((line, li) => {
      const textY = boxY + padY + subFs * 0.85 + li * lineH
      ctx.fillStyle = subtitleColor; ctx.textAlign = 'center'; ctx.fillText(line, W / 2, textY, maxTW)
    })
    ctx.fillStyle = color
    ctx.beginPath(); ctx.roundRect(W / 2 - boxW * 0.2, boxY + boxH + 4, boxW * 0.4, 3, 2); ctx.fill()
  }
  ctx.restore()
}

function drawWatermark(dc: DC) {
  const { ctx, W, H } = dc
  ctx.font = `400 ${Math.round(H * 0.026)}px Inter, system-ui, sans-serif`
  ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.textAlign = 'center'
  ctx.fillText('audiogram', W / 2, H * 0.96)
}

function drawBg(dc: DC) {
  const { ctx, W, H, bgColor } = dc
  ctx.fillStyle = bgColor; ctx.fillRect(0, 0, W, H)
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, 'rgba(0,0,0,0.22)'); g.addColorStop(1, 'rgba(0,0,0,0.50)')
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
}

// ── 6 Layout render functions ─────────────────────────────────────────────────

function drawSpotify(dc: DC) {
  const { ctx, W, H } = dc
  drawBg(dc)
  const z = getZ(dc)
  const az = z.avatar ?? DEFAULT_ZONES.spotify.avatar!
  const tz = z.title
  const wz = z.waveform

  const avCx = W * (az.x + az.w / 2)
  const avCy = H * (az.y + az.h / 2)
  const avR  = Math.min(W * az.w, H * az.h) / 2

  const glow = ctx.createRadialGradient(avCx, avCy, 0, avCx, avCy, avR * 1.6)
  glow.addColorStop(0, dc.color + '44'); glow.addColorStop(1, 'transparent')
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(avCx, avCy, avR * 1.6, 0, Math.PI * 2); ctx.fill()

  drawAvatar(dc, avCx, avCy, avR)
  drawTitle(dc, H * (tz.y + tz.h / 2), W * tz.w)

  if (dc.title) {
    const fs = Math.round(H * 0.032)
    ctx.font = `400 ${fs}px '${dc.fontName}', Arial, sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.textAlign = 'center'
    ctx.fillText('Episode', W / 2, H * (tz.y + tz.h) + fs * 1.2)
  }

  drawWaveform(dc, W * wz.x, H * wz.y, W * wz.w, H * wz.h)
  drawSubtitle(dc, H * 0.85)
  drawWatermark(dc)
}

function drawSplit(dc: DC) {
  const { ctx, W, H } = dc
  ctx.fillStyle = dc.bgColor; ctx.fillRect(0, 0, W, H)
  const z = getZ(dc)
  const az = z.avatar ?? DEFAULT_ZONES.split.avatar!
  const tz = z.title
  const wz = z.waveform

  const leftW = W * az.w

  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, leftW, H); ctx.clip()
  if (dc.coverImg) {
    const img = dc.coverImg
    const scale = Math.max(leftW / img.width, H / img.height)
    ctx.drawImage(img, 0, 0, img.width * scale, img.height * scale)
  } else {
    const g = ctx.createLinearGradient(0, 0, leftW, H)
    g.addColorStop(0, '#3D1A6E'); g.addColorStop(1, '#1A0A3E')
    ctx.fillStyle = g; ctx.fillRect(0, 0, leftW, H)
    ctx.font = `${H * 0.22}px sans-serif`; ctx.textAlign = 'center'
    ctx.globalAlpha = 0.35; ctx.fillText('🎙', leftW / 2, H * 0.58); ctx.globalAlpha = 1
  }
  ctx.restore()

  const blendStart = leftW * 0.8
  const blend = ctx.createLinearGradient(blendStart, 0, leftW + W * 0.04, 0)
  blend.addColorStop(0, 'transparent'); blend.addColorStop(1, dc.bgColor)
  ctx.fillStyle = blend; ctx.fillRect(blendStart, 0, leftW + W * 0.04 - blendStart, H)

  const rightG = ctx.createLinearGradient(0, 0, 0, H)
  rightG.addColorStop(0, 'rgba(0,0,0,0.20)'); rightG.addColorStop(1, 'rgba(0,0,0,0.50)')
  ctx.fillStyle = rightG; ctx.fillRect(leftW, 0, W - leftW, H)

  const titleCx = W * (tz.x + tz.w / 2)
  drawTitle(dc, H * (tz.y + tz.h / 2), W * tz.w, titleCx)

  drawWaveform(dc, W * wz.x, H * wz.y, W * wz.w, H * wz.h)

  if (dc.activeSeg) {
    const text = dc.activeSeg.text.trim()
    const subFs = Math.round(H * 0.036)
    ctx.font = `600 ${subFs}px '${dc.fontName}', Arial, sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.textAlign = 'center'
    ctx.fillText(text, titleCx, H * 0.80, W * tz.w)
  }

  drawWatermark(dc)
}

function drawMinimal(dc: DC) {
  const { ctx, W, H } = dc
  ctx.fillStyle = dc.bgColor; ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1
  for (let i = 1; i < 8; i++) {
    ctx.beginPath(); ctx.moveTo(0, H * i / 8); ctx.lineTo(W, H * i / 8); ctx.stroke()
  }
  const z = getZ(dc)
  drawTitle(dc, H * (z.title.y + z.title.h / 2), W * z.title.w)
  drawWaveform(dc, W * z.waveform.x, H * z.waveform.y, W * z.waveform.w, H * z.waveform.h)
  drawSubtitle(dc, H * 0.74)
  drawWatermark(dc)
}

function drawFullBg(dc: DC) {
  const { ctx, W, H } = dc
  if (dc.coverImg) {
    const img = dc.coverImg
    const scale = Math.max(W / img.width, H / img.height)
    ctx.drawImage(img, W / 2 - img.width * scale / 2, 0, img.width * scale, img.height * scale)
    ctx.globalAlpha = 0.55
    ctx.drawImage(img, W / 2 - img.width * scale / 2, 0, img.width * scale, img.height * scale)
    ctx.globalAlpha = 1
  } else {
    ctx.fillStyle = dc.bgColor; ctx.fillRect(0, 0, W, H)
    const blob1 = ctx.createRadialGradient(W * 0.2, H * 0.25, 0, W * 0.2, H * 0.25, W * 0.45)
    blob1.addColorStop(0, '#EC4FC444'); blob1.addColorStop(1, 'transparent')
    ctx.fillStyle = blob1; ctx.fillRect(0, 0, W, H)
    const blob2 = ctx.createRadialGradient(W * 0.75, H * 0.55, 0, W * 0.75, H * 0.55, W * 0.5)
    blob2.addColorStop(0, dc.color + '44'); blob2.addColorStop(1, 'transparent')
    ctx.fillStyle = blob2; ctx.fillRect(0, 0, W, H)
  }
  ctx.fillStyle = 'rgba(0,0,0,0.50)'; ctx.fillRect(0, 0, W, H)

  const z = getZ(dc)
  const az = z.avatar ?? DEFAULT_ZONES.fullbg.avatar!
  const avCx = W * (az.x + az.w / 2)
  const avCy = H * (az.y + az.h / 2)
  const avR  = Math.min(W * az.w, H * az.h) / 2
  drawAvatar(dc, avCx, avCy, avR)
  drawTitle(dc, H * (z.title.y + z.title.h / 2))

  const darkG = ctx.createLinearGradient(0, H * 0.58, 0, H)
  darkG.addColorStop(0, 'transparent'); darkG.addColorStop(1, 'rgba(0,0,0,0.70)')
  ctx.fillStyle = darkG; ctx.fillRect(0, H * 0.58, W, H * 0.42)

  drawWaveform(dc, W * z.waveform.x, H * z.waveform.y, W * z.waveform.w, H * z.waveform.h)
  drawSubtitle(dc, H * 0.83)
  drawWatermark(dc)
}

function drawKaraoke(dc: DC) {
  const { ctx, W, H } = dc
  ctx.fillStyle = dc.bgColor; ctx.fillRect(0, 0, W, H)
  const z = getZ(dc)
  const tz = z.title
  const wz = z.waveform
  const textCenterY = H * (tz.y + tz.h / 2)

  const spot = ctx.createRadialGradient(W / 2, textCenterY, 0, W / 2, textCenterY, H * 0.38)
  spot.addColorStop(0, dc.color + '14'); spot.addColorStop(1, 'transparent')
  ctx.fillStyle = spot; ctx.fillRect(0, 0, W, H)

  if (dc.activeSeg) {
    const text = dc.activeSeg.text.trim()
    const bigFs = Math.round(H * 0.085 * (dc.fontSize / 100))
    ctx.font = `700 ${bigFs}px '${dc.fontName}', Arial, sans-serif`
    ctx.textAlign = 'center'
    const maxW = W * tz.w
    const lines = wrapText(ctx, text, maxW)
    const lineH = bigFs * 1.4
    const totalH = lines.length * lineH
    const startY = textCenterY - totalH / 2 + bigFs * 0.85
    const fp = dc.slotDur > 0 ? Math.min(Math.max((dc.elapsed - dc.slotStart) / dc.slotDur, 0), 1) : 1
    const FADE = 0.10
    const fade = fp < FADE ? fp / FADE : fp > 1 - FADE ? (1 - fp) / FADE : 1
    const slideY = fp < 0.20 ? H * 0.032 * (1 - fp / 0.20) : 0
    ctx.save()
    ctx.globalAlpha = Math.max(0, fade)
    ctx.translate(0, slideY)
    if (dc.karaokeEnabled) {
      const progress = fp
      lines.forEach((line, i) => {
        const y = startY + i * lineH
        const tw = ctx.measureText(line).width
        ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillText(line, W / 2, y, maxW)
        ctx.save()
        ctx.beginPath(); ctx.rect(W / 2 - tw / 2, y - bigFs, tw * progress, bigFs * 1.2); ctx.clip()
        ctx.fillStyle = dc.karaokeColor; ctx.fillText(line, W / 2, y, maxW)
        ctx.restore()
        ctx.fillStyle = dc.karaokeColor; ctx.globalAlpha = Math.max(0, fade) * 0.6
        ctx.beginPath(); ctx.roundRect(W / 2 - tw / 2, y + 4, tw * progress, 3, 2); ctx.fill()
        ctx.globalAlpha = Math.max(0, fade)
      })
    } else {
      ctx.fillStyle = '#FFFFFF'
      lines.forEach((line, i) => ctx.fillText(line, W / 2, startY + i * lineH, maxW))
    }
    ctx.globalAlpha = Math.max(0, fade) * 0.5
    ctx.font = `400 ${Math.round(bigFs * 0.62)}px '${dc.fontName}', Arial, sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillText('…', W / 2, H * (tz.y + tz.h) + bigFs * 0.5)
    ctx.restore()
  } else if (dc.title) {
    const fs = Math.round(H * 0.070 * (dc.fontSize / 100))
    ctx.font = `700 ${fs}px '${dc.fontName}', Arial, sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.textAlign = 'center'
    const lines = wrapText(ctx, dc.title, W * tz.w)
    const lineH = fs * 1.4
    lines.forEach((line, i) => ctx.fillText(line, W / 2, textCenterY - (lines.length * lineH) / 2 + fs * 0.85 + i * lineH))
  }

  // Progress bar
  ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.beginPath()
  ctx.roundRect(W * wz.x, H * (wz.y - 0.03), W * wz.w, 3, 2); ctx.fill()
  const progress = dc.slotDur > 0 ? (dc.elapsed - dc.slotStart) / dc.slotDur : 0
  ctx.fillStyle = dc.color; ctx.beginPath()
  ctx.roundRect(W * wz.x, H * (wz.y - 0.03), W * wz.w * Math.min(progress, 1), 3, 2); ctx.fill()

  drawWaveform(dc, W * wz.x, H * wz.y, W * wz.w, H * wz.h)
  drawWatermark(dc)
}

function drawBrand(dc: DC) {
  const { ctx, W, H } = dc
  ctx.fillStyle = dc.bgColor; ctx.fillRect(0, 0, W, H)
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, 'rgba(0,0,0,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0.45)')
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)

  const accentG = ctx.createLinearGradient(0, 0, 0, H)
  accentG.addColorStop(0, dc.color); accentG.addColorStop(1, '#EC4FC4')
  ctx.fillStyle = accentG; ctx.fillRect(0, 0, W * 0.012, H)

  const z = getZ(dc)
  const az = z.avatar ?? DEFAULT_ZONES.brand.avatar!
  const tz = z.title
  const wz = z.waveform

  const avCx = W * (az.x + az.w / 2)
  const avCy = H * (az.y + az.h / 2)
  const avR  = Math.min(W * az.w, H * az.h) / 2
  drawAvatar(dc, avCx, avCy, avR)

  // Title (left-aligned from title zone left edge)
  const titleX = W * tz.x
  const titleCx = W * (tz.x + tz.w / 2)
  const fs = Math.round(H * 0.058 * (dc.fontSize / 100))
  ctx.font = `700 ${fs}px '${dc.fontName}', Arial, sans-serif`
  ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.textAlign = 'left'
  if (dc.title) {
    const lines = wrapText(ctx, dc.title, W * tz.w)
    const lineH = fs * 1.4
    const startY = H * (tz.y + tz.h / 2) - (lines.length * lineH) / 2 + fs * 0.85
    lines.forEach((line, i) => ctx.fillText(line, titleX, startY + i * lineH, W * tz.w))
  }
  const epFs = Math.round(H * 0.032)
  ctx.font = `400 ${epFs}px '${dc.fontName}', Arial, sans-serif`
  ctx.fillStyle = dc.color; ctx.fillText('Now Playing', titleX, H * (tz.y + tz.h) + epFs * 0.6)

  // Divider at title zone right edge
  const divX = W * (tz.x + tz.w) + W * 0.02
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(divX, H * 0.10); ctx.lineTo(divX, H * 0.90); ctx.stroke()

  drawWaveform(dc, W * wz.x, H * wz.y, W * wz.w, H * wz.h)
  drawWatermark(dc)
  void titleCx // suppress unused warning
}

// ── Main component ────────────────────────────────────────────────────────────

export default function WaveformCanvas({
  audioPath, color, bgColor, waveStyle, title, canvasRatio = 1,
  segments = [], onPeaksReady, fontSize = 100, fontName = 'Arial',
  karaokeEnabled = false, karaokeColor = '#FFD60A',
  layoutTemplate = 'minimal', coverImagePath = '',
  subtitleColor = '#FFFFFF', subtitleYPct = null,
  zones = null,
  titleColor = '#FFFFFF', titleAlign = 'center', titleBold = false, titleItalic = false,
  subtitlePreview = false,
}: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const peaksRef     = useRef<number[]>([])
  const durationRef  = useRef<number>(0)
  const frameRef     = useRef<number>(0)
  const loadedRef    = useRef('')
  const coverImgRef  = useRef<HTMLImageElement | null>(null)
  const coverLoadRef = useRef('')
  const eqStateRef   = useRef<Float32Array>(new Float32Array(WAVE_BARS).fill(0))
  const fftPeaksRef  = useRef<Float32Array | null>(null)
  const fftBucketsRef = useRef<number>(0)

  useEffect(() => {
    if (!audioPath || audioPath === loadedRef.current) return
    loadedRef.current = audioPath
    invoke<{ bands: number[]; n_buckets: number; n_bands: number }>('analyze_spectrum', { audioPath })
      .then(({ bands, n_buckets }) => {
        fftPeaksRef.current = new Float32Array(bands)
        fftBucketsRef.current = n_buckets
      })
      .catch(() => {})
    fetch(convertFileSrc(audioPath))
      .then(r => r.arrayBuffer())
      .then(buf => new AudioContext().decodeAudioData(buf))
      .then(decoded => {
        const data = decoded.getChannelData(0)
        const M = Math.min(Math.max(Math.round(decoded.duration * WAVE_BPS), 64), 18000)
        const block = Math.max(1, Math.floor(data.length / M))
        let maxV = 1e-4
        const env = new Array<number>(M)
        for (let i = 0; i < M; i++) {
          let max = 0
          const base = i * block
          for (let j = 0; j < block; j++) { const v = Math.abs(data[base + j]); if (v > max) max = v }
          env[i] = max
          if (max > maxV) maxV = max
        }
        for (let i = 0; i < M; i++) env[i] = Math.pow(env[i] / maxV, 0.7)
        durationRef.current = decoded.duration
        peaksRef.current = env; onPeaksReady?.(env)
      })
      .catch(() => {
        const M = WAVE_BPS * 30
        const env = Array.from({ length: M }, (_, i) =>
          0.3 + 0.5 * Math.abs(Math.sin(i * 0.12)) * (0.6 + 0.4 * Math.abs(Math.sin(i * 0.031))))
        durationRef.current = 30
        peaksRef.current = env; onPeaksReady?.(env)
      })
  }, [audioPath])

  useEffect(() => {
    if (!coverImagePath) { coverImgRef.current = null; coverLoadRef.current = ''; return }
    if (coverImagePath === coverLoadRef.current) return
    coverLoadRef.current = coverImagePath
    const img = new Image()
    img.src = convertFileSrc(coverImagePath)
    img.onload = () => { coverImgRef.current = img }
    img.onerror = () => { coverImgRef.current = null }
  }, [coverImagePath])

  const draw = useCallback((ts: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width, H = canvas.height
    const t = ts / 1200

    ctx.clearRect(0, 0, W, H)

    const peaks = peaksRef.current
    const waveDur = durationRef.current > 0 ? durationRef.current : 30
    const waveTime = ts / 1000

    let activeSeg: Segment | undefined, slotStart = 0, slotDur = 0
    const elapsed = (ts / 1000) % waveDur
    if (segments.length > 0) {
      for (const seg of segments) {
        if (elapsed >= seg.start && elapsed < seg.end) {
          activeSeg = seg; slotStart = seg.start; slotDur = seg.end - seg.start; break
        }
      }
    }

    const dc: DC = {
      ctx, W, H, t, peaks, color, bgColor, waveStyle, title, fontSize, fontName,
      karaokeEnabled, karaokeColor, activeSeg, slotStart, slotDur, elapsed, segments,
      coverImg: coverImgRef.current, eqState: eqStateRef.current,
      fftPeaks: fftPeaksRef.current, fftBuckets: fftBucketsRef.current,
      waveTime, waveDur, waveLoop: true,
      subtitleColor, subtitleYPct,
      zones, layoutTemplate,
      titleColor, titleAlign, titleBold, titleItalic, subtitlePreview,
    }

    switch (layoutTemplate) {
      case 'spotify': drawSpotify(dc); break
      case 'split':   drawSplit(dc);   break
      case 'fullbg':  drawFullBg(dc);  break
      case 'karaoke': drawKaraoke(dc); break
      case 'brand':   drawBrand(dc);   break
      default:        drawMinimal(dc); break
    }

    frameRef.current = requestAnimationFrame(draw)
  }, [color, bgColor, waveStyle, title, segments, fontSize, fontName, karaokeEnabled, karaokeColor, layoutTemplate, subtitleColor, subtitleYPct, zones, titleColor, titleAlign, titleBold, titleItalic, subtitlePreview])

  useEffect(() => {
    frameRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frameRef.current)
  }, [draw])

  const LONG = 720
  const cvW = canvasRatio >= 1 ? LONG : Math.round(LONG * canvasRatio)
  const cvH = canvasRatio >= 1 ? Math.round(LONG / canvasRatio) : LONG

  return (
    <canvas
      ref={canvasRef}
      width={cvW}
      height={cvH}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}
