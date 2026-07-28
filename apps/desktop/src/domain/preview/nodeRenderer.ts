// Node-based scene renderer (P5-T3) — runs alongside the legacy 6 `drawX`
// functions in ./renderer.ts, which is NOT modified by this file (CLAUDE.md /
// PHASE5_TASKS.md §A.5: old render path stays until T18). Selected by the
// `useNodeRenderer` flag in PreviewCanvas/thumbnailer; both paths coexist for
// side-by-side comparison through T3–T10.
import { SceneNode } from '../../types'
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

/**
 * Draws every node visible at time `t`, in z-order.
 *
 * T3 scope: no `timing` filtering yet (added in T8 — all nodes are always
 * visible here), no group composition yet (T10 — nodes render with their own
 * `transform` as-is, root-space).
 */
export function drawSceneFrame(ctx: CanvasRenderingContext2D, W: number, H: number, nodes: SceneNode[], _t: number, shared: SceneShared): void {
  const sorted = [...nodes].sort((a, b) => a.z - b.z)
  for (const node of sorted) {
    const renderer = NODE_RENDERERS[node.type]
    if (renderer) renderer(ctx, W, H, node, shared)
  }
}
