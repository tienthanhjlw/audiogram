// Pure frame renderer — moved verbatim from components/WaveformCanvas.tsx
// (PHASE2_TASKS.md T2). Zero React, zero Tauri: these are the same 6 layout
// draw functions Rust's frame.rs must mirror geometry-for-geometry
// (CLAUDE.md's "Preview ↔ Export Parity" section) — living in domain/ makes
// that contract testable without mounting a canvas element, and is this
// module's eventual home once it moves to @audiogram/renderer (Phase 3,
// PACKAGE_SPLIT_PLAN.md §3.2 "đợt 3").
//
// One change from the original: `drawWatermark()` (the "audiogram" text
// stamped across every layout) was dropped, not moved. The Rust exporter
// never drew it (`grep -rn watermark crates src-tauri` = 0 hits before this
// change) — the preview was silently out of parity with the actual export
// output. Per UI_REBUILD_PLAN.md §1.3 ("bỏ... watermark 'audiogram' trên
// preview"), removing it here is fixing that drift, not a new design call.
import { WAVE_EFFECTS, waveHeights } from '@audiogram/wave-effects'
import { DEFAULT_ZONES, LayoutTemplate, LayoutZones, Segment, WaveStyle } from '../../types'

/** Everything `drawFrame` needs for one frame, other than the canvas itself. */
export interface FrameSpec {
  t: number
  peaks: number[]
  color: string
  bgColor: string
  waveStyle: WaveStyle
  title: string
  fontSize: number
  fontName: string
  karaokeEnabled: boolean
  karaokeColor: string
  activeSeg?: Segment
  slotStart: number
  slotDur: number
  elapsed: number
  segments: Segment[]
  coverImg: HTMLImageElement | null
  waveTime: number
  waveDur: number
  waveLoop: boolean
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

// Internal draw context — FrameSpec plus the canvas/size `drawFrame` owns.
interface DC extends FrameSpec {
  ctx: CanvasRenderingContext2D
  W: number
  H: number
}

// Effective zones for a given DC (zone override or layout default)
function getZ(dc: DC): LayoutZones {
  return dc.zones ?? DEFAULT_ZONES[dc.layoutTemplate]
}

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

// ── Waveform dispatcher ───────────────────────────────────────────────────────
// Builds a WaveDrawCtx from the canvas DC + rect and hands off to the selected
// effect plugin. Each style lives in its own file under @audiogram/wave-effects.
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
  void titleCx // suppress unused warning
}

/** Render one frame of the given layout template into `ctx`. The only entry
 * point this module exposes — WaveformCanvas.tsx's adapter and
 * features/preview/thumbnailer.ts (P2-T3) both call this. */
export function drawFrame(ctx: CanvasRenderingContext2D, W: number, H: number, spec: FrameSpec): void {
  const dc: DC = { ctx, W, H, ...spec }
  switch (dc.layoutTemplate) {
    case 'spotify': drawSpotify(dc); break
    case 'split':   drawSplit(dc);   break
    case 'fullbg':  drawFullBg(dc);  break
    case 'karaoke': drawKaraoke(dc); break
    case 'brand':   drawBrand(dc);   break
    default:        drawMinimal(dc); break
  }
}
