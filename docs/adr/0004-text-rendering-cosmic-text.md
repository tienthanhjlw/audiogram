# ADR 0004: Text rendering via cosmic-text + bundled Inter font (Rust side only at Phase 3)

**Status:** Accepted (Phase 3 T3, Phase 4 T1 to extend)  
**Date:** 2026-02-20  
**Authors:** Audiogram team  
**Context:** Title and subtitle must render identically between preview (canvas) and export (Rust). Canvas can use system fonts; Rust needs control over font files. Phase 3 T3 moved title rendering to Rust; font picker gaps remain.

## Decision

**Phase 3 (current):**
- Title is rasterized in Rust via `cosmic-text` library using **bundled Inter font only** (static files in `crates/audiogram-render/assets/fonts/`)
- `new_font_system()` initializes `fontdb` with just Inter; no system font fallback
- `draw_text()` accepts text, position, size, color, align, bold/italic flags — maps to cosmic-text `Attrs`
- Canvas preview (TS) currently uses `ctx.font = "...Arial, Georgia, ..."` with system fonts, creating a preview-export gap for non-Inter fonts (F-1 in Phase 4 TASKS)

**Phase 4 T1 will resolve via decision:**
- **(a) Bundle 3–4 additional font families** (Liberation Sans for Arial, Liberation Serif for Georgia, Impact equivalent, etc.) — if machine-readable OFL/MIT licensed faces exist
- **(b) Simplify UI to Inter-only** — remove font picker from `DesignInspector`, lock `fontName` to `'Inter'`

## Rationale

1. **Rust-native rendering**: No dependency on fontconfig, no system-font variance across machines → reproducible exports
2. **Cosmic-text is performant**: Instant text layout, good CJK support, minimal dependencies
3. **Bundled fonts ensure consistency**: Same bytes on all platforms → same glyph metrics → same layout
4. **defer font picker decision to Phase 4**: Choice (a) vs (b) has UI/UX implications; Phase 3 focuses on title geometry parity

## Consequences

- **No system font fallback**: If a requested font name is not in `fontdb`, cosmic-text falls back to first-added family (currently Inter) — not an error, but silent
- **Font subset/instancing**: If choosing (a) in Phase 4, may need `fonttools instancer` to reduce file size (static weight per family, drop CJK if not needed)
- **Canvas vs Rust styling gap in Phase 3**: Until Phase 4 T1, preview shows system fonts, export shows Inter — documented as known gap (F-1)
- **Adding fonts requires commit**: New font files in `assets/fonts/`, update `new_font_system()`, regenerate/review golden frames

## Related ADRs
- ADR-0002 (Parity principle)
- ADR-0003 (Text sizes in contract)
- ADR-0005 (Golden-frame test strategy for text)
