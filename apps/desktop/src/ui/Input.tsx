import { forwardRef, useRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'

const BASE_CLASSES = 'w-full rounded-[var(--radius-s)] border border-border bg-bg-app text-[13px] text-text-1 outline-none placeholder:text-text-3 focus:border-accent disabled:cursor-default disabled:opacity-40'

// UI_DESIGN_SPEC.md §9 — 32px input height, focus ring via border-accent.
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = '', ...rest }, ref) {
    return <input ref={ref} className={`h-8 px-2.5 ${BASE_CLASSES} ${className}`} {...rest} />
  },
)

const LINE_HEIGHT_PX = 18
const MAX_LINES = 4

// Auto-grows up to 4 lines (UI_DESIGN_SPEC.md §9), then scrolls.
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className = '', onInput, style, ...rest }, forwardedRef) {
    const localRef = useRef<HTMLTextAreaElement | null>(null)

    const resize = (el: HTMLTextAreaElement) => {
      el.style.height = 'auto'
      const maxHeight = LINE_HEIGHT_PX * MAX_LINES + 12 // + vertical padding
      el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
    }

    return (
      <textarea
        ref={el => {
          localRef.current = el
          if (typeof forwardedRef === 'function') forwardedRef(el)
          else if (forwardedRef) forwardedRef.current = el
          if (el) resize(el)
        }}
        rows={1}
        onInput={e => {
          resize(e.currentTarget)
          onInput?.(e)
        }}
        style={{ lineHeight: `${LINE_HEIGHT_PX}px`, resize: 'none', overflowY: 'auto', ...style }}
        className={`px-2.5 py-1.5 ${BASE_CLASSES} ${className}`}
        {...rest}
      />
    )
  },
)
