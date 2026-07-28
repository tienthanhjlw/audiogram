// Transform compose/decompose (P5-T10) — mirrors
// crates/audiogram-core/src/entities/scene_node.rs's `Transform::compose`/
// `::decompose` exactly (same layout rule, same test fixtures). Extracted
// here (was inline in domain/__tests__/scene_node.test.ts's T2 fixture) so
// the group renderer/store code can share one implementation instead of
// each re-deriving the same math.
import type { Transform } from '../../types'

/** Compose parent ⊗ child: child coordinates are in parent's local space,
 * result is in root (canvas) space. */
export function compose(parent: Transform, child: Transform): Transform {
  return {
    x: parent.x + child.x * parent.w,
    y: parent.y + child.y * parent.h,
    w: child.w * parent.w,
    h: child.h * parent.h,
    rotation: (parent.rotation ?? 0) + (child.rotation ?? 0),
    opacity: (parent.opacity ?? 1) * (child.opacity ?? 1),
  }
}

/** Inverse of `compose` — recovers the child's local-space transform from
 * a composed (root-space) transform, given the parent. Used by ungroup to
 * preserve each child's absolute on-canvas position once the group node is
 * dissolved. Assumes `parent.w`/`parent.h` are non-zero (a degenerate group
 * — 0-size — can't be meaningfully decomposed; callers should not create one). */
export function decompose(parent: Transform, root: Transform): Transform {
  return {
    x: (root.x - parent.x) / parent.w,
    y: (root.y - parent.y) / parent.h,
    w: root.w / parent.w,
    h: root.h / parent.h,
    rotation: (root.rotation ?? 0) - (parent.rotation ?? 0),
    opacity: (parent.opacity ?? 1) > 1e-6 ? (root.opacity ?? 1) / (parent.opacity ?? 1) : 1,
  }
}
