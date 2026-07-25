import type { ReactNode } from 'react'

interface FieldProps {
  label: string
  children: ReactNode
  className?: string
}

// UI_DESIGN_SPEC.md §9 — 11px uppercase label, 8px gap to control.
export function Field({ label, children, className = '' }: FieldProps) {
  return (
    <div className={className}>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-text-3">
        {label}
      </div>
      {children}
    </div>
  )
}

// Vertical stack of Fields inside a panel — 24px gap per UI_DESIGN_SPEC.md §9.
export function FieldStack({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-col gap-6 ${className}`}>{children}</div>
}
