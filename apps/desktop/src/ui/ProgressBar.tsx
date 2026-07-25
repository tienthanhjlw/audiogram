interface ProgressBarProps {
  /** 0-100; omit for an indeterminate (looping) bar. */
  value?: number
  className?: string
}

// UI_DESIGN_SPEC.md §9 — 4-6px track, accent fill, indeterminate loop.
export function ProgressBar({ value, className = '' }: ProgressBarProps) {
  const indeterminate = value === undefined
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-border ${className}`}>
      {indeterminate ? (
        <div className="animate-progress-indeterminate h-full w-[30%] rounded-full bg-accent" />
      ) : (
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      )}
    </div>
  )
}
