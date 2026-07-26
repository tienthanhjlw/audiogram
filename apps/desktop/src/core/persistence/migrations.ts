// Session file schema + migrations — TECH_ARCHITECTURE.md §2.5. Kept
// deliberately narrow (project + design + captions only, matching
// PHASE2_TASKS.md T4's partialize scope) rather than dumping the whole
// store: playback/render/ui are transient/derived and would be actively
// wrong to restore (e.g. `isRendering: true` from a session that ended
// mid-render).
import type { LayoutTemplate, LayoutZones, Segment, WaveStyle } from '../../types'

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
    return raw as unknown as SessionFileV1
  }
  // No earlier version exists yet — an unrecognized `version` (including
  // one from a future app version this build predates) is untrusted input.
  return null
}
