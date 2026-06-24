# Audiogram

A local-first desktop app that turns audio files into animated audiogram videos — the kind you see on social media with waveform visualizations and optional subtitles. Everything runs 100% offline. No accounts, no cloud, no telemetry.

Built with **Tauri v2** (Rust backend) + **React 19** (TypeScript frontend).

---

## Features

- Import audio: MP3, WAV, M4A, FLAC, AAC, OGG
- 3 canvas ratios: 16:9 (YouTube), 1:1 (Instagram), 9:16 (Reels)
- 6 layout templates: Podcast, Split, Minimal, Full Cover, Karaoke, Brand
- 3 waveform styles: Bars, Wave/line, Mirror
- Wave color, background color, font, font size customization
- Optional cover/avatar image
- AI transcription via bundled **whisper.cpp** (offline, base model)
- Manual segment editing with click-to-edit
- Karaoke highlight effect (word-by-word color sweep)
- Export to MP4 via bundled **FFmpeg**

---

## Prerequisites

- [Rust](https://rustup.rs/) (stable)
- [Node.js](https://nodejs.org/) 18+
- [Tauri CLI prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS

---

## Setup

```bash
# 1. Install JS dependencies (also copies ffmpeg-static into binaries/)
npm install

# 2. Download and build whisper-cpp binary + ggml-base.bin model
npm run setup:whisper

# Alternative: do both at once
npm run setup:bundle
```

The setup scripts place binaries at:
- `src-tauri/binaries/macos/ffmpeg` and `whisper-cpp`
- `src-tauri/binaries/linux/ffmpeg`
- `src-tauri/binaries/windows/ffmpeg.exe`
- `src-tauri/models/ggml-base.bin` (Whisper base model, ~142 MB)

---

## Development

```bash
npm run tauri dev
```

This starts the Vite dev server and the Tauri window with hot reload.

---

## Build

```bash
npm run tauri build
```

Produces a platform-specific installer (`.dmg` on macOS, `.msi`/`.exe` on Windows, `.AppImage`/`.deb` on Linux) in `src-tauri/target/release/bundle/`. FFmpeg and whisper-cpp are bundled — users don't need to install anything.

---

## Project Structure

```
audiogram/
├── src/                        # React frontend
│   ├── App.tsx                 # Root component, AppState, step routing
│   ├── types.ts                # All shared types and constants
│   ├── main.tsx                # React entry point
│   └── components/
│       ├── Sidebar.tsx         # Navigation sidebar
│       ├── StepUpload.tsx      # Step 1: file import + canvas/fps settings
│       ├── StepCustomize.tsx   # Step 2: layout + fine-tune controls
│       ├── StepTranscript.tsx  # Step 3: Whisper transcription + editor
│       ├── StepExport.tsx      # Step 4: render + export + logs
│       └── WaveformCanvas.tsx  # Live preview (rAF draw loop, Canvas 2D)
│
├── src-tauri/
│   ├── src/lib.rs              # All Rust backend logic
│   ├── src/main.rs             # Entry point — calls lib::run()
│   ├── Cargo.toml
│   ├── tauri.conf.json         # App config, bundle, sidecar declarations
│   ├── binaries/               # Bundled ffmpeg + whisper-cpp per platform
│   └── models/                 # ggml-base.bin Whisper model
│
├── scripts/
│   ├── copy-ffmpeg.mjs         # Copies ffmpeg-static into binaries/
│   └── setup-whisper.sh        # Downloads/builds whisper-cpp
│
├── index.html
├── package.json
└── TECH_PLAN.md                # Architecture notes
```

---

## How It Works

### UI Flow (4 steps)

`App.tsx` holds a single flat `AppState` object passed down to each step. Navigation is linear.

1. **Upload** — drag-and-drop or browse for an audio file; set canvas ratio and FPS; title is auto-filled from the filename.

2. **Customize** — pick a layout template (auto-applies default colors + wave style). Optional fine-tune panel for waveform style, colors, font, font size, and cover image. Live preview updates in real time via `WaveformCanvas`.

3. **Transcript** — triggers `transcribe_audio` Tauri command → runs whisper-cpp → returns timestamped segments → splits long segments intelligently by finding quiet points in the amplitude envelope → editable segment list. Toggle subtitles on/off, karaoke mode, highlight color.

4. **Export** — generates an `.ass` subtitle file (if subtitles enabled), then calls `render_audiogram`. Shows a summary card, an export button, and a live log console. The "Open Output Folder" button opens Finder/Explorer.

### Waveform Preview (`WaveformCanvas.tsx`)

On mount, the component fetches the audio file via `convertFileSrc`, decodes it with the Web Audio API, and builds a time-resolved amplitude envelope at 30 buckets/second. A `requestAnimationFrame` loop simulates audio playback and calls one of 6 layout draw functions each frame.

The 6 draw functions (`drawSpotify`, `drawSplit`, `drawMinimal`, `drawFullBg`, `drawKaraoke`, `drawBrand`) mirror the layout geometry used in the Rust renderer exactly — what you see in the preview is what you get in the export.

### Rust Backend (`src-tauri/src/lib.rs`)

All backend logic is in a single file. Key Tauri commands:

| Command | Description |
|---|---|
| `render_audiogram` | Generates RGBA frames in Rust, pipes them to FFmpeg stdin, encodes H.264 + AAC MP4. Emits `log` and `render_progress` events. |
| `transcribe_audio` | Converts audio to 16kHz WAV if needed, runs whisper-cpp, parses JSON output, returns `Segment[]`. |
| `write_srt` | Writes segments to a `.srt` file in the system temp dir. |
| `write_ass` | Writes an `.ass` subtitle file. Sets `PlayResX/PlayResY` to match video dimensions so libass scales `MarginV` correctly. Supports karaoke `\kf` tags. |
| `open_folder` | Opens a folder in the OS file manager. |
| `resolve_ffmpeg_path` | Debug helper — resolves and logs the bundled FFmpeg path. |

FFmpeg is located at runtime by checking (in order): `FFMPEG_PATH` env var → `PATH` → executable directory → bundle resources. Binary names may include a target triple suffix (e.g., `ffmpeg-aarch64-apple-darwin`) per the Tauri sidecar convention.

---

## Key Types (`src/types.ts`)

| Type | Values |
|---|---|
| `Step` | `'upload' \| 'customize' \| 'transcript' \| 'export'` |
| `LayoutTemplate` | `'spotify' \| 'split' \| 'minimal' \| 'fullbg' \| 'karaoke' \| 'brand'` |
| `WaveStyle` | `'bar' \| 'line' \| 'mirror'` |
| `CanvasSize` | `'16:9' \| '1:1' \| '9:16'` |
| `Segment` | `{ id, start, end, text }` — Whisper output unit |
| `AppState` | Flat object with all UI state |

Constants exported from `types.ts`: `LAYOUT_TEMPLATES`, `CANVAS_SIZES`, `WAVE_COLORS`, `BG_COLORS`, `WAVE_STYLES`.

---

## FFmpeg Override

If the bundled FFmpeg isn't found, set the `FFMPEG_PATH` environment variable to point to any FFmpeg binary:

```bash
FFMPEG_PATH=/usr/local/bin/ffmpeg npm run tauri dev
```

---

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Tauri extension](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
