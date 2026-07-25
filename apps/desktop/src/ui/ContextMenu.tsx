import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface ContextMenuItem {
  label: string
  onSelect: () => void
  danger?: boolean
  disabled?: boolean
  disabledReason?: string
}
type ContextMenuEntry = ContextMenuItem | { separator: true }

interface ContextMenuProps {
  open: boolean
  x: number
  y: number
  items: ContextMenuEntry[]
  onClose: () => void
}

// UI_DESIGN_SPEC.md §9/§8.6 — opens at cursor coordinates (right-click),
// same close-on-outside/Esc behavior as Popover but positioned freely
// instead of anchored to an element.
export function ContextMenu({ open, x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) onClose()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      className="fixed z-50 min-w-[180px] rounded-[var(--radius-m)] border border-border bg-bg-elevated py-1 shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
      style={{ left: x, top: y }}
    >
      {items.map((item, i) =>
        'separator' in item ? (
          <div key={`sep-${i}`} role="separator" className="my-1 h-px bg-border" />
        ) : (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            title={item.disabled ? item.disabledReason : undefined}
            onClick={() => {
              item.onSelect()
              onClose()
            }}
            className={[
              'flex h-7 w-full items-center px-2.5 text-left text-[12.5px]',
              'disabled:pointer-events-none disabled:opacity-40',
              item.danger ? 'text-danger hover:bg-danger/15' : 'text-text-1 hover:bg-accent-soft',
            ].join(' ')}
          >
            {item.label}
          </button>
        ),
      )}
    </div>,
    document.body,
  )
}
