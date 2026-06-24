# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# First-time setup
npm install              # installs JS deps + copies ffmpeg-static to binaries/
npm run setup:whisper    # downloads/builds whisper-cpp binary + ggml-base.bin model

# Development (starts Vite dev server + Tauri window with hot reload)
npm run tauri dev

# Production build (produces .dmg / .msi / .AppImage in src-tauri/target/release/bundle/)
npm run tauri build

# Rust type-check only (much faster than a full build)
cd src-tauri && cargo check

# TypeScript type-check only
npx tsc --noEmit

# Override bundled FFmpeg during development
FFMPEG_PATH=/usr/local/bin/ffmpeg npm run tauri dev
```

There are no automated tests. Manual verification is via the Tauri dev window.

## Architecture

### Frontend (React 19 + TypeScript + Tailwind CSS 4)

`App.tsx` owns a single flat `AppState` object and passes it + an `onChange` callback down to each step component. Navigation is linear: Upload → Customize → Transcript → Export.

- `src/types.ts` — all shared types (`AppState`, `Segment`, `WaveStyle`, `LayoutTemplate`, `CanvasSize`) and constants (`LAYOUT_TEMPLATES`, `CANVAS_SIZES`, `WAVE_STYLES`, `WAVE_COLORS`, `BG_COLORS`)
- `src/components/WaveformCanvas.tsx` — real-time canvas preview. On mount it calls `convertFileSrc` + Web Audio API to decode the audio file, builds a time-resolved amplitude envelope at `WAVE_BPS=120` buckets/second, and also calls `invoke('analyze_spectrum')` in parallel for the EQ style. A `requestAnimationFrame` loop drives the preview; the 6 layout draw functions (`drawSpotify`, `drawSplit`, `drawMinimal`, `drawFullBg`, `drawKaraoke`, `drawBrand`) must mirror Rust's layout geometry exactly.
- Each `Step*.tsx` component is a self-contained panel that reads `state` and calls `onChange(patch)`.

### Backend (Tauri v2 + Rust)

Domain-driven layout under `src-tauri/src/`:

```
lib.rs              — module declarations + Tauri builder wiring
ffmpeg.rs           — binary resolution (env → PATH → bundle), audio_duration, decode_pcm, to_wav
types.rs            — RenderParams, Segment (serde Deserialize/Serialize)
util.rs             — emit_log, ensure_executable, escape_drawtext, wrap_text_2lines, hex_to_rgb, time formatters
audio/
  spectrum.rs       — STFT via rustfft: compute_spectrum(), analyze_spectrum command, EQ_BANDS=40, EQ_BPS=30
video/
  mod.rs            — render_audiogram command, resolve_ffmpeg_path command, encode_blocking, build_filter_complex
  frame.rs          — render_frame(): background gradient + vignette + layout dispatch; shared constants
  wave.rs           — render_wave(): 8 waveform styles; wave_heights() envelope windowing
  pixel.rs          — RGBA pixel primitives (blend, fill_rect, draw_capsule_bar, fill_circle, etc.)
transcribe/
  mod.rs            — transcribe_audio command, whisper_path(), bundled_model(), seed_bundled_model()
  subtitle.rs       — write_srt command, write_ass command, ass_style(), subtitle_dir()
```

### Preview ↔ Export Parity (critical invariant)

The canvas preview and the Rust renderer must produce identical output. These constants are duplicated and **must stay in sync**:

| Constant | Frontend (`WaveformCanvas.tsx`) | Rust (`video/frame.rs`, `video/wave.rs`) |
|---|---|---|
| Display bars (non-EQ) | `WAVE_BARS = 64` | `WAVE_BARS: usize = 64` |
| Bar fill ratio | `BAR_FILL = 0.64` | `BAR_FILL: f32 = 0.64` |
| Gap fill ratio | `GAP_FILL = 0.36` | `GAP_FILL: f32 = 0.36` |
| EQ bands | `BARS = 40` (local in eq draw fn) | `EQ_BANDS: usize = 40` (`audio/spectrum.rs`) |
| Background vignette | 22% dark top → 50% dark bottom | `BG_DARK_TOP=0.22`, `BG_DARK_BOTTOM=0.50` |

Layout geometry (waveform rect coordinates, avatar center/radius, split column widths) in each of the 6 layout match arms in `video/frame.rs` must mirror the corresponding `draw*` function in `WaveformCanvas.tsx`.

### EQ Wave Style

The `eq` style has two code paths (both frontend and Rust):
1. **Real FFT** — `analyze_spectrum` Tauri command decodes audio to 16 kHz mono PCM via FFmpeg, runs STFT (1024-point, Hann window, 40 log-scale bands 60 Hz–7.8 kHz), returns `SpectrumResult { bands: Vec<f32>, n_buckets, n_bands }`. The flat `bands` array is indexed as `bands[t * EQ_BANDS + b]`.
2. **Fallback simulation** — used when FFT data isn't loaded yet (preview) or decode failed (export). Uses time-stagger (bars read different sample indices, `LAG=2`) + asymmetric EMA (fast attack α=0.40, slow release α=0.045–0.10) to simulate a real spectrum analyzer.

### FFmpeg & Whisper Sidecars

Binaries are bundled per-platform in `src-tauri/binaries/` and declared in `tauri.conf.json` under `bundle.externalBin`. The whisper model (`ggml-base.bin`, ~142 MB) lives in `src-tauri/models/` and is copied to `app_data_dir` on first launch by `seed_bundled_model()`.

FFmpeg resolution order at runtime: `FFMPEG_PATH` env var → system `PATH` (+ Homebrew paths on macOS) → executable dir → bundle resources. Binary names may carry a target-triple suffix (e.g. `ffmpeg-aarch64-apple-darwin`) per Tauri sidecar convention.

### Encoding Pipeline

`render_audiogram` (in `video/mod.rs`):
1. Spawns FFmpeg as a child process accepting raw RGBA frames on stdin.
2. For the `eq` style, pre-computes FFT spectrum (`decode_pcm` → `compute_spectrum`) before the frame loop.
3. Loops over frames, calling `render_frame()` (pure Rust, no GPU) to produce each `w × h × 4` RGBA buffer, writes to FFmpeg stdin.
4. FFmpeg encodes H.264 + AAC and writes to a temp `.mp4`, then renames to final output.
5. Emits `render_progress` (0–100) and `log` events to the frontend throughout.

### Adding a New Tauri Command

1. Implement the function with `#[tauri::command]` in the appropriate domain module.
2. Add `pub use` or re-export via `mod.rs` if needed.
3. Register it in `lib.rs` → `tauri::generate_handler![..., your_command]`.
4. Call from frontend via `invoke('your_command', { params })`.
