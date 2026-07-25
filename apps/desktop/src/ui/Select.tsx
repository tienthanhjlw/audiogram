import { useEffect, useRef, useState } from 'react'
import { Popover } from './Popover'

interface SelectOption<T extends string> {
  value: T
  label: string
}

interface SelectProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: SelectOption<T>[]
  disabled?: boolean
  placeholder?: string
}

// UI_DESIGN_SPEC.md §9 — built on Popover; Up/Down/Enter/Esc + type-ahead.
export function Select<T extends string>({ value, onChange, options, disabled, placeholder }: SelectProps<T>) {
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const typeaheadRef = useRef('')
  const typeaheadTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selected = options.find(o => o.value === value)

  useEffect(() => {
    if (open) listRef.current?.focus()
  }, [open])

  const openAt = (index: number) => {
    setHighlighted(Math.max(0, index))
    setOpen(true)
  }

  const commit = (index: number) => {
    const opt = options[index]
    if (opt) onChange(opt.value)
    setOpen(false)
    triggerRef.current?.focus()
  }

  const onListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted(h => Math.min(options.length - 1, h + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted(h => Math.max(0, h - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      commit(highlighted)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
    } else if (e.key.length === 1) {
      typeaheadRef.current += e.key.toLowerCase()
      if (typeaheadTimer.current) clearTimeout(typeaheadTimer.current)
      typeaheadTimer.current = setTimeout(() => { typeaheadRef.current = '' }, 600)
      const idx = options.findIndex(o => o.label.toLowerCase().startsWith(typeaheadRef.current))
      if (idx >= 0) setHighlighted(idx)
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && openAt(options.findIndex(o => o.value === value))}
        onKeyDown={e => {
          if (disabled) return
          if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            openAt(options.findIndex(o => o.value === value))
          }
        }}
        className="flex h-8 w-full items-center justify-between rounded-[var(--radius-s)] border border-border bg-bg-elevated px-2.5 text-[13px] text-text-1 disabled:cursor-default disabled:opacity-40"
      >
        <span className={selected ? '' : 'text-text-3'}>{selected?.label ?? placeholder ?? 'Select…'}</span>
        <span className="ml-2 text-text-3">▾</span>
      </button>
      <Popover anchorRef={triggerRef} open={open} onClose={() => setOpen(false)}>
        <div
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          onKeyDown={onListKeyDown}
          className="max-h-64 overflow-auto outline-none"
        >
          {options.map((opt, i) => (
            <div
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              onMouseEnter={() => setHighlighted(i)}
              onClick={() => commit(i)}
              className={[
                'flex h-[30px] cursor-pointer items-center gap-2 px-2.5 text-[13px]',
                i === highlighted ? 'bg-accent-soft text-text-1' : 'text-text-2',
              ].join(' ')}
            >
              <span className="w-3 shrink-0">{opt.value === value ? '✓' : ''}</span>
              {opt.label}
            </div>
          ))}
        </div>
      </Popover>
    </>
  )
}
