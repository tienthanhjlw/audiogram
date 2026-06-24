# Audiogram — Agent Steering Guide

## What this project is

A local-first Tauri v2 desktop app that converts audio files into animated audiogram MP4 videos. 100% offline — no network requests, no accounts, no analytics.

**Stack:** React 19 + TypeScript (Vite) for the frontend; Rust (Tauri v2) for the native backend. Bundled FFmpeg and whisper-cpp binaries — no external deps for the user.

---

## Repository layout

```
src/                    React frontend
  App.tsx               Root — holds AppState, step routing, onChange
  types.ts              ALL shared types and constants — read this first
  components/
    Sidebar.tsx         Navigation sidebar
    StepUpload.tsx      Step 1 — file picker, canvas size, FPS
    StepCustomize.tsx   Step 2 — layout template, fine-tune, cover image
    StepTranscript.tsx  Step 3 — Whisper transcription, segment editor, karaoke
    StepExport.tsx      Step 4 — render trigger, summary, log console
    WaveformCanvas.tsx  Live preview — rAF canvas loop, 6 layout draw functions
    TranscriptPanel.tsx (legacy — not used in main flow)

src-tauri/src/lib.rs    ALL Rust backend — single file
src-tauri/src/main.rs   Entry point — calls lib::run()
src-tauri/tauri.conf.json  App config, bundle targets, sidecar declarations
src-tauri/binaries/     Bundled ffmpeg + whisper-cpp per platform
src-tauri/models/       ggml-base.bin Whisper model
scripts/
  copy-ffmpeg.mjs       Copies ffmpeg-static npm package into binaries/
  setup-whisper.sh      Downloads/builds whisper-cpp binary + model
```

---

## State management

`App.tsx` owns a single flat `AppState` object (defined in `types.ts`). It passes `onChange(patch: Partial<AppState>)` down to every step component. There is no external state library. Steps are: `upload → customize → transcript → export`.

When adding new state fields, add them to:
1. The `AppState` interface in `types.ts`
2. The `DEFAULT_STATE` object in `App.tsx`

---

## Frontend conventions

- **Styling:** 100% inline JSX styles (CSS-in-JS). TailwindCSS is in `devDependencies` but not actively used in components. Do not add class-based Tailwind unless refactoring everything.
- **No UI library:** all components are hand-rolled with inline styles. Match the existing visual style (colors: `#6C4FF6` purple primary, `#111827` text, `#E5E7EB` border, `#F3F4F6` secondary bg).
- **Tauri IPC:** use `invoke` from `@tauri-apps/api/core` for Rust commands. Use `listen` from `@tauri-apps/api/event` for events. File dialogs use `@tauri-apps/plugin-dialog`.
- **No routing library.** Navigation is `state.step` switching in `App.tsx`.

---

## WaveformCanvas — the live preview

`WaveformCanvas.tsx` is critical. Key facts:

- Decodes audio via `fetch(convertFileSrc(audioPath))` + Web Audio API → builds amplitude envelope at `WAVE_BPS = 30` buckets/second.
- `requestAnimationFrame` loop calls one of 6 layout functions: `drawSpotify`, `drawSplit`, `drawMinimal`, `drawFullBg`, `drawKaraoke`, `drawBrand`.
- **The canvas layout geometry MUST match the Rust renderer geometry in `lib.rs`.** If you move a waveform position in one place, update the other.
- Preview simulates playback by looping on wall-clock time (`ts / 1000`).
- `WAVE_BARS = 64` bars windowed over the envelope, centered on current time. `waveHeights()` in TypeScript mirrors `wave_heights()` in Rust.

---

## Rust backend (`src-tauri/src/lib.rs`)

Everything is in one file. Tauri commands exposed to the frontend:

| Command (snake_case) | Frontend invoke key | What it does |
|---|---|---|
| `render_audiogram` | `render_audiogram` | Generates raw RGBA frames in Rust, pipes to FFmpeg stdin, encodes MP4. Emits `log` + `render_progress` events. |
| `transcribe_audio` | `transcribe_audio` | Runs bundled whisper-cpp, parses JSON, returns `Vec<Segment>`. |
| `write_srt` | `write_srt` | Writes `.srt` to temp dir, returns path. |
| `write_ass` | `write_ass` | Writes `.ass` subtitle file. Sets `PlayResX/PlayResY` to match video size so libass positions text correctly. Supports karaoke `\kf` tags. |
| `open_folder` | `open_folder` | Opens folder in OS file manager. |
| `resolve_ffmpeg_path` | `resolve_ffmpeg_path` | Debug helper. |
| `ping` | `ping` | Health check. |

**Frame generation:** `render_frame()` fills a `Vec<u8>` RGBA pixel buffer. No image crate — pure manual pixel math with `blend()`, `fill_rect()`, `draw_gradient_circle()`, etc. `render_wave()` uses `wave_heights()` which mirrors the TypeScript version exactly.

**FFmpeg resolution order:** `FFMPEG_PATH` env var → `PATH` → executable dir → bundle resources. Filenames may carry a target triple suffix (e.g., `ffmpeg-aarch64-apple-darwin`).

**Subtitle format:** always use ASS (not SRT + force_style). `write_ass` sets `PlayResX/PlayResY` to video dimensions so `MarginV` is in video pixels — SRT+force_style was broken (libass ignored `Alignment`).

---

## Adding a new layout template

1. Add entry to `LAYOUT_TEMPLATES` array in `src/types.ts` with all required fields.
2. Add a `drawXxx(dc: DC)` function in `WaveformCanvas.tsx`. Follow the existing pattern — use `drawBg`, `drawWaveform`, `drawAvatar`, `drawTitle`, `drawSubtitle`, `drawWatermark` helpers.
3. Add a matching branch in `render_frame()` in `src-tauri/src/lib.rs`. The waveform rect (`wx`, `wy`, `ww`, `wh`) must match the TypeScript `drawWaveform` call exactly.
4. Add an `LayoutSVG` case in `StepCustomize.tsx` for the template picker card thumbnail.
5. Add per-layout subtitle position in `write_ass` in `lib.rs` (the `match layout` block).

---

## Adding a new Tauri command

1. Write the Rust function in `src-tauri/src/lib.rs` with `#[tauri::command]`.
2. Register it in the `invoke_handler!` macro in `lib::run()`.
3. Call it from TypeScript with `invoke<ReturnType>('command_name', { param: value })`.
4. Add any needed Tauri plugin or capability in `tauri.conf.json` + `capabilities/default.json`.

---

## Build & dev commands

```bash
npm install            # install JS deps + run copy-ffmpeg.mjs
npm run setup:whisper  # download whisper-cpp binary + ggml-base.bin
npm run tauri dev      # dev mode with hot reload
npm run tauri build    # production build + installer
```

To override FFmpeg at dev time: `FFMPEG_PATH=/path/to/ffmpeg npm run tauri dev`

---

## Things to avoid

- Do not break the pixel-exact correspondence between `WaveformCanvas.tsx` draw positions and `render_frame()` in `lib.rs`. The preview is the contract.
- Do not add a subtitle file via SRT + `force_style` — use ASS only (libass ignores `Alignment` in force_style mode).
- Do not send any data to external servers. This app is intentionally 100% offline.
- Do not add a state management library — the flat `AppState` + `onChange(patch)` pattern is intentional.
- Do not use Tailwind classes on new components unless refactoring the whole styling approach.
