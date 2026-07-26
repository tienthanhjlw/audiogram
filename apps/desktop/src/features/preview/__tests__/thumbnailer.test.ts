import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { registerBuiltins } from '../../../extensions'
import { useAppStore } from '../../../store'
import { LAYOUT_TEMPLATES } from '../../../types'
import { renderProjectThumb, renderTemplateThumb } from '../thumbnailer'

// jsdom has no real <canvas> 2D context (no node-canvas, deliberately —
// PHASE1_TASKS.md T17 step 3), so getContext()/toDataURL() are stubbed here
// the same way domain/preview/__tests__/renderer.test.ts stubs
// CanvasRenderingContext2D: a Proxy that no-ops every draw call, with
// measureText/gradient factories special-cased since drawFrame's arithmetic
// depends on their return shape. toDataURL returns a unique string per call
// so the cache test can tell "same call returned" apart from "coincidentally
// equal output".
let dataUrlCounter = 0
let originalGetContext: typeof HTMLCanvasElement.prototype.getContext
let originalToDataURL: typeof HTMLCanvasElement.prototype.toDataURL

function mockCtx(): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => {} }
  const target: Record<string, unknown> = {}
  return new Proxy(target, {
    get(t, prop) {
      if (typeof prop !== 'string') return undefined
      if (prop in t) return t[prop]
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradient
      if (prop === 'measureText') return (text: string) => ({ width: text.length * 6 })
      return () => {}
    },
    set(t, prop, value) { t[prop as string] = value; return true },
  }) as unknown as CanvasRenderingContext2D
}

beforeAll(() => {
  registerBuiltins()
  originalGetContext = HTMLCanvasElement.prototype.getContext
  originalToDataURL = HTMLCanvasElement.prototype.toDataURL
  // @ts-expect-error — test stub, not a full CanvasRenderingContext2D
  HTMLCanvasElement.prototype.getContext = () => mockCtx()
  HTMLCanvasElement.prototype.toDataURL = () => `data:image/png;base64,FAKE${dataUrlCounter++}`
})

afterAll(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext
  HTMLCanvasElement.prototype.toDataURL = originalToDataURL
})

describe('renderTemplateThumb', () => {
  it('renders all 6 built-in templates as data:image/png', () => {
    for (const t of LAYOUT_TEMPLATES) {
      const url = renderTemplateThumb(t.id)
      expect(url.startsWith('data:image/png')).toBe(true)
    }
  })

  it('caches by template id — second call returns the exact same string', () => {
    const first = renderTemplateThumb('minimal')
    const second = renderTemplateThumb('minimal')
    expect(second).toBe(first)
  })

  it('a different template produces a different cached string', () => {
    const minimal = renderTemplateThumb('minimal')
    const brand = renderTemplateThumb('brand')
    expect(minimal).not.toBe(brand)
  })
})

describe('renderProjectThumb', () => {
  it('returns null when there are no peaks yet', () => {
    useAppStore.setState({ peaks: [] })
    expect(renderProjectThumb()).toBeNull()
  })

  it('returns a data URL once peaks exist', () => {
    useAppStore.setState({ peaks: [0.1, 0.5, 0.3, 0.8] })
    const url = renderProjectThumb()
    expect(url?.startsWith('data:image/png')).toBe(true)
  })
})
