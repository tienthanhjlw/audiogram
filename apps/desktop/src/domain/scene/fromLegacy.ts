// Pure builder: legacy per-field design/caption state → equivalent SceneNode[]
// (P5-T6). Used by core/persistence/migrations.ts to backfill `nodes` for
// sessions saved before Phase 5, and directly by callers who just want "what
// would the node graph look like for the current legacy fields" without a
// round-trip through session.json.
import { DEFAULT_ZONES } from '../../types'
import type { LayoutTemplate, LayoutZones, SceneNode, TextAlign } from '../../types'

/** Everything buildNodesFromLegacy needs — a subset of the store's flat
 * shape (design.slice + captions.slice + project.slice's `title`), named the
 * same as the store fields so a caller can just pass `useAppStore.getState()`. */
export interface LegacySceneInput {
  layoutTemplate: LayoutTemplate
  zones: LayoutZones | null
  waveStyle: string
  waveColor: string
  title: string
  titleColor: string
  titleAlign: TextAlign
  titleBold: boolean
  titleItalic: boolean
  fontName: string
  fontSize: number
  coverImagePath: string
  showSubtitles: boolean
  subtitleColor: string
}

let nextId = 0
/** Deterministic-enough ids for a one-shot legacy→node conversion — not
 * meant to survive re-derivation (migrations.ts only calls this once per
 * session load, when `nodes` is absent). */
function makeId(prefix: string): string {
  nextId += 1
  return `${prefix}-legacy-${nextId}`
}

/** Builds the node graph equivalent to the given legacy field values —
 * waveform + title always, avatar image node when the layout has one and a
 * cover image is set, and a caption text node (bound to the live transcript
 * segment, same as the legacy subtitle box) when captions are enabled and
 * the layout defines a subtitle zone. */
export function buildNodesFromLegacy(state: LegacySceneInput): SceneNode[] {
  const zones = state.zones ?? DEFAULT_ZONES[state.layoutTemplate]
  const nodes: SceneNode[] = []

  nodes.push({
    id: makeId('waveform'),
    type: 'waveform',
    transform: { x: zones.waveform.x, y: zones.waveform.y, w: zones.waveform.w, h: zones.waveform.h, rotation: 0, opacity: 1 },
    z: 0,
    props: { type: 'waveform', style: state.waveStyle, color: state.waveColor },
  })

  if (state.title) {
    nodes.push({
      id: makeId('title'),
      type: 'text',
      transform: { x: zones.title.x, y: zones.title.y, w: zones.title.w, h: zones.title.h, rotation: 0, opacity: 1 },
      z: 1,
      props: {
        type: 'text',
        text: state.title,
        role: 'title',
        boundToTranscript: false,
        color: state.titleColor,
        font: state.fontName,
        size: 1080 * 0.058 * (state.fontSize / 100),
        align: state.titleAlign,
        bold: state.titleBold,
        italic: state.titleItalic,
      },
    })
  }

  if (zones.avatar && state.coverImagePath) {
    nodes.push({
      id: makeId('avatar'),
      type: 'image',
      transform: { x: zones.avatar.x, y: zones.avatar.y, w: zones.avatar.w, h: zones.avatar.h, rotation: 0, opacity: 1 },
      z: -1,
      props: { type: 'image', src: state.coverImagePath, fit: 'cover', shape: 'circle' },
    })
  }

  if (state.showSubtitles && zones.subtitle) {
    nodes.push({
      id: makeId('caption'),
      type: 'text',
      transform: { x: zones.subtitle.x, y: zones.subtitle.y, w: zones.subtitle.w, h: zones.subtitle.h, rotation: 0, opacity: 1 },
      z: 2,
      props: {
        type: 'text',
        text: '',
        role: 'caption',
        boundToTranscript: true,
        color: state.subtitleColor,
        font: state.fontName,
        size: 1080 * 0.046 * (state.fontSize / 100),
        align: 'center',
        bold: true,
        italic: false,
      },
    })
  }

  return nodes
}
