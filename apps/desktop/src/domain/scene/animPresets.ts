// Animation preset registry (P5-T8) — mirrors crates/audiogram-render/src/
// scene_frame.rs's `anim_presets` module exactly (same 5 tRelative sample
// points are parity-tested against it). Each preset is a pure function of
// `tRelative` (0 = window start, 1 = window end) returning a delta to apply
// on top of a node's base transform — not a `Partial<Transform>` merge:
// opacity is a multiplier, dx/dy are additive offsets (canvas fractions),
// scale multiplies w/h around the transform's own center.
import type { AnimationId } from '../../types'

export interface AnimDelta {
  opacity: number
  dx: number
  dy: number
  scale: number
}

export type AnimPreset = (tRelative: number) => AnimDelta

const IDENTITY: AnimDelta = { opacity: 1, dx: 0, dy: 0, scale: 1 }

// Entrance offset, canvas-fraction units — matches scene_frame.rs's SLIDE_OFFSET.
const SLIDE_OFFSET = 0.08

export const ANIM_PRESETS: Record<AnimationId, AnimPreset> = {
  fade: (t) => ({ ...IDENTITY, opacity: t }),
  'slide-up': (t) => ({ ...IDENTITY, opacity: t, dy: (1 - t) * SLIDE_OFFSET }),
  'slide-down': (t) => ({ ...IDENTITY, opacity: t, dy: -(1 - t) * SLIDE_OFFSET }),
  'scale-in': (t) => ({ ...IDENTITY, opacity: t, scale: 0.5 + 0.5 * t }),
}
