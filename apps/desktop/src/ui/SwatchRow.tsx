import { Tooltip } from './Tooltip'

interface SwatchColor {
  hex: string
  name: string
}

interface SwatchRowProps {
  value: string
  onChange: (hex: string) => void
  swatches: SwatchColor[]
  disabled?: boolean
}

// UI_DESIGN_SPEC.md §9 — 24x24 swatches, double-ring selected state,
// trailing custom color well wrapping a native <input type=color>.
export function SwatchRow({ value, onChange, swatches, disabled }: SwatchRowProps) {
  const normalized = value.toLowerCase()
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {swatches.map(s => {
        const selected = s.hex.toLowerCase() === normalized
        return (
          <Tooltip key={s.hex} content={s.name} disabled={disabled}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => !disabled && onChange(s.hex)}
              aria-label={s.name}
              aria-pressed={selected}
              className={[
                'h-6 w-6 shrink-0 rounded-[6px] disabled:cursor-default disabled:opacity-40',
                selected ? 'shadow-[0_0_0_2px_white,0_0_0_4px_var(--color-accent)]' : '',
              ].join(' ')}
              style={{ backgroundColor: s.hex }}
            />
          </Tooltip>
        )
      })}
      <Tooltip content="Custom color" disabled={disabled}>
        <span
          className="h-6 w-6 shrink-0 overflow-hidden rounded-[6px] p-[2px]"
          style={{
            background: 'conic-gradient(from 0deg, #F87171, #FBBF24, #34D399, #60A5FA, #A78BFA, #F87171)',
          }}
        >
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'}
            disabled={disabled}
            onChange={e => onChange(e.target.value)}
            aria-label="Custom color"
            className="h-full w-full cursor-pointer rounded-[4px] border-0 bg-transparent p-0 disabled:cursor-default"
          />
        </span>
      </Tooltip>
    </div>
  )
}
