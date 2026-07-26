// Wraps Tauri's webview drag-and-drop event so features/start/DropZone.tsx
// (and anything else that needs it later) never imports `@tauri-apps/api`
// directly (TECH_ARCHITECTURE.md §2.3) — same boundary as client.ts/events.ts,
// just for a webview-level event instead of a command/app event.
import { getCurrentWebview } from '@tauri-apps/api/webview'

export type FileDropEvent =
  | { type: 'enter'; paths: string[] }
  | { type: 'over' }
  | { type: 'drop'; paths: string[] }
  | { type: 'leave' }

/** Subscribes to file drag/drop over the whole window. Returns an
 * unsubscribe function usable immediately even though the underlying
 * `onDragDropEvent` call is async (a synchronous cleanup function is what
 * React's `useEffect` needs back). */
export function onFileDrop(cb: (event: FileDropEvent) => void): () => void {
  let unlisten: (() => void) | null = null
  let cancelled = false

  getCurrentWebview()
    .onDragDropEvent(e => cb(e.payload))
    .then(fn => {
      if (cancelled) fn()
      else unlisten = fn
    })
    .catch(() => { /* no webview (e.g. plain Vite dev preview) — no-op */ })

  return () => {
    cancelled = true
    unlisten?.()
  }
}
