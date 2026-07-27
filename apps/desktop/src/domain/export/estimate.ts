import { CANVAS_SIZES, type CanvasSize } from '../../types'

// Pure heuristics for the Export Sheet's "Estimated: ~45 MB · ~2 min" line
// (UI_DESIGN_SPEC.md §7.1) — no real export sample data exists yet to
// calibrate against, so both numbers are documented guesses rather than
// measurements; refine the two constants below once real telemetry from
// actual exports is available (PHASE3_TASKS.md T10 leaves this as a
// deliberate placeholder, not a finished model).

// AAC audio bitrate is NOT a guess — it's the exact, fixed value ffmpeg is
// invoked with (`-c:a aac -b:a 192k`, infrastructure/ffmpeg/render/mod.rs).
const AUDIO_BITRATE_BPS = 192_000

// Video bitrate heuristic: bits-per-pixel-per-frame × pixel count × fps.
// A commonly-cited H.264 guideline for "medium complexity, medium quality"
// content is ~0.1 bpp/frame; this app's output (flat background gradients,
// a waveform of solid-color bars, occasional static text) has noticeably
// lower spatial complexity than typical video, and the encoder runs at
// CRF 18 (`-preset veryfast -crf 18`, same file) which is quality-targeted
// rather than a fixed bitrate — 0.07 bpp/frame is a conservative middle
// estimate for that combination, not a measured constant.
const BITS_PER_PIXEL_PER_FRAME = 0.07

function videoBitrateBps(canvasSize: CanvasSize, fps: number): number {
  const { w, h } = CANVAS_SIZES[canvasSize]
  return w * h * fps * BITS_PER_PIXEL_PER_FRAME
}

/** Estimated output file size in bytes for a render of `durationSec` at the
 * given canvas size / fps. Monotonically increasing in all three inputs. */
export function estimateSize(durationSec: number, canvasSize: CanvasSize, fps: number): number {
  const totalBitrateBps = videoBitrateBps(canvasSize, fps) + AUDIO_BITRATE_BPS
  return (totalBitrateBps * durationSec) / 8
}

// Rough render+encode throughput at 1280×720 for the `veryfast` x264
// preset — unmeasured, a placeholder until real export timings exist.
// Scaled inversely by pixel count for other canvas sizes (more pixels per
// frame ⇒ proportionally fewer frames encoded per wall-clock second); the
// number of frames to encode is `durationSec × fps` regardless of
// resolution, so higher fps means proportionally more encode time too.
const FRAMES_PER_SEC_AT_720P = 40
const REFERENCE_PIXELS = 1280 * 720

function framesPerSecondFor(canvasSize: CanvasSize): number {
  const { w, h } = CANVAS_SIZES[canvasSize]
  return FRAMES_PER_SEC_AT_720P * (REFERENCE_PIXELS / (w * h))
}

/** Estimated wall-clock export time in seconds. Monotonically increasing in
 * duration, fps, and resolution (larger canvas ⇒ slower). */
export function estimateTime(durationSec: number, fps: number, canvasSize: CanvasSize): number {
  const totalFrames = durationSec * fps
  return totalFrames / framesPerSecondFor(canvasSize)
}
