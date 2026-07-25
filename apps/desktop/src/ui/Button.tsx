import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: Variant
  size?: Size
  shortcutHint?: string
  loading?: boolean
  children?: ReactNode
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-accent text-text-1 hover:brightness-110',
  secondary: 'border border-border bg-bg-elevated text-text-1 hover:brightness-110',
  ghost: 'bg-transparent text-text-1 hover:bg-bg-elevated',
  danger: 'bg-danger/15 text-danger hover:bg-danger/25',
}

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'h-7 px-3 text-[12.5px]',
  md: 'h-[34px] px-4 text-[13px]',
}

// UI_DESIGN_SPEC.md §9 — variants/sizes/loading behavior.
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', shortcutHint, loading = false, disabled, className = '', children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        'relative inline-flex items-center justify-center rounded-[var(--radius-s)] font-medium',
        'transition-[filter,background-color,transform] duration-150 active:scale-[0.98]',
        'disabled:pointer-events-none disabled:opacity-40',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      ].join(' ')}
      {...rest}
    >
      {/* Content stays laid out (just hidden) while loading, so the button keeps its width. */}
      <span className={loading ? 'invisible flex items-center gap-2' : 'flex items-center gap-2'}>
        {children}
        {shortcutHint && <span className="ml-2 text-[11px] opacity-60">{shortcutHint}</span>}
      </span>
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner />
        </span>
      )}
    </button>
  )
})

function Spinner() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
