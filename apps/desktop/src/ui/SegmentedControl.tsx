import { useEffect, useRef, useState } from 'react'

interface Option<T extends string> {
  value: T
  label: string
}

interface SegmentedControlProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: Option<T>[]
  disabled?: boolean
}

// UI_DESIGN_SPEC.md §9 — inset track, sliding thumb behind the active item, 150ms ease-out.
export function SegmentedControl<T extends string>({ value, onChange, options, disabled }: SegmentedControlProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Map<T, HTMLButtonElement>>(new Map())
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null)

  useEffect(() => {
    const el = itemRefs.current.get(value)
    const container = containerRef.current
    if (el && container) {
      const elRect = el.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      setThumb({ left: elRect.left - containerRect.left, width: elRect.width })
    }
  }, [value, options])

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      className="relative inline-flex items-center gap-0.5 rounded-[var(--radius-s)] bg-bg-app p-0.5"
    >
      {thumb && (
        <div
          aria-hidden
          className="absolute top-0.5 h-8 rounded-[calc(var(--radius-s)-2px)] bg-bg-elevated transition-[left,width] duration-150 ease-out"
          style={{ left: thumb.left, width: thumb.width }}
        />
      )}
      {options.map(opt => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            ref={el => {
              if (el) itemRefs.current.set(opt.value, el)
              else itemRefs.current.delete(opt.value)
            }}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => !disabled && onChange(opt.value)}
            className={[
              'relative z-10 h-8 rounded-[calc(var(--radius-s)-2px)] px-3 text-[12.5px]',
              'transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40',
              active ? 'text-text-1' : 'text-text-2 hover:text-text-1',
            ].join(' ')}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
