import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// PHASE1_TASKS.md T17 step 2 — this package must not depend on react/tauri
// (it's meant to be usable standalone, e.g. a future web demo/CLI). Reading
// package.json directly rather than importing it keeps this test from
// silently passing if someone adds a dep without reading this file.
describe('package.json hygiene', () => {
  it('depends on @audiogram/contract only', () => {
    const here = path.dirname(fileURLToPath(import.meta.url))
    const pkg = JSON.parse(readFileSync(path.join(here, '..', 'package.json'), 'utf8'))
    expect(Object.keys(pkg.dependencies ?? {})).toEqual(['@audiogram/contract'])
  })
})
