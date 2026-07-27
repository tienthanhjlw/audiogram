# Figma → Code: Implementation Plan
*Design nguồn: Audiogram App — UI Design (Figma)*
*Ngày lập kế hoạch: 25/06/2026*

---

## Tổng quan thay đổi

Design Figma khác app hiện tại ở 5 điểm lớn:

| Khía cạnh | Hiện tại | Figma Design |
|-----------|----------|--------------|
| Theme | Light (nền #F9FAFB) | **Dark** (nền ~#0A0A14) |
| Navigation | Sidebar 220px + step pills (2 hệ thống) | **Top navbar duy nhất** (không sidebar) |
| Branding | "audiogram" | **"Audiogram Studio"** |
| Thứ tự bước | Import→Layout→Transcript→Export | **Upload→Transcript→Design→Export** |
| Upload screen | Drop zone đơn giản | **Hero section + template gallery + drop zone** |
| Transcript | 2 cột đơn giản | **3 cột + timeline editor** |
| Export | Summary + LOGS terminal | **Export Settings + Rendering Progress steps** |

---

## Design Tokens (từ Figma)

```css
/* Colors */
--bg-base:      #0A0A14;   /* main background */
--bg-surface:   #13131F;   /* cards, panels */
--bg-elevated:  #1A1A2E;   /* dropdowns, modals */
--border:       #2A2A3C;   /* borders */

--accent-purple: #7C4DFF;  /* primary CTA, active step */
--accent-green:  #00E676;  /* waveform, success states */
--accent-purple-light: #A78BFA; /* hover states */

--text-primary:   #FFFFFF;
--text-secondary: #9CA3AF;
--text-muted:     #4B5563;

/* Typography */
--font-family: 'Inter', system-ui, sans-serif;

/* Step states */
--step-active:    bg #7C4DFF, text white
--step-done:      icon ✓ green, text gray
--step-pending:   text gray, dashed connector
```

---

## Phase 1 — Dark Theme + Top Navbar (Ưu tiên cao nhất)
**Thời gian ước tính: 1 ngày**
**Files cần sửa: App.tsx, index.css / global styles, tauri.conf.json**

### 1.1 Window size
```json
// tauri.conf.json
"width": 1280, "height": 800,
"minWidth": 960, "minHeight": 640
```

### 1.2 Global dark theme
```css
/* index.css */
body {
  background: #0A0A14;
  color: #FFFFFF;
  font-family: 'Inter', system-ui, sans-serif;
}
```
Thêm Google Fonts Inter vào index.html:
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### 1.3 Xóa Sidebar hoàn toàn
- Xóa `src/components/Sidebar.tsx`
- Bỏ import Sidebar trong `App.tsx`
- Bỏ `display: flex` + sidebar layout trong App wrapper

### 1.4 Tạo TopNav mới
```tsx
// src/components/TopNav.tsx
// Layout: [Logo] [Upload →① Transcript →② Design →③ Export] [? ⚙]

Steps: Upload(1), Transcript(2), Design(3), Export(4)

Step states:
- Completed: ✓ icon + gray text
- Active: filled purple pill (background #7C4DFF)
- Pending: gray text + dashed connector "---"
- Arrow connectors: → between steps
```

### 1.5 Reorder steps
```typescript
// src/types.ts
export type Step = 'upload' | 'transcript' | 'design' | 'export'
// Đổi 'layout' → 'design', đổi thứ tự: transcript lên trước design
```

---

## Phase 2 — Upload Screen
**Thời gian ước tính: 0.5 ngày**
**File: src/components/StepUpload.tsx**

### Layout mới: 2 cột
```
┌─────────────────────┬──────────────────────────┐
│  Hero Content       │  Drop Zone               │
│                     │                          │
│  "Create stunning   │  [Upload icon]           │
│   audiograms in     │  Drop your audio here    │
│   minutes"          │  MP3, WAV, M4A up to 2GB │
│                     │  or                      │
│  ✓ AI Transcription │  [Select Audio File]     │
│  ✓ Auto Subtitles   │                          │
│  ✓ Beautiful Templates                         │
│  ✓ Social Media Ready                          │
│                     │                          │
│  [▶ Watch Example]  │                          │
│                     │                          │
│  Example Audiogram: │                          │
│  [5 template cards] │                          │
└─────────────────────┴──────────────────────────┘
```

### Template gallery (5 cards có visual thumbnail):
- Spotify Style — ảnh/màu đại diện + waveform animation
- Podcast — dark bg + waveform
- Minimal — pure waveform
- News — split layout
- TikTok Reel — 9:16 vertical

Mỗi card: `160×100px`, dark border, badge "▶ 0:30" ở góc.

---

## Phase 3 — Transcript Screen (redesign lớn nhất)
**Thời gian ước tính: 2 ngày**
**File: src/components/StepTranscript.tsx (viết lại)**

### Layout mới: 3 cột + timeline

```
┌─────────────┬────────────────────┬──────────────────┐
│  Segments   │   Edit Segment     │   Live Preview   │
│             │                    │                  │
│ [Search...] │  00:00.00-00:04.20 │  [Canvas 16:9]   │
│             │                    │                  │
│  1 ████████ │  [Text editor]     │  Waveform +      │
│  Welcome to │                    │  subtitle live   │
│             │  [✂ ⊞ 🗑]         │                  │
│  2 ████     │                    │  00:02 / 00:30   │
│  Perfect    │  Start    End      │                  │
│             │  [00:00.00][00:04] │                  │
│  3 ████████ │                    │                  │
│  Our AI...  │  [▶ Play Segment]  │                  │
│             │                    │                  │
│  + Add Seg  │                    │                  │
├─────────────┴────────────────────┴──────────────────┤
│  [▶] Timeline: |00:00──00:05──00:10──00:15──00:30|  │
│  [+]          [████████][████][██████████][████]    │
└─────────────────────────────────────────────────────┘
```

### Thay đổi so với hiện tại:
- Model selector → di chuyển vào modal/settings riêng (không chiếm main UI)
- Thêm search bar trên danh sách segments
- Thêm segment editor với Start/End time inputs
- Thêm Play Segment button
- Thêm Timeline ở dưới với segment blocks draggable
- "Live Preview" thay cho preview độc lập (bỏ split layout hiện tại)
- Playback controls nằm dưới preview (đúng vị trí)

---

## Phase 4 — Design Screen (đổi tên từ Layout)
**Thời gian ước tính: 1 ngày**
**File: src/components/StepDesign.tsx (rename từ StepLayout.tsx)**

### Layout: 2 cột

```
┌──────────────────────────┬────────────────────────┐
│  Canvas Preview          │  Properties Panel      │
│                          │                        │
│  [Your Podcast Title]    │  [Basic] [Advanced]    │
│  [Episode #123]          │                        │
│  [~~waveform~~]          │  Title: [_________]    │
│                          │  Subtitle: [_______]   │
│  [16:9▼] [─●───] 100%   │  Cover Image: [img][×] │
│                          │                        │
│           [Preview Full] │  Theme: ● ● ● ● + [+] │
│                          │  Font: [Inter        ▼]│
│                          │  Opacity: [────●───]   │
└──────────────────────────┴────────────────────────┘
```

### Khác với layout hiện tại:
- **Bỏ inspector click-zone pattern** → thay bằng static right panel "Basic/Advanced"
- **Basic tab**: Title, Subtitle, Cover Image, Theme colors, Font, Opacity
- **Advanced tab**: Canvas Size, FPS, Wave Style, Wave Color, BG Color (items kỹ thuật hơn)
- Preview Full button → fullscreen preview overlay
- Zoom slider dưới canvas (thay vì trong panel bên trái)

---

## Phase 5 — Export Screen
**Thời gian ước tính: 0.5 ngày**
**File: src/components/StepExport.tsx**

### Layout: 3 cột

```
┌──────────────────┬────────────────────┬────────────────┐
│  Export Settings │  Rendering Progress│  Preview       │
│                  │                    │                │
│  Resolution      │  ✓ Analyzing Audio │  [Canvas]      │
│  [1920×1080 ▼]   │  ✓ Generating      │                │
│                  │    Transcript      │  Export Info   │
│  Frame Rate      │  ✓ Generating Wave │  Time: 2-4 min │
│  [30 FPS    ▼]   │  ◉ Rendering Frames│  Size: ~150MB  │
│                  │    In Progress     │  Out: video.mp4│
│  Quality         │  ○ Encoding Video  │                │
│  [High Rec. ▼]   │    Waiting         │                │
│                  │  ○ Finalizing      │                │
│  Format          │    Waiting         │                │
│  [MP4 H.264 ▼]   │                    │                │
│                  │                    │                │
│  Output Name     │                    │                │
│  [audiogram .mp4]│                    │                │
│                  │                    │                │
│  [Start Export]  │                    │                │
└──────────────────┴────────────────────┴────────────────┘
```

### Thay đổi:
- **Xóa LOGS panel hoàn toàn**
- **Rendering Progress** = checklist với 6 bước rõ ràng (không phải % đơn thuần)
- **Export Settings** = dropdowns đẹp thay vì summary table chỉ đọc
- Resolution dropdown: 1920×1080 Full HD, 1080×1080 Instagram, 1080×1920 Reels
- Preview panel bên phải nhỏ + Export Info bên dưới

---

## Phase 6 — Polish & Extras (nếu có thời gian)
**Thời gian ước tính: 1-2 ngày**

### 6.1 Component library chuẩn hóa
- Button: Primary (purple), Secondary, Ghost, Danger
- Input Field: dark border, focus ring purple
- Dropdown: custom styled (không dùng native select)
- Toggle switch: custom animated
- Progress indicator: step với connectors

### 6.2 Micro-animations
- Step transition: fade + slide (200ms)
- Segment click: highlight sweep
- Export progress: step check animation
- Waveform: đang có rồi, giữ nguyên

### 6.3 "Watch Example" modal
- Click "▶ Watch Example" → overlay với embedded audiogram demo

---

## Thứ tự implementation được đề xuất

```
Day 1:  Phase 1 (Dark theme + TopNav + window size)
Day 2:  Phase 2 (Upload screen) + Phase 5 (Export screen)
Day 3:  Phase 4 (Design screen - đổi tên + Basic/Advanced tabs)
Day 4-5: Phase 3 (Transcript - redesign lớn nhất)
Day 6:  Phase 6 (Polish)
```

---

## Files cần tạo/sửa

| File | Action | Ghi chú |
|------|--------|---------|
| `src/types.ts` | Sửa | Đổi Step type, rename 'layout'→'design' |
| `src/App.tsx` | Sửa lớn | Xóa sidebar, thêm TopNav, reorder steps |
| `src/components/TopNav.tsx` | **Tạo mới** | Top navigation với step pills |
| `src/components/Sidebar.tsx` | **Xóa** | Không còn dùng |
| `src/components/StepUpload.tsx` | Sửa lớn | 2-col hero + template gallery |
| `src/components/StepTranscript.tsx` | Sửa lớn | 3-col + timeline |
| `src/components/StepDesign.tsx` | **Rename từ StepLayout** + sửa | Basic/Advanced tabs |
| `src/components/StepExport.tsx` | Sửa | Export settings + progress steps |
| `src/store.ts` | Sửa nhỏ | Cập nhật step type |
| `index.html` | Sửa nhỏ | Thêm Inter font |
| `src/index.css` | Sửa | Dark theme base styles |
| `src-tauri/tauri.conf.json` | Sửa | Window size |

---

## Rủi ro cần lưu ý

1. **Step reorder (Transcript trước Design)**: State flow hiện tại `upload→layout→transcript→export`. Nếu đổi sang `upload→transcript→design→export`, cần đảm bảo subtitle style settings (vốn ở layout) vẫn accessible. → Giải pháp: chuyển subtitle color/font sang Design step.

2. **3-col Transcript**: Màn 1280×800 có thể chật. Cần min-width per column và responsive handling.

3. **Template gallery thumbnails**: Cần có ảnh thực hoặc tạo SVG mock. Có thể dùng canvas render nhỏ hoặc static PNG.

4. **Inter font**: Cần kết nối internet lần đầu (Google Fonts). Nên bundle font vào assets.

5. **"Audiogram Studio" rebrand**: Cần đổi trong `tauri.conf.json` `productName` và window title nữa.
