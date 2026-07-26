// Template thumbnails + project snapshot — UI_DESIGN_SPEC.md §4.1 (card
// anatomy: "ảnh render thật", not hand-drawn SVG) and UI_REBUILD_PLAN.md
// mục 9-10 (finding A). Both render through the exact same `drawFrame` the
// live preview uses, so a thumbnail always matches what the template
// actually looks like — no separate hand-maintained preview art.
import { EQ_BANDS } from '@audiogram/contract'
import { fallbackEnvelope } from '../../core/audio/envelope'
import { drawFrame, type FrameSpec } from '../../domain/preview/renderer'
import { templatePoint } from '../../extensions'
import { useAppStore } from '../../store'
import { DEFAULT_ZONES, type LayoutTemplate, type WaveStyle } from '../../types'

const THUMB_W = 320 // 2x of the 160×90 card size in UI_DESIGN_SPEC.md §2.3/§4.1, for retina
const THUMB_H = 180

// Rendered once per template id, independent of any loaded audio
// (UI_DESIGN_SPEC.md §4.1: "render 1 lần sau khi app mount, không chờ
// audio") — cached for the app's lifetime since a template's defaults never
// change at runtime.
const templateThumbCache = new Map<string, string>()

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  return canvas
}

function baseSpec(overrides: Partial<FrameSpec> & Pick<FrameSpec, 'layoutTemplate' | 'color' | 'bgColor' | 'waveStyle' | 'peaks'>): FrameSpec {
  const waveDur = overrides.waveDur ?? 30
  return {
    t: 0,
    title: 'Your episode title',
    fontSize: 100,
    fontName: 'Arial',
    karaokeEnabled: false,
    karaokeColor: '#FFD60A',
    activeSeg: undefined,
    slotStart: 0,
    slotDur: 0,
    elapsed: 0,
    segments: [],
    coverImg: null,
    waveDur,
    waveTime: waveDur * 0.33,
    waveLoop: true,
    eqState: new Float32Array(EQ_BANDS),
    fftPeaks: null,
    fftBuckets: 0,
    subtitleColor: '#FFFFFF',
    subtitleYPct: null,
    zones: null,
    titleColor: '#FFFFFF',
    titleAlign: 'center',
    titleBold: false,
    titleItalic: false,
    subtitlePreview: false,
    ...overrides,
  }
}

/** Renders (and caches) one template's thumbnail: its own default wave
 * style/colors, a fixed deterministic fake waveform (the same fallback
 * envelope AudioEngine uses when a real decode fails), frozen at a fixed
 * point in time. Returns '' if the template isn't registered (extensions
 * not bootstrapped yet — see extensions/index.ts's registerBuiltins). */
export function renderTemplateThumb(templateId: LayoutTemplate): string {
  const cached = templateThumbCache.get(templateId)
  if (cached) return cached

  const ext = templatePoint.get(`com.audiogram.template.${templateId}`)
  if (!ext) return ''

  const canvas = makeCanvas(THUMB_W, THUMB_H)
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  const { peaks } = fallbackEnvelope()
  const spec = baseSpec({
    layoutTemplate: templateId,
    color: ext.defaults.waveColor,
    bgColor: ext.defaults.bgColor,
    waveStyle: ext.defaults.waveStyle as WaveStyle,
    peaks,
  })
  drawFrame(ctx, THUMB_W, THUMB_H, spec)
  const dataUrl = canvas.toDataURL('image/png')
  templateThumbCache.set(templateId, dataUrl)
  return dataUrl
}

/** Snapshot of the current project for the Recents grid (P2-T4). Uses the
 * live store state directly (not a hook — called on-demand after a debounce
 * elsewhere) and the project's real peaks. Returns null when there's no
 * audio decoded yet — nothing meaningful to snapshot. */
export function renderProjectThumb(): string | null {
  const s = useAppStore.getState()
  if (s.peaks.length === 0) return null

  const canvas = makeCanvas(THUMB_W, THUMB_H)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const effectiveZones = s.zones ?? DEFAULT_ZONES[s.layoutTemplate]
  const waveDur = s.duration > 0 ? s.duration : 30
  const spec = baseSpec({
    layoutTemplate: s.layoutTemplate,
    color: s.waveColor,
    bgColor: s.bgColor,
    waveStyle: s.waveStyle,
    peaks: s.peaks,
    title: s.title,
    fontSize: s.fontSize,
    fontName: s.fontName,
    karaokeColor: s.karaokeColor,
    subtitleColor: s.subtitleColor,
    subtitleYPct: s.subtitleYPct,
    zones: s.zones,
    titleColor: s.titleColor,
    titleAlign: s.titleAlign,
    titleBold: s.titleBold,
    titleItalic: s.titleItalic,
    waveDur,
    waveLoop: s.duration <= 0,
    subtitlePreview: !!effectiveZones.subtitle,
  })
  drawFrame(ctx, THUMB_W, THUMB_H, spec)
  return canvas.toDataURL('image/png')
}
