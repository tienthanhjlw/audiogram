import { useCallback, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  children: ReactNode
  content: ReactNode
  shortcut?: string
  disabled?: boolean
}

const DELAY_MS = 400

// CSS position + portal, no popover/floating-ui dependency — UI_DESIGN_SPEC.md §9.
export function Tooltip({ children, content, shortcut, disabled }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef = useRef<HTMLSpanElement>(null)

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const show = useCallback(() => {
    if (disabled || !content) return
    clearTimer()
    timerRef.current = setTimeout(() => {
      const rect = wrapperRef.current?.getBoundingClientRect()
      if (rect) setPos({ x: rect.left + rect.width / 2, y: rect.top })
      setVisible(true)
    }, DELAY_MS)
  }, [disabled, content])

  const hide = useCallback(() => {
    clearTimer()
    setVisible(false)
  }, [])

  return (
    <span
      ref={wrapperRef}
      className="inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && content && createPortal(
        <div
          role="tooltip"
          className="pointer-events-none fixed z-50 -mt-2 max-w-[220px] -translate-x-1/2 -translate-y-full text-wrap rounded bg-black/90 px-2 py-1 text-[11px] leading-snug text-text-1"
          style={{ left: pos.x, top: pos.y }}
        >
          {content}
          {shortcut && <span className="ml-2 opacity-60">{shortcut}</span>}
        </div>,
        document.body,
      )}
    </span>
  )
}
