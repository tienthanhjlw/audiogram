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
    // `tick.duration` comes from `<audio>.duration`, which reads NaN (->0
    // from AudioEngine) until the element's own metadata has loaded — a
    // load in progress can fire a tick in that window (confirmed via a
    // native 'pause' event landing a couple ms after a fresh `load()`,
    // during manual testing). `load()`'s resolved envelope is the
    // authoritative duration and is written below; forwarding a 0/NaN tick
    // duration here would silently clobber it back to 0. Once the element's
    // metadata genuinely loads, its duration should agree with the decoded
    // one anyway, so just don't forward untrustworthy values.
    const { currentTime, playing, duration } = tick
    store.getState()._setFromEngine(duration > 0 ? { currentTime, playing, duration } : { currentTime, playing })
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
