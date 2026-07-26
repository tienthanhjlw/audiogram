import { useEffect, useRef, useState, type ReactNode } from 'react'

interface StudioLayoutProps {
  toolbar: ReactNode
  /** 280px column — Design mode's DesignPanel (P2-T6). Omitted for
   * Captions mode / the export step, whose legacy components
   * (StepTranscript/StepExport) are still self-contained monoliths that
   * build their own wide layout internally (Phase 3 ports them) — in that
   * case `children` expands to fill the space this column would take. */
  leftPanel?: ReactNode
  /** Canvas stage (Design mode) or a legacy Step component (Captions mode /
   * export step) — spans both the middle and inspector columns when
   * `inspector` is omitted. */
  children: ReactNode
  /** 280px column (240px under 1080px width), UI_DESIGN_SPEC.md §1.2 —
   * Design mode's DesignInspector (P2-T8). Omitted the same cases as
   * `leftPanel`. */
  inspector?: ReactNode
  /** 64px transport row. */
  transport?: ReactNode
}

// shell/StudioLayout.tsx — UI_DESIGN_SPEC.md §1.2 grid, now the real 3-column
// content row (left panel / canvas / inspector) from P2-T9. `leftPanel`/
// `inspector` are each optional or CSS grid auto-flow simply doesn't
// allocate that track, and `children` (the middle cell, DOM order between
// the two) naturally expands to fill the extra space — no need for
// StudioLayout itself to know which mode/step is active.
export function StudioLayout({ toolbar, leftPanel, children, inspector, transport }: StudioLayoutProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [narrow, setNarrow] = useState(false)

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setNarrow(entry.contentRect.width < 1080))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const hasLeftPanel = leftPanel != null
  const hasInspector = inspector != null
  const inspectorWidth = narrow ? 240 : 280

  const columns = [
    hasLeftPanel ? '280px' : null,
    '1fr',
    hasInspector ? `${inspectorWidth}px` : null,
  ].filter(Boolean).join(' ')

  return (
    <div
      ref={rootRef}
      className="grid h-screen"
      style={{ gridTemplateRows: '48px 1fr 64px', gridTemplateColumns: columns }}
    >
      <div style={{ gridColumn: '1 / -1', gridRow: 1 }}>{toolbar}</div>

      {hasLeftPanel && (
        <div
          className="overlay-scroll overflow-y-auto border-r border-border bg-bg-panel"
          style={{ gridRow: 2 }}
        >
          {leftPanel}
        </div>
      )}

      <div className="min-w-[480px] overflow-auto" style={{ gridRow: 2 }}>
        {children}
      </div>

      {hasInspector && (
        <div
          className="overlay-scroll overflow-y-auto border-l border-border bg-bg-panel"
          style={{ gridRow: 2 }}
        >
          {inspector}
        </div>
      )}

      <div style={{ gridColumn: '1 / -1', gridRow: 3 }} className="border-t border-border bg-bg-panel">
        {transport}
      </div>
    </div>
  )
}
