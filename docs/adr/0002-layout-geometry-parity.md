# ADR 0002: Layout geometry parity between canvas and FFmpeg render

**Status:** Accepted (Phase 3 T3/T4)  
**Date:** 2026-01-15  
**Authors:** Audiogram team  
**Context:** Preview on canvas and final exported video must look identical. Layout geometry (waveform rectangle, avatar, text positioning) must match exactly.

## Decision

**Golden Rule:** The preview renderer (`apps/desktop/src/domain/preview/renderer.ts`) and Rust renderer (`crates/audiogram-render/src/frame.rs`) must produce pixel-identical output for the same input.

- All layout constants (e.g., `WAVE_BARS`, `EQ_BANDS`, `BAR_FILL`, `BG_DARK_TOP`/`BG_DARK_BOTTOM`) live in **single source**: `contract/constants.json`
- Each of 6 layouts (`Spotify`, `Split`, `Minimal`, `FullBg`, `Karaoke`, `Brand`) has exactly **one definition** on the TS side (`drawSpotify`, etc.) and one on Rust (`Layout::Spotify` match arm) — they are paired and must move together
- Geometry verification is handled by **golden-frame tests**: TS previews all layouts × all waveform styles × time samples, outputs PNG → committed to `crates/audiogram-render/tests/golden/`, byte-compared on every run
- Byte-identical golden PNGs are expected *except* when a change is intentional (layout redesign, font rendering difference between platforms)

## Rationale

1. **Prevent preview-export divergence**: Without strict parity, users see one thing on screen, export delivers another — classic usability trap
2. **Single source for constants** (not hand-copy): Avoids arithmetic mistakes, easier to audit changes
3. **Golden frames as a runtime gate**: Catches parity breaks automatically in CI/locally; manual diff review prevents blind regeneration (→ ADR-0005)

## Consequences

- **No constants in code**: Fractions like `0.84` for title width must go through `contract/`, not hard-coded in `frame.rs` or `renderer.ts`
- **Test runs are slow**: 168+ golden PNGs × file I/O; golden-frame test is a hard gate before any merge (cannot be skipped)
- **Cross-platform font rasterization**: Cosmic-text + bundled Inter font should be byte-identical, but subpixel rendering or hinting differences between macOS/Linux/Windows require platform-aware tolerances (SSIM, not exact bytes, in edge cases; see ADR-0004)
- **Layout changes require golden regeneration**: Cannot refactor a layout without updating the committed PNGs; diff images (`target/golden-diffs/`) must be reviewed for correctness before committing new PNGs

## Related ADRs
- ADR-0001 (Stack)
- ADR-0003 (Contract codegen)
- ADR-0004 (Text rendering)
- ADR-0005 (Golden-frame strategy)
