import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// PHASE2_TASKS.md T11 — same hygiene guard as @audiogram/wave-effects
// (packages/wave-effects/src/package-hygiene.test.ts): this package must
// stay usable standalone (no react/tauri), so it's a real candidate for a
// future CLI/web demo without dragging the whole app along.
describe('package.json hygiene', () => {
  it('depends on @audiogram/contract only', () => {
    const here = path.dirname(fileURLToPath(import.meta.url))
    const pkg = JSON.parse(readFileSync(path.join(here, '..', 'package.json'), 'utf8'))
    expect(Object.keys(pkg.dependencies ?? {})).toEqual(['@audiogram/contract'])
  })
})
