import type { ReactNode } from 'react'

interface StudioLayoutProps {
  toolbar: ReactNode
  /** Reserved 280px column, UI_DESIGN_SPEC.md §1.2. Empty in Phase 1 — the
   * legacy StepLayout/StepTranscript/StepExport components (rendered in
   * `children`) are monolithic and haven't been split into a real
   * left-panel/canvas/inspector triad yet (Phase 2/3). */
  leftPanel?: ReactNode
  /** The combined canvas+inspector region — one legacy Step component at a
   * time in Phase 1, per PHASE1_TASKS.md T11. */
  children: ReactNode
  /** 64px transport row. Left empty in T11 (placeholder only); T12 mounts
   * TransportBar here. */
  transport?: ReactNode
}

// shell/StudioLayout.tsx — UI_DESIGN_SPEC.md §1.2 grid. The spec's 3-column
// content row (left panel / canvas / inspector) collapses to 2 here (left
// panel / main) because Phase 1 has no real canvas+inspector split yet —
// see the `children` doc above. The inspector shrink-at-<1080px rule from
// the spec applies once that split exists; nothing to shrink before then.
export function StudioLayout({ toolbar, leftPanel, children, transport }: StudioLayoutProps) {
  return (
    <div
      className="grid h-screen"
      style={{ gridTemplateRows: '48px 1fr 64px', gridTemplateColumns: '280px 1fr' }}
    >
      <div className="col-span-2 row-start-1">{toolbar}</div>

      <div className="overlay-scroll row-start-2 overflow-y-auto border-r border-border bg-bg-panel">
        {leftPanel}
      </div>

      <div className="row-start-2 min-w-[480px] overflow-auto">
        {children}
      </div>

      <div className="col-span-2 row-start-3 border-t border-border bg-bg-panel">
        {transport}
      </div>
    </div>
  )
}
