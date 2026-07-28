# Audiogram — Kế hoạch Công nghệ (Local-first)

> Mục tiêu: ứng dụng chuyển audio → video podcast chạy **100% offline**, không cần server, trên cả PC (Windows/macOS/Linux) và Mobile (iOS/Android).

---

## 1. Chiến lược tổng thể

Thay vì xây hai codebase riêng biệt, dùng **monorepo** với một lớp shared TypeScript ở giữa:

- **PC** → Tauri v2 (Rust shell + WebView, nhẹ hơn Electron ~10×)
- **Mobile** → Expo / React Native
- **Shared** → React UI components + business logic dùng chung

Toàn bộ dữ liệu lưu trên filesystem của người dùng. Không có tài khoản, không có cloud sync, không gửi byte nào ra ngoài.

---

## 2. Tech Stack

### PC — Tauri v2

| Tầng | Công nghệ | Lý do chọn |
|------|-----------|------------|
| Native shell | **Tauri v2** (Rust) | Nhẹ (~8 MB), truy cập FS/Shell an toàn |
| UI framework | **React 18 + TypeScript** | Tái sử dụng component với Mobile |
| Styling | **TailwindCSS + shadcn/ui** | Nhất quán với design system |
| Build tool | **Vite** | Nhanh, HMR tốt |
| Audio analysis | **Web Audio API** | Native, không cần lib |
| Waveform render | **Wavesurfer.js + OffscreenCanvas** | Render không block UI thread |
| Video encoding | **FFmpeg binary** (bundled) | Gọi qua Tauri shell command |
| Effects render | **WebGL / OffscreenCanvas** | Xuất frame PNG sequence |
| Storage | **Tauri FS plugin + JSON** | File-based, không cần DB |

### Mobile — Expo (React Native)

| Tầng | Công nghệ | Lý do chọn |
|------|-----------|------------|
| Framework | **Expo SDK 52** | Managed workflow, OTA update |
| UI | **React Native + NativeWind** | Tailwind syntax cho RN |
| Audio | **expo-av** | Playback + waveform data |
| High-perf render | **react-native-skia** | GPU-accelerated waveform |
| Video encoding | **ffmpeg-kit-react-native** | Full FFmpeg trên iOS & Android |
| File I/O | **expo-file-system** | Đọc/ghi local files |
| Gallery export | **expo-media-library** | Lưu video vào Camera Roll |

### Shared packages

```
packages/shared/
├── types/          → AudioProject, ExportSettings, WaveformStyle...
├── utils/          → trim calculator, color helpers, duration parser
└── presets/        → preset effects (Bars, Wave, Circle, Mirror)
```

---

## 3. Pipeline xử lý video (core flow)

```
Audio file (MP3/WAV/M4A)
        │
        ▼
[1] Decode audio
    Web Audio API (PC) / expo-av (Mobile)
    → Float32Array PCM data
        │
        ▼
[2] Analyse waveform
    Chia PCM thành N chunks = số frame cần render
    Tính amplitude tại mỗi frame
        │
        ▼
[3] Render frames
    OffscreenCanvas (PC) / Skia Canvas (Mobile)
    Mỗi frame = 1 PNG (1080×1080 hoặc 1920×1080)
    Chạy trong Web Worker / background thread
        │
        ▼
[4] Encode video
    FFmpeg nhận: frame sequence + audio file
    Command: ffmpeg -r 30 -i frame_%04d.png -i audio.mp3
             -c:v libx264 -c:a aac -shortest output.mp4
        │
        ▼
[5] Output
    MP4 / GIF / WebM → lưu vào folder người dùng chọn
```

**Ước tính thời gian xử lý** (audio 3 phút, 1080p, 30fps):
- Render frames: ~15–30s (chạy song song với Web Worker pool)
- FFmpeg encode: ~20–45s tuỳ CPU
- Tổng: dưới 1 phút trên máy tầm trung

---

## 4. Cấu trúc Monorepo

```
audiogram/
├── apps/
│   ├── desktop/                 ← Tauri app
│   │   ├── src-tauri/           ← Rust backend
│   │   │   ├── src/main.rs
│   │   │   └── tauri.conf.json
│   │   └── src/                 ← React frontend
│   │       ├── main.tsx
│   │       ├── pages/
│   │       │   ├── Landing.tsx
│   │       │   ├── Create.tsx
│   │       │   ├── Projects.tsx
│   │       │   └── Customise.tsx
│   │       └── workers/
│   │           └── frameRenderer.worker.ts
│   │
│   └── mobile/                  ← Expo app
│       ├── app/                 ← Expo Router
│       │   ├── index.tsx        ← Landing
│       │   ├── create.tsx
│       │   ├── projects.tsx
│       │   └── customise.tsx
│       └── modules/
│           └── ffmpeg/          ← FFmpeg Kit wrapper
│
├── packages/
│   ├── shared/                  ← Types + utils dùng chung
│   ├── ui-core/                 ← React components (dùng cho Tauri)
│   └── presets/                 ← Waveform effect presets
│
├── assets/
│   └── ffmpeg/                  ← FFmpeg binary (bundled vào Tauri)
│       ├── ffmpeg-win.exe
│       ├── ffmpeg-mac
│       └── ffmpeg-linux
│
├── pnpm-workspace.yaml
└── package.json
```

---

## 5. Lưu trữ dữ liệu (hoàn toàn local)

Không dùng database. Mỗi project là một folder:

```
~/Documents/Audiogram/
├── projects/
│   ├── ep47-deep-dive/
│   │   ├── project.json         ← metadata
│   │   ├── source.mp3           ← audio gốc (copy vào đây)
│   │   ├── thumbnail.png        ← frame đầu tiên
│   │   └── exports/
│   │       └── ep47_1080p.mp4
│   └── workshop-highlights/
│       └── ...
└── settings.json                ← cài đặt toàn cục
```

`project.json` schema:
```json
{
  "id": "uuid",
  "name": "EP 47 — The Deep Dive",
  "createdAt": "2026-06-20T10:00:00Z",
  "audioFile": "source.mp3",
  "trim": { "start": 0, "end": 140 },
  "canvasSize": "1:1",
  "waveformStyle": "bars",
  "waveformColor": "#6C4FF6",
  "bgColor": "#1a1a2e",
  "caption": "The future of podcasting...",
  "font": "Inter",
  "fontSize": 24,
  "logoPath": null,
  "exports": [
    { "format": "mp4", "quality": "1080p", "path": "exports/ep47_1080p.mp4" }
  ]
}
```

---

## 6. Luồng xử lý FFmpeg (chi tiết)

### Xuất MP4 (chất lượng cao)
```bash
ffmpeg \
  -framerate 30 \
  -i frames/frame_%04d.png \
  -i source.mp3 \
  -ss {trim_start} -to {trim_end} \
  -c:v libx264 -preset fast -crf 18 \
  -c:a aac -b:a 192k \
  -pix_fmt yuv420p \
  -shortest \
  output.mp4
```

### Xuất GIF (tối ưu palette)
```bash
# Bước 1: tạo palette
ffmpeg -i frames/frame_%04d.png -vf palettegen palette.png

# Bước 2: render GIF với palette
ffmpeg -framerate 15 -i frames/frame_%04d.png \
  -i palette.png -lavfi paletteuse output.gif
```

### Xuất WebM (web-friendly)
```bash
ffmpeg -framerate 30 -i frames/frame_%04d.png \
  -i source.mp3 -ss {start} -to {end} \
  -c:v libvpx-vp9 -b:v 2M \
  -c:a libopus -b:a 128k \
  -shortest output.webm
```

---

## 7. Performance — tối ưu hoá

**Frame rendering không block UI:**
Web Worker pool (4 workers) render song song, mỗi worker nhận một range frame.

```typescript
// frameRenderer.worker.ts
self.onmessage = ({ data: { frames, waveformData, style, colors } }) => {
  const canvas = new OffscreenCanvas(1080, 1080);
  const ctx = canvas.getContext('2d');
  
  for (const frame of frames) {
    renderWaveformFrame(ctx, waveformData[frame.index], style, colors);
    const blob = canvas.convertToBlob({ type: 'image/png' });
    self.postMessage({ frameIndex: frame.index, blob });
  }
};
```

**Mobile — render với Skia:**
react-native-skia dùng GPU, render 30fps waveform animation mượt trên iPhone/Android tầm trung.

**Tiết kiệm dung lượng:**
Frames PNG tạm thời → xoá ngay sau khi FFmpeg encode xong. Chỉ giữ file output cuối.

---

## 8. Phân phối & cài đặt

### PC
| Nền tảng | Output | Cách cài |
|----------|--------|----------|
| Windows | `.msi` hoặc `.exe` | Double-click |
| macOS | `.dmg` | Kéo vào Applications |
| Linux | `.AppImage` hoặc `.deb` | CLI hoặc package manager |
| Build tool | `tauri build` | Tự động tạo installer |

FFmpeg binary được **bundle sẵn** trong app — người dùng không cần cài thêm gì.

### Mobile
| Nền tảng | Phân phối |
|----------|-----------|
| iOS | TestFlight → App Store |
| Android | APK sideload → Google Play |
| Build | `eas build --platform all` (Expo EAS) |

---

## 9. Roadmap kỹ thuật

### Phase 1 — MVP Desktop (4–6 tuần)
Tauri scaffold, Web Audio decode, OffscreenCanvas render bars style, FFmpeg MP4 export, project save/load.

### Phase 2 — Effects & Polish (2–3 tuần)
Wave / Circle / Mirror styles, caption overlay, logo watermark, colour picker, trim slider.

### Phase 3 — Mobile (3–4 tuần)
Expo app, ffmpeg-kit integration, Skia waveform, expo-media-library export.

### Phase 4 — Quality (2 tuần)
Worker pool tối ưu, progress reporting, batch export, preset templates, auto-update (Tauri updater + Expo OTA).

---

## 10. Dependencies tóm tắt

```jsonc
// Desktop (apps/desktop/package.json)
{
  "@tauri-apps/api": "^2",
  "@tauri-apps/plugin-fs": "^2",
  "@tauri-apps/plugin-shell": "^2",
  "@tauri-apps/plugin-dialog": "^2",
  "wavesurfer.js": "^7",
  "react": "^18",
  "vite": "^5",
  "tailwindcss": "^3"
}

// Mobile (apps/mobile/package.json)
{
  "expo": "~52.0.0",
  "expo-av": "~15.0.0",
  "expo-file-system": "~18.0.0",
  "expo-media-library": "~17.0.0",
  "@shopify/react-native-skia": "^1",
  "ffmpeg-kit-react-native": "^6",
  "nativewind": "^4"
}
```

---

*Toàn bộ dữ liệu ở lại máy người dùng. Không có analytics, không có telemetry, không có network request.*
