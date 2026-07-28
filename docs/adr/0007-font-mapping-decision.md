# ADR 0007: Font mapping — bundle Liberation fonts instead of Inter-only

**Status:** Accepted (Phase 4 T1)
**Date:** 2026-07-28
**Authors:** Audiogram team
**Context:** `DesignInspector.tsx`'s font picker listed Arial/Georgia/Impact/Verdana, but `crates/audiogram-render/src/text.rs` only bundled Inter — any non-Inter selection rendered as Inter on export while the canvas preview used whatever the OS actually had installed for that family. Preview and export could show different text for the same `fontName`, breaking the preview↔export parity invariant (F-1 in `PHASE4_TASKS.md` §0).

## Decision

**(a) Bundle 3 additional font families** rather than **(b) simplify the UI to Inter-only**.

- Downloaded 6 Liberation TTFs (OFL-licensed, metrically compatible with the fonts they map to) into `crates/audiogram-render/assets/fonts/`: LiberationSans-{Regular,Bold,Italic} and LiberationSerif-{Regular,Bold,Italic}.
- `new_font_system()` seeds all of them into `fontdb` alongside the existing bundled Inter faces; `resolve_font_family()` maps the UI's user-facing names to the bundled substitute (Arial/Verdana → Liberation Sans, Georgia → Liberation Serif), falling back to Inter for anything unrecognized.
- `font_name: String` threaded through `TextStyle`/`TitleSpec`/`RenderJob` so the Rust rasterizer picks a face by name instead of hard-coding "Inter".
- The Inspector's `FONT_OPTIONS` list (Arial/Georgia/Impact/Verdana) is unchanged — users still pick names they recognize; the substitution is invisible to them.

## Rationale

1. **Parity over minimalism**: the app's one hard invariant (`CLAUDE.md`) is that preview and export agree pixel-for-pixel. Locking the UI to Inter-only (option b) would have "solved" the gap by removing the choice, but real Arial/Georgia/Verdana are proprietary and can't be bundled — Liberation's metric-compatible substitutes get the same line-wrap behavior without a licensing problem.
2. **Bundle cost is acceptable**: ~1.6 MB added to the app bundle, a one-time download, not a per-render cost.
3. **No fontconfig dependency**: bundling (rather than querying the OS for installed fonts) keeps rendering deterministic across machines — the same guarantee Inter already had (ADR-0004), now extended to all 4 picker options.

## Consequences

- Golden-frame tests (`crates/audiogram-render/tests/golden_frames.rs`) that exercise non-Inter `fontName` values must stay byte-identical across machines, same as Inter — no fontconfig fallback path exists to introduce platform drift on the **export** side.
- Adding a 5th font option later repeats this same pattern (bundle + `resolve_font_family()` entry), not a schema change.
- **This closes the export-side gap, not the full preview↔export gap**: export now reliably renders a *distinct, deterministic* font per `fontName` (previously it silently always rendered Inter). The canvas preview (`renderer.ts`'s `drawTitle`) still sets `ctx.font` to the literal name plus a CSS fallback stack, so it renders whatever the OS actually has installed for "Arial"/"Georgia"/"Impact"/"Verdana" — which may not be visually identical to Liberation Sans/Serif on every OS. Making the two byte-identical for these 4 names would require the canvas preview to load the same bundled Liberation fonts via `@font-face` (as it already does for Inter Variable, `package.json`'s `@fontsource-variable/inter`) — out of scope for T1, noted here as a smaller residual gap if a future task wants to close it fully.

## Related ADRs
- ADR-0004 (Text rendering determinism — cosmic-text + bundled fonts, no OS fontconfig)
- ADR-0002 (Layout parity principle)
