import { Tooltip } from './Tooltip'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  subLabel?: string
  disabled?: boolean
  /** Required in practice when disabled — rendered as a Tooltip so the
   * reason is discoverable instead of a silently-dead control. */
  disabledReason?: string
}

// UI_DESIGN_SPEC.md §9 — 36x20 track, 16px thumb, 150ms, disabled+reason via Tooltip.
export function Toggle({ checked, onChange, label, subLabel, disabled, disabledReason }: ToggleProps) {
  const switchEl = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={[
        'relative h-5 w-9 shrink-0 rounded-full transition-colors duration-150',
        'disabled:cursor-default disabled:opacity-40',
        checked ? 'bg-accent' : 'bg-border',
      ].join(' ')}
    >
      <span
        className={[
          'absolute top-0.5 h-4 w-4 rounded-full bg-text-1 shadow transition-[left] duration-150',
          checked ? 'left-[18px]' : 'left-0.5',
        ].join(' ')}
      />
    </button>
  )

  const body = label || subLabel ? (
    <div className="flex items-center justify-between gap-3">
      <div>
        {label && <div className="text-[13px] text-text-1">{label}</div>}
        {subLabel && <div className="mt-0.5 text-[11px] text-text-3">{subLabel}</div>}
      </div>
      {switchEl}
    </div>
  ) : switchEl

  if (disabled && disabledReason) {
    return <Tooltip content={disabledReason}>{body}</Tooltip>
  }
  return body
}
