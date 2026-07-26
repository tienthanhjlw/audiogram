// Shared rAF scheduler for WaveMiniPreview.tsx — UI_DESIGN_SPEC.md §4.1: "1
// rAF loop chung cho tất cả instance". 9 wave style cards each running their
// own requestAnimationFrame would be 9 independent loops doing the same
// thing; this is one loop that fans out to every mounted card, and stops
// scheduling itself entirely (not just skipping draws) while the tab is
// hidden or the window loses focus.
type Tick = (ts: number) => void

const listeners = new Set<Tick>()
let rafId: number | null = null

function paused(): boolean {
  return document.hidden || !document.hasFocus()
}

function loop(ts: number) {
  if (paused() || listeners.size === 0) { rafId = null; return }
  listeners.forEach(cb => cb(ts))
  rafId = requestAnimationFrame(loop)
}

function ensureRunning() {
  if (rafId !== null || listeners.size === 0 || paused()) return
  rafId = requestAnimationFrame(loop)
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', ensureRunning)
  window.addEventListener('focus', ensureRunning)
}

/** Subscribe to the shared tick. Returns an unsubscribe function. */
export function subscribeWaveMiniTick(cb: Tick): () => void {
  listeners.add(cb)
  ensureRunning()
  return () => { listeners.delete(cb) }
}
