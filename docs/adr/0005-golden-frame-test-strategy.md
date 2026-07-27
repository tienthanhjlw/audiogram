# ADR 0005: Golden-frame byte-identical test strategy

**Status:** Accepted (Phase 2 T12)  
**Date:** 2026-02-15  
**Authors:** Audiogram team  
**Context:** Pixel-perfect parity requires automated detection of unintended divergence. Manual inspection alone misses subtle bugs. Need a regression gate that is strict but not noisy.

## Decision

**Golden-frame test (`crates/audiogram-render/tests/golden_frames.rs`):**
- Renders every combination: 6 layouts × 9 waveform styles × 3 time samples (early/middle/late) = 162 frames
- Compares each output PNG against a **committed golden image** byte-for-byte via `assert_eq!()`
- On mismatch: test fails, diff image written to `target/golden-diffs/`, stdout logs the difference hash
- Committed golden PNGs live in `crates/audiogram-render/tests/golden/`

**Regeneration protocol (when intentional changes warrant updating goldens):**
1. Run test, let it fail with diff images
2. Inspect diff visually (`target/golden-diffs/`) against intent (e.g., layout redesign was expected)
3. Delete old golden PNG(s) — **never delete blindly to make test pass**
4. Re-run test to regenerate from current code
5. Commit new PNGs alongside code changes with message explaining why goldens changed

**Platform tolerance (if CI/local mismatch on text rendering):**
- Cosmic-text + Inter font bundle should be deterministic across platforms
- If macOS/Linux/Windows produce visually identical but byte-different images:
  - Investigate: Is it subpixel hinting? Platform-specific rasterizer? Library version?
  - If root cause is found and acceptable (e.g., expected FreeType 2.12 vs 2.13 difference on Linux), add platform-aware SSIM tolerance **only for that specific case**, not blanket — keep byte-comparison as default
  - Document platform tolerance in golden_frames.rs comment with issue link

## Rationale

1. **Byte-identity is conservative**: Catches floating-point errors, off-by-one coordinate bugs, unintended rendering path changes
2. **Visual diff review prevents waste**: Prevents regenerating 162 PNGs and committing garbage without noticing
3. **Deterministic across commits**: Goldens are part of version control; checking out an old commit still passes its goldens locally
4. **Regression detection**: If someone accidentally changes layout geometry by 1 pixel, test fails immediately, not discovered in user testing

## Consequences

- **No incremental golden deltas**: Cannot store "differences since last run" — must store full images (∼50 MB for 162 ×∼100KB PNGs per layout scale)
- **Test is slow**: Rendering 162 frames + I/O can take 30–60s depending on hardware; cannot run after every keystroke
- **Golden bloat if layout experimentation**: Many regenerations create large git history; squash commits if iterating on a single layout
- **Subpixel rendering is a known risk area**: macOS, Linux, Windows may render text slightly differently even with bundled fonts; Address via platform-specific SSIM tolerance only if empirically needed

## Phase 3 Gap

Golden-frame test in Phase 3 T12 intentionally **does not cover title/caption text** (hardcoded `&[]` for title) because text was being moved to Rust (T3). Phase 4 T3 extends coverage to include title rendering, closing this gap.

## Related ADRs
- ADR-0002 (Layout parity principle)
- ADR-0004 (Text rendering determinism)
