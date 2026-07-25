interface SliderProps {
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  formatValue?: (value: number) => string
  disabled?: boolean
}

// UI_DESIGN_SPEC.md §9 — 4px track, accent fill, 14px thumb, right-aligned mono value.
// Arrow-key stepping is native <input type="range"> behavior, nothing extra to wire.
export function Slider({ value, min, max, step = 1, onChange, formatValue, disabled }: SliderProps) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={e => onChange(Number(e.target.value))}
        className={[
          'h-1 flex-1 cursor-pointer appearance-none rounded-full bg-border accent-accent',
          'disabled:cursor-default disabled:opacity-40',
          '[&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none',
          '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-text-1 [&::-webkit-slider-thumb]:shadow',
          '[&::-webkit-slider-thumb]:cursor-pointer',
        ].join(' ')}
      />
      <span className="tabular w-10 shrink-0 text-right text-[11px] text-text-2">
        {formatValue ? formatValue(value) : value}
      </span>
    </div>
  )
}
