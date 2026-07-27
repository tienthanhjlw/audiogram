# ADR 0006: Subtitle zones — Phase 3 canvas-only, Phase 4 export path

**Status:** Accepted (Phase 3 T5), Extended in Phase 4 T2  
**Date:** 2026-03-10  
**Authors:** Audiogram team  
**Context:** Subtitle (caption) positioning must be adjustable by users. Phase 3 focused on preview; export path remains for Phase 4.

## Phase 3 Decision (Current State)

**Canvas preview:**
- Each layout template includes a `LayoutZones` struct defining rectangular bounds for avatar, waveform, and subtitle
- Subtitle zone (`zones.subtitle`): `{ x, y, w, h }` as normalized fractions of canvas (0–1)
- `CanvasStage` (P2-T7) includes Rnd handles for dragging zones; `CaptionsInspector.tsx` (P3-T8) includes slider to adjust `subtitleYPct` (vertical position)
- Both preview drawer functions (`drawSplit`, etc. in `renderer.ts`) and Rust frame rasterizer (`frame.rs`) read from same zone spec via `contract/zones.json`

**Export (Rust ASS writer):**
- `crates/audiogram-subtitle/src/ass.rs`'s `ass_style()` function **does not yet read zones** — instead uses:
  - `subtitle_y_pct` (override from design/command-level, if provided)
  - Fallback hard-coded fraction per layout (e.g., `0.85` for Spotify)
- Result: Dragging subtitle zone in Design mode affects preview but **not the exported video** (F-2 gap identified in Phase 4 plan)

## Phase 4 T2 Extends This

**Decision:** Export ASS subtitles by adding `zones: Option<LayoutZonesDto>` to `WriteAssParams` command, and use `zones.subtitle.y` in `ass_style()` (with fallback for legacy paths).

This closes the preview-export gap for subtitle positioning.

## Rationale

1. **Two-phase approach**: Phase 3 focused on canvas geometry; export path deferred to Phase 4 to avoid scope creep
2. **Zone-based over coordinate-based**: Normalized fractions (0–1) are portable across different video resolutions; easier to re-use templates
3. **Fallback strategy for export**: Existing layouts may not have zones defined; fallback hard-coded fractions ensure backward compat

## Consequences

- **Phase 3 gap**: Preview-export parity for subtitle position is incomplete until Phase 4 T2
- **No subtitle zones in non-subtitle layouts**: Karaoke and Brand layouts don't have subtitle zones (captions drawn differently); ASS export path must handle `None` gracefully
- **Zone schema in contract**: New zone fields added in Phase 3 T5; export path must stay in sync if zones are redefined

## Known Issues Closed by Phase 4 T2

- F-2: "Kéo zone `subtitle` không tới export" — resolved by threading zones through ASS params
- Split layout's "2 con số trùng ngẫu nhiên" (`H*0.80` in preview vs `ml/mr/mv` in export) — both read from same zone source

## Related ADRs
- ADR-0002 (Layout parity principle applies to zones)
- ADR-0003 (Zone definitions in contract)
