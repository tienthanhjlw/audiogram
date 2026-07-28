// Node-based scene renderer (P5-T3) — runs alongside the legacy 6 `drawX`
// functions in ./renderer.ts, which is NOT modified by this file (CLAUDE.md /
// PHASE5_TASKS.md §A.5: old render path stays until T18). Selected by the
// `useNodeRenderer` flag in PreviewCanvas/thumbnailer; both paths coexist for
// side-by-side comparison through T3–T10.
import { SceneNode } from '../../types'
import { indexById, isVisibleWithAncestors, worldTransform } from '../scene/group'
import { drawImageNode, ImageMap } from './nodeRenderers/image'
import { drawTextNode } from './nodeRenderers/text'
import { drawWaveformNode, WaveformShared } from './nodeRenderers/waveform'

/** Everything the node renderers need beyond `nodes` + `t` + canvas size. */
export interface SceneShared extends WaveformShared {
  images: ImageMap
}

type NodeRenderer = (ctx: CanvasRenderingContext2D, W: number, H: number, node: SceneNode, shared: SceneShared) => void

/** Registry of per-type draw functions — same shape as `WAVE_EFFECTS`. Group has no visual of its own (T10). */
const NODE_RENDERERS: Partial<Record<SceneNode['type'], NodeRenderer>> = {
  waveform: (ctx, W, H, node, shared) => drawWaveformNode(ctx, W, H, node, shared),
  text: (ctx, W, H, node) => drawTextNode(ctx, W, H, node),
  image: (ctx, W, H, node, shared) => drawImageNode(ctx, W, H, node, shared.images),
}

/** Extra info for the visibility/animation window — the video's total
 * duration, needed to clamp a `timing.end` beyond it (P5-T8 edge case). */
export interface SceneTimingContext {
  dur: number
}

/**
 * Draws every node visible at time `t`, in z-order. A node with `timing` is
 * skipped entirely outside its `[start, end]` window (P5-T8), and so is any
 * node whose ancestor group is hidden by ITS OWN timing (P5-T10 — a group's
 * timing/animIn/animOut applies to the whole subtree, not just itself).
 * animIn/animOut presets (domain/scene/animPresets.ts) adjust the drawn
 * transform near a window's edges; for a node inside a group, its world
 * transform composes with every ancestor's own (possibly animated)
 * transform (domain/scene/group.ts).
 */
export function drawSceneFrame(
  ctx: CanvasRenderingContext2D, W: number, H: number, nodes: SceneNode[], t: number, shared: SceneShared,
  timingCtx: SceneTimingContext = { dur: 0 },
): void {
  const nodesById = indexById(nodes)
  const sorted = [...nodes].sort((a, b) => a.z - b.z)
  for (const node of sorted) {
    if (!isVisibleWithAncestors(node, nodesById, t, timingCtx.dur)) continue
    const renderer = NODE_RENDERERS[node.type]
    if (!renderer) continue
    const transform = worldTransform(node, nodesById, t, timingCtx.dur)
    const effectiveNode = transform === node.transform ? node : { ...node, transform }
    renderer(ctx, W, H, effectiveNode, shared)
  }
}
