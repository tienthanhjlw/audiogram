import type { useAppStore } from '../../store'
import { audioEngine } from './AudioEngine'

type Store = typeof useAppStore

/** Wires AudioEngine into playback.slice, called once from main.tsx's
 * bootstrap (mirrors attachIpcEvents — TECH_ARCHITECTURE §2.6). This is the
 * only seam that knows about both the engine and the store, so AudioEngine
 * itself stays store-agnostic (core/ must not import store/ per
 * eslint.config.js's import/no-restricted-paths). Returns an unsubscribe
 * function. */
export function attachAudioEngine(store: Store): () => void {
  const untick = audioEngine.onTick(tick => {
    store.getState()._setFromEngine(tick)
  })

  const unsubscribeStore = store.subscribe((state, prev) => {
    if (state.audioPath === prev.audioPath) return
    if (!state.audioPath) return
    audioEngine.load(state.audioPath).then(({ peaks, duration }) => {
      store.getState()._setFromEngine({ peaks, duration })
    })
  })

  // Cover the case where audioPath is already set at attach time (e.g. a
  // restored session — not wired up until Phase 2's persistence, but cheap
  // to handle correctly now).
  const initialPath = store.getState().audioPath
  if (initialPath) {
    audioEngine.load(initialPath).then(({ peaks, duration }) => {
      store.getState()._setFromEngine({ peaks, duration })
    })
  }

  return () => {
    untick()
    unsubscribeStore()
  }
}
