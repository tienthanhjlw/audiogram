import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

type ToastKind = 'info' | 'success' | 'error'
interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

const AUTO_DISMISS_MS = 4000

let nextId = 1
let items: ToastItem[] = []
const listeners = new Set<(items: ToastItem[]) => void>()

function emit() {
  for (const listener of listeners) listener(items)
}

// Module-level singleton manager — call from anywhere, no provider/context
// needed. UI_DESIGN_SPEC.md §8.7.
export const toast = {
  show(kind: ToastKind, message: string) {
    const id = nextId++
    items = [...items, { id, kind, message }]
    emit()
    setTimeout(() => {
      items = items.filter(i => i.id !== id)
      emit()
    }, AUTO_DISMISS_MS)
    return id
  },
  info: (message: string) => toast.show('info', message),
  success: (message: string) => toast.show('success', message),
  error: (message: string) => toast.show('error', message),
}

const KIND_BORDER: Record<ToastKind, string> = {
  info: 'border-border',
  success: 'border-success',
  error: 'border-danger',
}

// Mount once near the app root (StudioLayout, T11) — renders whatever
// toast.show() has queued. Bottom-right, 12px above the transport bar.
export function ToastViewport() {
  const [list, setList] = useState<ToastItem[]>(items)

  useEffect(() => {
    listeners.add(setList)
    return () => { listeners.delete(setList) }
  }, [])

  return createPortal(
    <div className="fixed bottom-[76px] right-3 z-50 flex w-80 max-w-[320px] flex-col gap-2">
      {list.map(item => (
        <div
          key={item.id}
          role="status"
          className={`rounded-[var(--radius-m)] border bg-bg-elevated px-3 py-2 text-[13px] text-text-1 shadow-[0_8px_24px_rgba(0,0,0,0.5)] ${KIND_BORDER[item.kind]}`}
        >
          {item.message}
        </div>
      ))}
    </div>,
    document.body,
  )
}
