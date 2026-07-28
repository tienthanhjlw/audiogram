// Group/composite world-space resolution (P5-T10) — mirrors
// crates/audiogram-render/src/scene_frame.rs's group-aware `world_transform`/
// `is_visible_with_ancestors`. Depth-capped at 3 (MAX_GROUP_DEPTH) as a
// defensive bound against accidental cycles — the UI itself blocks nesting
// beyond that when grouping (design.slice.ts's groupNodes).
import type { SceneNode, Transform } from '../../types'
import { compose } from './transform'
import { computeEffectiveTransform, isVisibleAt } from './timing'

export const MAX_GROUP_DEPTH = 3

export type NodesById = Map<string, SceneNode>

export function indexById(nodes: SceneNode[]): NodesById {
  return new Map(nodes.map(n => [n.id, n]))
}

/** How many ancestor groups sit above `node` (0 = root level). Used to
 * block grouping beyond `MAX_GROUP_DEPTH` (T10 step 7 edge case). */
export function groupDepth(node: SceneNode, nodesById: NodesById): number {
  let depth = 0
  let current = node
  while (current.parentId && depth <= MAX_GROUP_DEPTH) {
    const parent = nodesById.get(current.parentId)
    if (!parent) break
    depth += 1
    current = parent
  }
  return depth
}

/** True if `node` and every ancestor group up the `parentId` chain is
 * visible at `t` — a group's `timing` hides the whole subtree (T10 step 6),
 * same mechanism as a leaf node's own `timing`, just walked upward. */
export function isVisibleWithAncestors(node: SceneNode, nodesById: NodesById, t: number, dur: number, depth = 0): boolean {
  if (!isVisibleAt(node, t, dur)) return false
  if (node.parentId && depth < MAX_GROUP_DEPTH) {
    const parent = nodesById.get(node.parentId)
    if (parent) return isVisibleWithAncestors(parent, nodesById, t, dur, depth + 1)
  }
  return true
}

/** World-space (root canvas) transform for `node` — composes its own
 * (possibly time-animated) transform with every ancestor group's own
 * (possibly time-animated) transform, parent ⊗ child up the chain. A
 * group's animIn/animOut therefore applies to the whole subtree "for
 * free": compose() multiplies opacity and offsets position, so a fading
 * group fades every descendant along with it. */
export function worldTransform(node: SceneNode, nodesById: NodesById, t: number, dur: number, depth = 0): Transform {
  const own = computeEffectiveTransform(node, t, dur)
  if (node.parentId && depth < MAX_GROUP_DEPTH) {
    const parent = nodesById.get(node.parentId)
    if (parent) return compose(worldTransform(parent, nodesById, t, dur, depth + 1), own)
  }
  return own
}

/** Same as `worldTransform`, but ignores timing/animIn/animOut — for
 * structural edits (group/ungroup, T10) where "current position" means the
 * node's own static transform, not a snapshot of a possibly-mid-animation
 * runtime state. */
export function staticWorldTransform(node: SceneNode, nodesById: NodesById, depth = 0): Transform {
  if (node.parentId && depth < MAX_GROUP_DEPTH) {
    const parent = nodesById.get(node.parentId)
    if (parent) return compose(staticWorldTransform(parent, nodesById, depth + 1), node.transform)
  }
  return node.transform
}
