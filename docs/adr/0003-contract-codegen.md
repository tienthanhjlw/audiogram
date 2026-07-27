# ADR 0003: Contract as code generation source of truth

**Status:** Accepted (Phase 2 T1/T3, extended Phase 3 T5)  
**Date:** 2026-01-10  
**Authors:** Audiogram team  
**Context:** Both frontend (TS) and backend (Rust) need access to the same constants (layout zones, waveform bins, colors, text sizes). Keeping these in sync manually is error-prone.

## Decision

Single source of truth is **`contract/` directory** with JSON files + Node codegen:
- `contract/constants.json` → `packages/contract/src/index.ts` (TS) + `crates/audiogram-core/src/contract_gen.rs` (Rust)
- `contract/zones.json` → same targets (layout boundaries: avatar, waveform, text boxes per layout)
- `contract/text.json` → same targets (title/subtitle line height, max lines; added Phase 3 T5)
- `contract/codegen.mjs` reads all three, merges, camelCase → SCREAMING_SNAKE for Rust, outputs both files
- Run `npm run contract:gen` whenever any `contract/*.json` changes; output files are committed (not gitignored)

## Rationale

1. **DRY principle**: Single integer/float defined once, used everywhere
2. **Type safety**: Codegen creates TS types and Rust struct automatically; no manual copying
3. **Audit trail**: Git history of `constants.json` shows who changed what and when; codegen diff shows both generated files' impact at once
4. **Extensibility**: Added `text.json` in P3-T5 for line heights without restructuring; can add `colors.json` or other logical groups later

## Usage

Never manually edit `packages/contract/src/index.ts` or `crates/audiogram-core/src/contract_gen.rs`:
- Import from those generated modules instead of redeclaring elsewhere
- Example: `import { WAVE_BARS, EQ_BANDS, BG_DARK_TOP } from '@audiogram/contract'` (TS)
- Example: `use audiogram_core::contract_gen::{WAVE_BARS, EQ_BANDS, BG_DARK_TOP}` (Rust)

## Consequences

- Codegen errors block `npm run contract:gen` — must fix JSON syntax/schema
- Adding a new constant requires both: (1) edit `contract/*.json`, (2) run codegen, (3) commit both the JSON and the generated files
- TS and Rust constants are always **defined on same commit** — refactoring one side guarantees the other is in sync

## Related ADRs
- ADR-0002 (Layout parity depends on shared constants)
- ADR-0004 (Text constants in contract)
