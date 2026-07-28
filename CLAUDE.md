# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo layout

npm + Cargo workspace monorepo (moved here in Phase 1 T1/T15):

```
apps/desktop/          — the Tauri app (frontend src/ + src-tauri/)
packages/               — npm workspace packages
  contract/             — @audiogram/contract: generated TS constants (see Contract below)
  wave-effects/         — @audiogram/wave-effects: the 9 waveform draw plugins
  segments/             — @audiogram/segments: splitSegments/findSilence/ops (split/merge/delete)
crates/                 — Cargo workspace members
  audiogram-core/       — entities (Layout, WaveStyle, Segment...), AppError, contract_gen.rs
  audiogram-spectrum/   — STFT (rustfft) — compute_spectrum(), EQ_BANDS/EQ_BPS
  audiogram-render/     — pure frame rasterizer — render_frame_into(), wave/effects/*, no Tauri/ffmpeg
  audiogram-subtitle/   — .srt/.ass writers
contract/               — constants.json/zones.json + codegen.mjs (single source, generates into both
                          packages/contract and crates/audiogram-core/src/contract_gen.rs)
```

## Commands

```bash
# First-time setup (from repo root)
npm install              # installs JS deps + copies ffmpeg-static to apps/desktop/src-tauri/binaries/
npm run setup:whisper    # downloads/builds whisper-cpp binary + ggml-base.bin model

# Development (Vite dev server + Tauri window with hot reload)
npm run dev

# Production build
npm run build

# Regenerate contract/*.json → packages/contract + crates/audiogram-core/src/contract_gen.rs
npm run contract:gen

# Type-check / lint / test the frontend
npm run typecheck -w audiogram
npm run lint -w audiogram
npm run test                # runs every workspace package's tests (apps/desktop + packages/*)

# Rust: type-check / test the whole Cargo workspace
cargo check --workspace
cargo test --workspace      # includes crates/audiogram-render/tests/golden_frames.rs (parity guard)

# Full local CI sequence
npm run ci

# Override bundled FFmpeg during development
FFMPEG_PATH=/usr/local/bin/ffmpeg npm run dev
```

## Architecture

### Frontend (`apps/desktop/src/`, React 19 + TypeScript + Tailwind CSS 4)

Studio workspace shell (UI_REBUILD_PLAN.md), not a wizard: **START** (drop a file) → **STUDIO** (Design mode / Captions mode + Export sheet), never more than two screens.

```
app/            — composition root: shortcuts.ts (declarative table), menu.ts (native menu,
                  shares actions.ts with shortcuts), actions.ts (single action registry)
core/           — non-UI infrastructure, zero React except where noted
  ipc/          — client.ts (typed facade over bindings.gen.ts), events.ts, dragDrop.ts
  audio/        — AudioEngine (singleton, owns the one <audio> element + envelope decode)
  persistence/  — SessionRepository (session.json/recents.json via @tauri-apps/plugin-fs),
                  migrations.ts, attach.ts (store↔repository seam)
  assetUrl.ts   — convertFileSrc wrapper (so features/ never imports @tauri-apps/api directly)
domain/         — pure TypeScript, zero React/Tauri — audio.ts, format.ts, zones.ts,
                  preview/renderer.ts (the frame renderer, see Parity below)
extensions/     — kernel.ts (ExtensionPoint<T> registry) + templates/waves/palettes
                  registering existing data through one mechanism (TECH_ARCHITECTURE §3.1)
store/          — zustand, one flat store composed from slices (project/design/captions/
                  playback/render/ui) — field names never renamed across phases. Wrapped in
                  zundo's `temporal()` middleware (Phase 4 T9) for ⌘Z/⇧⌘Z undo/redo, scoped to
                  Design mode + caption edits only via `partializeTemporal()` — see ADR-0008.
features/       — start/ (StartScreen, DropZone, RecentGrid), studio/ (Toolbar, StudioLayout),
                  design/ (DesignPanel, CanvasStage, DesignInspector — Design mode's 3-pane split),
                  preview/ (PreviewCanvas, thumbnailer, WaveMiniPreview — shared leaf feature,
                  every other feature may import it, it imports none), transport/ (TransportBar)
ui/             — dumb primitives (Button, Select, SwatchRow, Modal, ...) — no store import
components/     — StepTranscript.tsx, StepExport.tsx: the last two pre-Phase-1 monoliths,
                  still driving Captions mode and the export step until Phase 3 ports them;
                  WaveformCanvas.tsx is now a thin adapter over domain/preview/renderer.ts
```

Import direction is enforced by `eslint.config.js`'s `import/no-restricted-paths`: `ui`/`domain`/`extensions` depend on nothing above them; `core` doesn't depend on `store`/`features`/`app`; `features/*` may not import each other directly (route through the store) except `features/preview`, which every feature may import.

### Backend (Tauri v2 + Rust, `apps/desktop/src-tauri/`)

Clean architecture, dependencies flow inward only:

```
domain/entities/       — Segment, Layout, WaveStyle, RenderJob, ModelSpec... (thin re-exports of crates/audiogram-core)
application/           — render.rs, transcribe.rs, model.rs (use-cases)
infrastructure/
  ffmpeg/              — resolver, render/mod.rs (spawns ffmpeg, orchestrates audiogram-render)
  subtitle/, spectrum/, whisper/ — re-export crates/audiogram-{subtitle,spectrum} + model_repo.rs
presentation/commands/ — the #[tauri::command] boundary (audio, video, transcript, utils)
```

### Preview ↔ Export Parity (critical invariant)

The canvas preview and the Rust renderer must produce identical output. **See ADRs 0002, 0003, 0005 in `docs/adr/` for full design rationale.**

**Constants (layout geometry, colors, text metrics)** live in **one place**: `contract/constants.json`, `contract/zones.json`, `contract/text.json`. Run `npm run contract:gen` to output both `packages/contract/src/index.ts` (TS) and `crates/audiogram-core/src/contract_gen.rs` (Rust). Do not hand-edit generated files or re-declare constants locally; import from `@audiogram/contract` (TS) or `audiogram_core::contract_gen` (Rust) instead.

**Layout geometry** (waveform rect, avatar center/radius, split column widths, subtitle zone) in each of the 6 layout match arms in `crates/audiogram-render/src/frame.rs` must mirror the corresponding draw function in `apps/desktop/src/domain/preview/renderer.ts` (`drawSpotify`/`drawSplit`/`drawMinimal`/`drawFullBg`/`drawKaraoke`/`drawBrand`) exactly. The preview renderer (`renderer.ts`) is the source of truth; `features/preview/PreviewCanvas.tsx` and `features/preview/thumbnailer.ts` both call its export `drawFrame()`.

**Subtitle zone positioning** (Phase 4 T2): `contract/zones.json` defines subtitle zone per layout. Both canvas preview and ASS export read the same zone; subtitle Y position is no longer hard-coded per layout in export (was P3 gap F-2, closed P4-T2).

**Title/caption text rendering** (Phase 4 T3): Rust side uses cosmic-text + bundled Inter font (Phase 3 T3); goldens now cover title text rendering end-to-end.

**Golden-frame test (Rust side):** `crates/audiogram-render/tests/golden_frames.rs` renders every (layout × all 9 wave styles × t={0%,25%,50%}) combination, now **including title text** ("The Quick Brown Fox Jumps" per layout, exercising text layout/wrapping). Byte-compares against committed PNGs under `crates/audiogram-render/tests/golden/`. Run with `cargo test -p audiogram-render --test golden_frames` (included in `cargo test --workspace` / CI). **Any change to contract constant, layout geometry, or text rendering in `frame.rs`/`text.rs`/`wave/*` will fail this test** — expected when intentional: delete affected golden PNG(s), regenerate, review diff images in `target/golden-diffs/` by eye for correctness, then commit updated PNGs alongside the code change. See ADR-0005 for regeneration protocol.

### EQ Wave Style

Two code paths, both frontend (`packages/wave-effects/src/eq.ts`) and Rust (`crates/audiogram-render/src/wave/effects/eq.rs`):
1. **Real FFT** — `analyze_spectrum` command decodes audio to 16 kHz mono PCM via FFmpeg, runs STFT (1024-point, Hann window, `EQ_BANDS` log-scale bands), returns `SpectrumResult { bands: Vec<f32>, n_buckets, n_bands }`, indexed `bands[t * EQ_BANDS + b]`. The frontend only fetches this when `waveStyle === 'eq'` (gated in `features/preview/useFftSpectrum.ts`, cached by path).
2. **Fallback simulation** — used when FFT data isn't loaded yet (preview) or decode failed (export). Time-stagger (bars read different sample indices, `LAG=2`) + asymmetric EMA (fast attack α=0.40, slow release α=0.045–0.10) to simulate a real spectrum analyzer.

### FFmpeg & Whisper Sidecars

Binaries are bundled per-platform in `apps/desktop/src-tauri/binaries/` and declared in `tauri.conf.json` under `bundle.externalBin`. The whisper model (`ggml-base.bin`, ~142 MB) lives in `apps/desktop/src-tauri/models/` and is copied to `app_data_dir` on first launch by `ModelService::seed_bundled`. Model downloads use `reqwest::blocking` streaming (not a `curl` subprocess) for progress.

FFmpeg resolution order at runtime: `FFMPEG_PATH` env var → system `PATH` (+ Homebrew paths on macOS) → executable dir → bundle resources. Binary names may carry a target-triple suffix (e.g. `ffmpeg-aarch64-apple-darwin`) per Tauri sidecar convention.

### Encoding Pipeline

`render_audiogram` (`infrastructure/ffmpeg/render/mod.rs`):
1. Spawns FFmpeg as a child process accepting raw RGBA frames on stdin.
2. For the `eq` style, pre-computes the FFT spectrum + a sequential EQ EMA state chain (one snapshot per frame) before the parallel frame loop.
3. Renders each frame via `audiogram_render::render_frame_into()` (pure Rust, no GPU, rayon-parallel across a batch) into a `w × h × 4` RGBA buffer, writes it to FFmpeg stdin in order.
4. FFmpeg encodes H.264 + AAC to a temp `.mp4`, then renames to the final output.
5. Emits both the legacy `render_progress`/`log` events and a structured `render_event` (`Stage`/`Progress`/`Log`/`Failed`/`Done`) that the frontend's `render.slice` consumes for stage/ETA/frame-count UI. `cancel_render` flips an `AtomicBool` checked once per batch.

### Font Mapping (Phase 4 T1)

`DesignInspector.tsx`'s font picker (Arial/Georgia/Impact/Verdana) is backed on the Rust side by bundled Liberation fonts (OFL license) rather than the OS's installed fonts: `resolve_font_family()` (`crates/audiogram-render/src/text.rs`) maps each picker name to a bundled family (Arial/Verdana/Impact → Liberation Sans, Georgia → Liberation Serif) seeded into `new_font_system()`'s `fontdb` alongside Inter. Export renders a deterministic, distinct font per selection (previously it silently always rendered Inter — Preview ↔ Export gap F-1, closed). The canvas preview still renders via a literal CSS `font-family` + fallback stack, so it may not be byte-identical to the bundled Liberation faces on every OS — see ADR-0007 for the full decision and that residual gap.

### Adding a New Tauri Command

1. Implement the function with `#[tauri::command]` `#[specta::specta]` in the appropriate `presentation/commands/*.rs` module.
2. Register it in `lib.rs`'s `specta_builder`/`invoke_handler`.
3. Run the app once (or `cargo run`) to regenerate `apps/desktop/src/core/ipc/bindings.gen.ts`.
4. Add a wrapper in `apps/desktop/src/core/ipc/client.ts`'s `ipc` object — components call `ipc.yourCommand(...)`, never `bindings.gen.ts` or `@tauri-apps/api/core` directly.
