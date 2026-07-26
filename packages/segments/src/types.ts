// Structurally identical to apps/desktop/src/types.ts's hand-written
// Segment — this package can't import that file (same reasoning as
// @audiogram/contract's LayoutZone/LayoutZones: keeps this package usable
// standalone, e.g. a future CLI/web demo), so TS's structural typing
// carries the shape instead of a shared declaration.
export interface Segment {
  id: number
  start: number // seconds
  end: number   // seconds
  text: string
}
