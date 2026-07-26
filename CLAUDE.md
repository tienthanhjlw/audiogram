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
                  playback/render/ui) — field names never renamed across phases
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

The canvas preview and the Rust renderer must produce identical output. Render constants live in **one place**, `contract/constants.json`, generated by `npm run contract:gen` into `packages/contract/src/index.ts` (TS) and `crates/audiogram-core/src/contract_gen.rs` (Rust) — do not hand-edit either generated file or re-declare a constant locally; import `WAVE_BARS`/`BAR_FILL`/`GAP_FILL`/`EQ_BANDS`/`EQ_BPS`/`WAVE_BPS`/`BG_DARK_TOP`/`BG_DARK_BOTTOM`/`SPLIT_BPS` from the generated module instead.

Layout geometry (waveform rect coordinates, avatar center/radius, split column widths) in each of the 6 layout match arms in `crates/audiogram-render/src/frame.rs` must mirror the corresponding draw function in `apps/desktop/src/domain/preview/renderer.ts` (`drawSpotify`/`drawSplit`/`drawMinimal`/`drawFullBg`/`drawKaraoke`/`drawBrand`) exactly. That file — not `WaveformCanvas.tsx`, which is now just a thin prop-adapter around it — is the actual preview-side renderer; `features/preview/PreviewCanvas.tsx` and `features/preview/thumbnailer.ts` both call its one export, `drawFrame()`.

**Golden-frame test (Rust side):** `crates/audiogram-render/tests/golden_frames.rs` renders every (layout × {bar, eq, orb} × t={0%,25%,50%}) combination against fixed deterministic input and byte-compares it to a PNG committed under `crates/audiogram-render/tests/golden/`. Run with `cargo test -p audiogram-render --test golden_frames` (also included in `cargo test --workspace` / CI). **Any change to a contract constant or to layout/waveform geometry in `frame.rs`/`wave/*` will fail this test** — expected when the change is intentional: delete the affected golden PNG(s), rerun to regenerate them, review the new PNGs by eye (and the diff image written to `target/golden-diffs/` on a mismatch), then commit the updated goldens alongside the code change. This crate draws no text (title/subtitle are ffmpeg `drawtext`/libass, outside `audiogram-render`), so there's no font-rendering source of cross-machine flakiness for it to worry about.

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

### Adding a New Tauri Command

1. Implement the function with `#[tauri::command]` `#[specta::specta]` in the appropriate `presentation/commands/*.rs` module.
2. Register it in `lib.rs`'s `specta_builder`/`invoke_handler`.
3. Run the app once (or `cargo run`) to regenerate `apps/desktop/src/core/ipc/bindings.gen.ts`.
4. Add a wrapper in `apps/desktop/src/core/ipc/client.ts`'s `ipc` object — components call `ipc.yourCommand(...)`, never `bindings.gen.ts` or `@tauri-apps/api/core` directly.
