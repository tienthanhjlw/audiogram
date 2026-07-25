import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

interface PopoverProps {
  anchorRef: RefObject<HTMLElement | null>
  open: boolean
  onClose: () => void
  children: ReactNode
  offset?: number
  className?: string
}

// UI_DESIGN_SPEC.md §9 — anchored 6px below the trigger, closes on
// click-outside or Esc. Does not steal focus on open — callers that want
// that (Select) manage it themselves.
export function Popover({ anchorRef, open, onClose, children, offset = 6, className = '' }: PopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: 0, top: 0, width: 0 })

  useLayoutEffect(() => {
    if (!open) return
    const anchor = anchorRef.current
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    setPos({ left: rect.left, top: rect.bottom + offset, width: rect.width })
  }, [open, anchorRef, offset])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (popoverRef.current?.contains(target)) return
      if (anchorRef.current?.contains(target)) return
      onClose()
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
  }, [open, onClose, anchorRef])

  if (!open) return null

  return createPortal(
    <div
      ref={popoverRef}
      className={`fixed z-50 rounded-[var(--radius-m)] border border-border bg-bg-elevated py-1 shadow-[0_8px_24px_rgba(0,0,0,0.5)] ${className}`}
      style={{ left: pos.left, top: pos.top, minWidth: pos.width }}
    >
      {children}
    </div>,
    document.body,
  )
}
