// Session file schema + migrations — TECH_ARCHITECTURE.md §2.5. Kept
// deliberately narrow (project + design + captions only, matching
// PHASE2_TASKS.md T4's partialize scope) rather than dumping the whole
// store: playback/render/ui are transient/derived and would be actively
// wrong to restore (e.g. `isRendering: true` from a session that ended
// mid-render).
import type { LayoutTemplate, LayoutZones, SceneNode, Segment, WaveStyle } from '../../types'
import { buildNodesFromLegacy } from '../../domain/scene/fromLegacy'

export interface SessionProject {
  audioPath: string
  audioName: string
  title: string
}

export interface SessionDesign {
  layoutTemplate: LayoutTemplate
  waveStyle: WaveStyle
  waveColor: string
  bgColor: string
  coverImagePath: string
  zones: LayoutZones | null
  titleColor: string
  titleAlign: 'left' | 'center' | 'right'
  titleBold: boolean
  titleItalic: boolean
  fontSize: number
  fontName: string
  /** Scene graph (Phase 5 T6). Absent on any session saved before this field
   * existed — `migrate()` backfills it via `buildNodesFromLegacy` from the
   * rest of this object's fields, so every `SessionFile` this function
   * returns always has a real array here, never undefined. */
  nodes?: SceneNode[]
}

export interface SessionCaptions {
  segments: Segment[]
  srtPath: string
  showSubtitles: boolean
  whisperModel: string
  karaokeEnabled: boolean
  karaokeColor: string
  subtitleColor: string
  subtitleYPct: number | null
}

export interface SessionFileV1 {
  version: 1
  savedAt: string
  project: SessionProject
  design: SessionDesign
  captions: SessionCaptions
}

/** Current schema version — bump and add a migration step below when a
 * persisted field changes shape or meaning. */
export type SessionFile = SessionFileV1
export const CURRENT_SESSION_VERSION = 1

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

/** Validates + migrates a raw parsed JSON value up to the current schema.
 * Returns null (never throws) on anything unrecognizable — a corrupt or
 * hand-edited session.json must not crash the app; it should just behave
 * like there was no session to restore (PHASE2_TASKS.md T4 step 2). */
export function migrate(raw: unknown): SessionFile | null {
  if (!isRecord(raw)) return null
  if (raw.version === 1) {
    if (!isRecord(raw.project) || !isRecord(raw.design) || !isRecord(raw.captions)) return null
    if (typeof raw.savedAt !== 'string') return null
    const session = raw as unknown as SessionFileV1
    // Phase 5 T6 — backfill `nodes` for any session saved before this field
    // existed. Only runs when `design.nodes` isn't already a real array, so
    // re-migrating an already-backfilled session (which now has `nodes`
    // from having been saved once via attach.ts) is a no-op — idempotent,
    // not "regenerate every load". Returns a *new* object rather than
    // mutating `raw`/`session` in place — this function's caller may hold
    // other references to the same input (e.g. a shared test fixture), and
    // migrate() must not have side effects on it.
    if (Array.isArray(session.design.nodes)) return session
    return {
      ...session,
      design: {
        ...session.design,
        nodes: buildNodesFromLegacy({
          layoutTemplate: session.design.layoutTemplate,
          zones: session.design.zones,
          waveStyle: session.design.waveStyle,
          waveColor: session.design.waveColor,
          title: session.project.title,
          titleColor: session.design.titleColor,
          titleAlign: session.design.titleAlign,
          titleBold: session.design.titleBold,
          titleItalic: session.design.titleItalic,
          fontName: session.design.fontName,
          fontSize: session.design.fontSize,
          coverImagePath: session.design.coverImagePath,
          showSubtitles: session.captions.showSubtitles,
          subtitleColor: session.captions.subtitleColor,
        }),
      },
    }
  }
  // No earlier version exists yet — an unrecognized `version` (including
  // one from a future app version this build predates) is untrusted input.
  return null
}
