// Text node renderer — generalizes the measure/wrap logic of the legacy
// `drawTitle` in ../renderer.ts (P5-T3), but reads directly off `TextProps` +
// `Transform` instead of hardcoded per-layout zone math. `renderer.ts` is not
// touched by this file — the two implementations run side by side until T18.
import { TITLE_LINE_HEIGHT, TITLE_MAX_LINES } from '@audiogram/contract'
import { SceneNode, TextProps } from '../../../types'

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines = TITLE_MAX_LINES): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let cur = ''
  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word
    if (cur && ctx.measureText(test).width > maxW) { lines.push(cur); cur = word }
    else cur = test
  }
  if (cur) lines.push(cur)
  return lines.slice(0, maxLines)
}

/** Draws a text node. `transform` fields are canvas fractions (0..1); `size` is px at a 1080-tall canvas. */
export function drawTextNode(ctx: CanvasRenderingContext2D, W: number, H: number, node: SceneNode): void {
  const props = node.props as TextProps
  if (!props.text) return
  const { transform } = node
  const fs = Math.round(H * (props.size / 1080))
  const weight = props.bold ? '700' : '400'
  const style = props.italic ? 'italic ' : ''
  ctx.font = `${style}${weight} ${fs}px '${props.font}', Arial, sans-serif`
  ctx.fillStyle = props.color
  ctx.textAlign = props.align
  ctx.globalAlpha = transform.opacity ?? 1

  const mw = transform.w * W
  let cx: number
  if (props.align === 'left') cx = transform.x * W
  else if (props.align === 'right') cx = (transform.x + transform.w) * W
  else cx = (transform.x + transform.w / 2) * W

  const yCenter = (transform.y + transform.h / 2) * H
  const lines = wrapText(ctx, props.text, mw)
  const lineH = fs * TITLE_LINE_HEIGHT
  const totalH = lines.length * lineH
  const startY = yCenter - totalH / 2 + fs * 0.85
  lines.forEach((line, i) => ctx.fillText(line, cx, startY + i * lineH, mw))

  ctx.globalAlpha = 1
}
