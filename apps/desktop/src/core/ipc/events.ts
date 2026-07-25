import { listen } from '@tauri-apps/api/event'
import type { useAppStore } from '../../store'

type Store = typeof useAppStore

/** Subscribes to the backend's global events exactly once (call from
 * main.tsx's bootstrap) and writes them straight into the store, instead of
 * every component that cares mounting its own `listen()` — which is what
 * caused the stale-closure bug fixed ad hoc in the old StepExport.tsx
 * (TECH_ARCHITECTURE.md §1.2 F3). Returns an unsubscribe function. */
export function attachIpcEvents(store: Store): () => void {
  const unsubs: (() => void)[] = []

  listen<string>('log', e => {
    store.setState(s => ({ logs: [...s.logs, e.payload] }))
  }).then(f => unsubs.push(f))

  listen<number>('render_progress', e => {
    store.setState({ progress: e.payload })
  }).then(f => unsubs.push(f))

  listen<{ name: string; percent: number }>('model_download_progress', e => {
    const { name, percent } = e.payload
    store.setState({ modelDownload: percent >= 100 ? null : { name, pct: percent } })
  }).then(f => unsubs.push(f))

  return () => unsubs.forEach(f => f())
}
