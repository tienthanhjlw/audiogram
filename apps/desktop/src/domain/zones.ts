// Pure fraction-space (0-1) math for the canvas stage's zone editor
// (UI_DESIGN_SPEC.md §4.2) — kept out of features/design/CanvasStage.tsx so
// the snap/clamp behavior is unit-testable without mounting react-rnd.

/** Clamps a zone's top-left fraction so the whole zone stays inside [0,1]. */
export function clampZoneFraction(x: number, y: number, w: number, h: number): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(1 - w, x)),
    y: Math.max(0, Math.min(1 - h, y)),
  }
}

export interface SnapResult {
  x: number
  y: number
  snappedX: boolean
  snappedY: boolean
}

/**
 * Snaps a dragged zone (in pixel space) to the canvas' center guide lines
 * when its own center comes within `thresholdPx` of the canvas center on
 * that axis — independently per axis (a zone can snap horizontally without
 * snapping vertically). UI_DESIGN_SPEC.md §4.2's "snap ±8px".
 */
export function snapToCenterPx(
  xPx: number, yPx: number, wPx: number, hPx: number,
  canvasWPx: number, canvasHPx: number,
  thresholdPx = 8,
): SnapResult {
  const canvasCx = canvasWPx / 2
  const canvasCy = canvasHPx / 2
  const zoneCx = xPx + wPx / 2
  const zoneCy = yPx + hPx / 2

  const snappedX = Math.abs(zoneCx - canvasCx) <= thresholdPx
  const snappedY = Math.abs(zoneCy - canvasCy) <= thresholdPx

  return {
    x: snappedX ? canvasCx - wPx / 2 : xPx,
    y: snappedY ? canvasCy - hPx / 2 : yPx,
    snappedX,
    snappedY,
  }
}
