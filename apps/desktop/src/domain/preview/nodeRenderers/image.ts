// Image node renderer — draws a loaded HTMLImageElement into `node.transform`'s
// rect, same cover/contain math the legacy drawFullBg/drawAvatar use, but
// generalized to any node.transform rect instead of a hardcoded full-canvas or
// avatar-circle placement (P5-T3 step 2).
import { ImageProps, SceneNode } from '../../../types'

/** src -> already-loaded image. Resolving/loading images is the caller's job (T15 owns asset lifecycle). */
export type ImageMap = Map<string, HTMLImageElement>

export function drawImageNode(ctx: CanvasRenderingContext2D, W: number, H: number, node: SceneNode, images: ImageMap): void {
  const props = node.props as ImageProps
  const img = images.get(props.src)
  if (!img) return
  const { transform } = node
  const dx = transform.x * W, dy = transform.y * H, dw = transform.w * W, dh = transform.h * H

  ctx.save()
  ctx.globalAlpha = transform.opacity ?? 1

  if (props.shape === 'circle') {
    ctx.beginPath()
    ctx.arc(dx + dw / 2, dy + dh / 2, Math.min(dw, dh) / 2, 0, Math.PI * 2)
    ctx.clip()
  } else if (props.shape === 'rounded') {
    ctx.beginPath()
    ctx.roundRect(dx, dy, dw, dh, Math.min(dw, dh) * 0.08)
    ctx.clip()
  }

  if (props.fit === 'contain') {
    const scale = Math.min(dw / img.width, dh / img.height)
    const iw = img.width * scale, ih = img.height * scale
    ctx.drawImage(img, dx + (dw - iw) / 2, dy + (dh - ih) / 2, iw, ih)
  } else {
    const scale = Math.max(dw / img.width, dh / img.height)
    const iw = img.width * scale, ih = img.height * scale
    ctx.drawImage(img, dx + (dw - iw) / 2, dy + (dh - ih) / 2, iw, ih)
  }

  ctx.restore()
}
