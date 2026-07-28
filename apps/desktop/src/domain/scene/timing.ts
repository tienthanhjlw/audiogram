// Timing window + animIn/animOut evaluation (P5-T8) — mirrors
// crates/audiogram-render/src/scene_frame.rs's `timing` module exactly.
// Pure functions, no canvas/ctx — used by both nodeRenderer.ts (preview)
// and the future export-path wiring.
import type { SceneNode, Transform } from '../../types'
import { ANIM_PRESETS, type AnimDelta } from './animPresets'

/** Clamps `timing` to a sane window: `end < start` collapses to a
 * zero-length window (never visible, except the single instant t===start);
 * `end` beyond the video's total duration is clamped to it. `dur <= 0`
 * (duration not known yet) skips the video-length clamp. */
function clampedWindow(node: SceneNode, dur: number): { start: number; end: number } | null {
  const timing = node.timing
  if (!timing) return null
  const start = timing.start
  let end = Math.max(timing.start, timing.end) // end < start ⇒ zero-length window
  if (dur > 0) end = Math.min(end, dur)
  return { start, end }
}

/** Is this node visible at time `t` (seconds)? Absent `timing` = always visible. */
export function isVisibleAt(node: SceneNode, t: number, dur = 0): boolean {
  const w = clampedWindow(node, dur)
  if (!w) return true
  return t >= w.start && t <= w.end
}

/** animIn/animOut duration, clamped to half the timing window so entry and
 * exit animations can never overlap-collide (edge case: a duration longer
 * than the whole window). */
function clampedAnimDuration(requested: number, windowLen: number): number {
  return Math.min(Math.max(requested, 0), windowLen / 2)
}

/** Effective (post-animation) transform for `node` at time `t`. Outside any
 * animIn/animOut window, or with no `timing` at all, returns the node's own
 * `transform` unchanged (same reference — cheap for the common case). */
export function computeEffectiveTransform(node: SceneNode, t: number, dur = 0): Transform {
  const base = node.transform
  const w = clampedWindow(node, dur)
  if (!w) return base

  if (node.animIn) {
    const animDur = clampedAnimDuration(node.animIn.duration, w.end - w.start)
    if (animDur > 0 && t < w.start + animDur) {
      const tRel = Math.min(Math.max((t - w.start) / animDur, 0), 1)
      return applyAnimDelta(base, ANIM_PRESETS[node.animIn.preset](tRel))
    }
  }
  if (node.animOut) {
    const animDur = clampedAnimDuration(node.animOut.duration, w.end - w.start)
    if (animDur > 0 && t > w.end - animDur) {
      const tRel = Math.min(Math.max((w.end - t) / animDur, 0), 1)
      return applyAnimDelta(base, ANIM_PRESETS[node.animOut.preset](tRel))
    }
  }
  return base
}

function applyAnimDelta(base: Transform, delta: AnimDelta): Transform {
  const w = base.w * delta.scale
  const h = base.h * delta.scale
  const cx = base.x + base.w / 2
  const cy = base.y + base.h / 2
  return {
    ...base,
    x: cx - w / 2 + delta.dx,
    y: cy - h / 2 + delta.dy,
    w,
    h,
    opacity: (base.opacity ?? 1) * delta.opacity,
  }
}
