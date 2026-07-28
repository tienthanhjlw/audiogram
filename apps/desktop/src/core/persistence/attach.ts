// Store ↔ SessionRepository seam (mirrors core/audio/bootstrap.ts's
// attachAudioEngine) — the one place that knows about both the store and
// persistence, so SessionRepository/migrations stay store-agnostic and
// independently testable (TECH_ARCHITECTURE.md §2.5).
import type { useAppStore } from '../../store'
import type { SessionFile } from './migrations'
import { pushRecent, saveSession } from './SessionRepository'

type Store = typeof useAppStore
type State = ReturnType<Store['getState']>

const DEBOUNCE_MS = 800

// Only these fields trigger a save — the rest of the store (playback,
// render, ui) is transient/derived (migrations.ts's header explains why
// it's excluded from the persisted shape).
const PERSISTED_FIELDS: (keyof State)[] = [
  'audioPath', 'audioName', 'title',
  'layoutTemplate', 'waveStyle', 'waveColor', 'bgColor', 'coverImagePath', 'zones',
  'titleColor', 'titleAlign', 'titleBold', 'titleItalic', 'fontSize', 'fontName', 'nodes',
  'segments', 'srtPath', 'showSubtitles', 'whisperModel', 'karaokeEnabled',
  'karaokeColor', 'subtitleColor', 'subtitleYPct',
]

function toSessionFile(state: State): SessionFile {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    project: { audioPath: state.audioPath, audioName: state.audioName, title: state.title },
    design: {
      layoutTemplate: state.layoutTemplate,
      waveStyle: state.waveStyle,
      waveColor: state.waveColor,
      bgColor: state.bgColor,
      coverImagePath: state.coverImagePath,
      zones: state.zones,
      titleColor: state.titleColor,
      titleAlign: state.titleAlign,
      titleBold: state.titleBold,
      titleItalic: state.titleItalic,
      fontSize: state.fontSize,
      fontName: state.fontName,
      nodes: state.nodes,
    },
    captions: {
      segments: state.segments,
      srtPath: state.srtPath,
      showSubtitles: state.showSubtitles,
      whisperModel: state.whisperModel,
      karaokeEnabled: state.karaokeEnabled,
      karaokeColor: state.karaokeColor,
      subtitleColor: state.subtitleColor,
      subtitleYPct: state.subtitleYPct,
    },
  }
}

/** Subscribes to the store, debounced 800ms, and writes session.json +
 * (once per distinct audioPath, not every keystroke) a recents.json entry.
 * Returns an unsubscribe function. Auto-restore on launch is Phase 4
 * (UI_REBUILD_PLAN.md §4.4) — this task only makes recents/session.json
 * exist and stay current; nothing reads them back into the store yet
 * except RecentGrid's own explicit "open this" click (P2-T5).
 *
 * `getThumbnail` is injected rather than imported directly: it lives in
 * features/preview/thumbnailer.ts, and core/ must not depend on features/
 * (eslint.config.js's import/no-restricted-paths) — main.tsx (the
 * composition root, which is allowed to import both) passes it in. */
export function attachSessionPersistence(
  store: Store,
  getThumbnail: () => string | null,
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  let lastRecentPath = ''

  const flush = () => {
    timer = null
    const state = store.getState()
    if (!state.audioPath) return

    void saveSession(toSessionFile(state))

    if (state.audioPath !== lastRecentPath) {
      lastRecentPath = state.audioPath
      void pushRecent({
        audioPath: state.audioPath,
        audioName: state.audioName,
        title: state.title,
        duration: state.duration,
        thumbnailPng: getThumbnail(),
        savedAt: new Date().toISOString(),
      })
    }
  }

  const scheduleSave = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(flush, DEBOUNCE_MS)
  }

  const unsubscribe = store.subscribe((state, prev) => {
    if (PERSISTED_FIELDS.some(k => state[k] !== prev[k])) scheduleSave()
  })

  return () => {
    unsubscribe()
    if (timer) clearTimeout(timer)
  }
}
