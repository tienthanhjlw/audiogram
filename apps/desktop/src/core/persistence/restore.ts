// Session auto-restore on launch (UI_REBUILD_PLAN.md §4.4, P4-T8) — the
// counterpart to attach.ts's save side. Kept in its own file rather than
// folded into attach.ts since it runs exactly once, before the first
// render, rather than on every store change.
import type { useAppStore } from '../../store'
import type { SessionFile } from './migrations'
import { audioFileExists, loadSession } from './SessionRepository'

type Store = typeof useAppStore
type State = ReturnType<Store['getState']>

/** Maps a persisted session onto the store's flat shape — the inverse of
 * attach.ts's toSessionFile(). Exported so the "locate missing file" dialog
 * (features/start/PendingSessionLocate.tsx) can apply the same session
 * after the user re-links audioPath, instead of only restoring
 * audioPath/audioName/title like RecentGrid's flow does. */
export function sessionToPatch(session: SessionFile): Partial<State> {
  return {
    audioPath: session.project.audioPath,
    audioName: session.project.audioName,
    title: session.project.title,
    layoutTemplate: session.design.layoutTemplate,
    waveStyle: session.design.waveStyle,
    waveColor: session.design.waveColor,
    bgColor: session.design.bgColor,
    coverImagePath: session.design.coverImagePath,
    zones: session.design.zones,
    titleColor: session.design.titleColor,
    titleAlign: session.design.titleAlign,
    titleBold: session.design.titleBold,
    titleItalic: session.design.titleItalic,
    fontSize: session.design.fontSize,
    fontName: session.design.fontName,
    nodes: session.design.nodes ?? [],
    segments: session.captions.segments,
    srtPath: session.captions.srtPath,
    showSubtitles: session.captions.showSubtitles,
    whisperModel: session.captions.whisperModel,
    karaokeEnabled: session.captions.karaokeEnabled,
    karaokeColor: session.captions.karaokeColor,
    subtitleColor: session.captions.subtitleColor,
    subtitleYPct: session.captions.subtitleYPct,
    screen: 'studio',
  }
}

/** Awaited once from main.tsx before the first render, so there's no
 * START-screen flash: if session.json points at an audio file that still
 * exists, restores straight into Studio; if the file is gone, stashes the
 * session on the store (`pendingMissingSession`) for
 * PendingSessionLocate.tsx to offer the same Locate-File flow as a missing
 * Recent — rather than silently falling back to an empty START screen. */
export async function restoreLastSession(store: Store): Promise<void> {
  const session = await loadSession()
  if (!session) return

  const exists = await audioFileExists(session.project.audioPath)
  if (!exists) {
    store.getState().set({ pendingMissingSession: session })
    return
  }
  store.getState().set(sessionToPatch(session))
}
