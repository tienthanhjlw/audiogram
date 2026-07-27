# Audiogram — UI Design Spec chi tiết (màn hình · popup · cụm control)
*Ngày lập: 25/07/2026 · Thực thi cho: `UI_REBUILD_PLAN.md` · Branch: `design-dark`*

Spec này mô tả **từng màn hình, từng popup, từng cụm control** của UI mới, kèm kích thước, trạng thái, hành vi phím, và mapping về field trong `store.ts`. Mục tiêu: dev (hoặc Claude) cầm spec này code được từng phần mà không phải tự quyết định thêm.

**Quy ước chung:**
- Token màu/spacing lấy từ `UI_REBUILD_PLAN.md` §3.1 (`--bg-app #0E0E16`, `--bg-panel #16161F`, `--bg-elevated #1E1E2A`, `--bg-canvas-pit #08080D`, `--border #262633`, `--accent #7C5CFF`, `--text-1/2/3`).
- Mọi số đo theo 4-pt grid. Font UI: Inter (bundle). Timecode: `tabular-nums`, 11–12px.
- Mọi control có 5 trạng thái chuẩn: `default / hover / active(pressed) / focused(ring 2px accent) / disabled(opacity .4 + tooltip lý do)`.
- Ngôn ngữ UI: **tiếng Anh** toàn bộ.

---

## MỤC LỤC
1. [Shell & cửa sổ](#1-shell--cửa-sổ)
2. [Màn hình START](#2-màn-hình-start)
3. [STUDIO — Toolbar](#3-studio--toolbar)
4. [STUDIO — Design mode](#4-studio--design-mode)
5. [STUDIO — Captions mode](#5-studio--captions-mode)
6. [Transport bar](#6-transport-bar)
7. [Export Sheet](#7-export-sheet)
8. [Dialog & popup phụ](#8-dialog--popup-phụ)
9. [Control primitives](#9-control-primitives-srccomponentsui)
10. [Parity checklist — store field → UI mới](#10-parity-checklist)

---

## 1. Shell & cửa sổ

### 1.1 Cửa sổ
```json
// tauri.conf.json
"title": "Audiogram", "width": 1280, "height": 800,
"minWidth": 1000, "minHeight": 680,
"titleBarStyle": "Overlay", "hiddenTitle": true, "center": true
```

### 1.2 Grid tổng của STUDIO (`shell/StudioLayout.tsx`)

```
┌────────────────────────────────────────────────────────┐
│ TOOLBAR                                    height 48px │
├──────────┬──────────────────────────────┬──────────────┤
│ LEFT     │ CANVAS STAGE                 │ INSPECTOR    │
│ PANEL    │ (flex 1, min 480px)          │ 280px fixed  │
│ 280px    │ bg: --bg-canvas-pit          │              │
│ fixed    │                              │              │
├──────────┴──────────────────────────────┴──────────────┤
│ TRANSPORT                                  height 64px │
└────────────────────────────────────────────────────────┘
```

- LEFT PANEL & INSPECTOR: bg `--bg-panel`, border phân cách 1px `--border`, nội dung scroll riêng (`overflow-y: auto`, scrollbar 6px overlay, chỉ hiện khi hover).
- Ở minWidth 1000: 280 + 480(min canvas) + 280 = 1040 > 1000 → **INSPECTOR co xuống 240px khi cửa sổ < 1080px** (CSS `container query` hoặc resize observer). Không bao giờ ẩn panel.
- Chuyển mode Design ↔ Captions: nội dung 2 panel bên fade-slide 150ms (`opacity 0→1, translateY 4px→0`); canvas + transport đứng yên tuyệt đối.

### 1.3 Titlebar / drag region
- Toàn bộ TOOLBAR có `data-tauri-drag-region`.
- macOS: chừa 78px trống bên trái cho traffic lights. Windows: dùng decorations mặc định, không chừa (đọc `platform()` một lần lúc mount).

---

## 2. Màn hình START

**File:** `screens/StartScreen.tsx` · Hiện khi `screen === 'start'` (chưa có `audioPath` và user chưa vào studio).

### 2.1 Layout

```
┌────────────────────────────────────────────────────┐
│ (titlebar drag strip 48px, trong suốt, chỉ logo nhỏ│
│  "≈ Audiogram" 13px text-2, căn giữa)              │
│                                                    │
│              ┌──────────────────────┐              │
│              │      DROP ZONE       │              │
│              │  ≈ icon 48px accent  │              │
│              │  "Drop audio here"   │  ← 17px w600 │
│              │  "MP3 · WAV · M4A ·  │  ← 12px t-3  │
│              │   FLAC · AAC · OGG"  │              │
│              │  [ Open Audio… ⌘O ]  │  ← Button md │
│              └──────────────────────┘              │
│                 max-w 520px, pad 56px 40px         │
│                                                    │
│  RECENT ────────────────────────────── (11px t-3)  │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐      │
│  │ thumb  │ │ thumb  │ │ thumb  │ │        │      │
│  │ 160×90 │ │        │ │        │ │        │      │
│  └────────┘ └────────┘ └────────┘ └────────┘      │
│   name 12px                                        │
│   "2 days ago · 1:24" 11px t-3                     │
└────────────────────────────────────────────────────┘
```

### 2.2 Cụm control: Drop zone
| Thuộc tính | Giá trị |
|---|---|
| Kích thước | max-width 520, min-height 260, radius `--radius-l`, border 1.5px dashed `--border` |
| Default | bg `--bg-panel` |
| Hover | border-color `--text-3`, cursor pointer (click = mở dialog) |
| **Drag-over** | border solid `--accent`, bg `--accent-soft`, icon scale 1.08 (120ms), text đổi "Release to import" |
| Drop file sai định dạng | shake 300ms + toast "Unsupported format. Use MP3, WAV, M4A, FLAC, AAC or OGG." |
| Hành vi | Click bất kỳ đâu trong zone = `open()` dialog (KHÔNG có nút "Browse files" riêng — 1 target duy nhất; nút `Open Audio… ⌘O` là chính target đó, đặt trong zone) |

Filter dialog: `['mp3','wav','m4a','flac','aac','ogg']` (giữ nguyên hiện tại). Sau khi chọn/thả file hợp lệ: set `audioPath/audioName/title` (auto-title từ filename như logic hiện có `StepUpload.tsx:23`), → `screen:'studio'`, `mode:'design'` ngay lập tức. **Không có bước xác nhận trung gian** — file info hiển thị trong toolbar.

### 2.3 Cụm control: Recent projects
- Chỉ hiện khi `session.json` có ≥1 entry. Grid `auto-fill minmax(160px, 1fr)`, gap 16, tối đa 8 items.
- **Card:** thumbnail 160×90 (PNG đã render lúc save session), radius `--radius-m`, border 1px `--border`; hover: border `--accent`, overlay nút ▶ mờ; click = load session → STUDIO.
- Dưới thumbnail: tên project (title, 12px, 1 dòng ellipsis) + meta "`{relative time}` · `{duration}`" 11px `--text-3`.
- Context menu (chuột phải): `Open` / `Reveal Audio in Finder` / `Remove from Recents`.
- File audio không còn tồn tại: thumbnail mờ 40% + badge "File missing"; click → dialog **Locate file** (§8.4).

---

## 3. STUDIO — Toolbar

**File:** `shell/Toolbar.tsx` · Cao 48px, bg `--bg-panel`, border-bottom 1px `--border`. 3 vùng:

```
[⬤⬤⬤  78px] [♪ episode-01.mp3 ▾]     [Design | Captions]      [Export ⌘E]
└── trái ─────────────────────┘  └──── giữa (căn giữa) ────┘  └── phải ──┘
```

### 3.1 Cụm trái: File chip
- Chip: icon ♪ 14px + `audioName` (max 240px, ellipsis giữa — giữ đuôi file) + caret ▾. Cao 30px, radius `--radius-s`, bg transparent, hover bg `--bg-elevated`.
- Click → **dropdown menu** (bg `--bg-elevated`, radius `--radius-m`, shadow, min-w 220px):

| Item | Hành vi |
|---|---|
| `Open Audio…  ⌘O` | dialog mở file; nếu đã có project → hỏi Replace (§8.2) |
| `Open Recent ▸` | submenu 8 entries gần nhất |
| ─ divider ─ | |
| `Replace Audio…` | đổi audio, GIỮ layout/transcript settings → dialog xác nhận §8.2 |
| `Reveal in Finder` | `open_folder` với dir của audioPath |
| ─ divider ─ | |
| `New Project` | reset về START (confirm nếu có edits chưa export) |

### 3.2 Cụm giữa: Mode switcher
- `SegmentedControl` 2 items: `Design` (⌘1) · `Captions` (⌘2). Cao 32px, item pad 0 16px, 13px w500.
- Active: bg `--bg-elevated`, text `--text-1`, thumb slide 150ms. Inactive: text `--text-2`.
- Badge trên `Captions` khi `segments.length > 0`: số segments trong pill nhỏ 10px (VD "Captions · 11").

### 3.3 Cụm phải: Export
- `Button primary md` — label `Export`, hint `⌘E` mờ bên phải trong nút. Disabled khi `!audioPath` hoặc `isRendering === false` là điều kiện thường; khi **đang render**: nút biến thành progress chip `◔ 42%` (click = mở lại Export Sheet đang thu nhỏ).

---

## 4. STUDIO — Design mode

### 4.1 LEFT PANEL — Template & Wave galleries

**File:** `panels/DesignPanel.tsx`. Cấu trúc dọc, pad 16, gap 24:

#### Cụm 1 — TEMPLATE (label 11px uppercase `--text-3`)
- Grid 2 cột, gap 8. **6 card** từ `LAYOUT_TEMPLATES`.
- **Card anatomy** (mỗi card):
  - Thumbnail 16:9 phía trên (width đầy card ≈ 124px, cao ≈ 70px, radius-s trên): **ảnh render thật** — dùng chính draw functions của `WaveformCanvas` vẽ template với dummy peaks + màu default của template vào offscreen canvas, xuất dataURL, cache trong module-level Map (render 1 lần sau khi app mount, không chờ audio).
  - Dưới: tên template 12px w600 + tags ratio (`1:1` `9:16`) 9px `--text-3`.
  - Default: border 1px `--border` · Hover: border `--text-3` · **Selected: border 1.5px `--accent` + check ✓ 14px góc phải trên thumbnail**.
- Click = `handleTemplateChange` (giữ logic hiện tại `StepLayout.tsx:91` — reset zones, áp defaults của template). **Nếu user đã chỉnh zones/màu:** hiện confirm nhỏ inline dạng popover "Switching template resets layout & colors. [Switch] [Cancel]" — chỉ khi `zones !== null` hoặc màu ≠ default cũ.

#### Cụm 2 — WAVE STYLE
- Grid 2 cột, gap 8. **9 card** từ `WAVE_STYLES` (bar/line/mirror/dot/neon/orb/pulse/eq/player).
- **Card anatomy:** mini canvas 108×44 chạy **live animation** bằng fallback simulation của chính effect đó (mỗi card 1 rAF chung — 1 loop vẽ cả 9 canvas, chỉ chạy khi panel visible & mode=design; pause khi blur window). Dưới: label 11px w500 căn giữa.
- Selected/hover states như template card.
- Style `eq` khi FFT chưa load: vẫn chạy simulation (chính là hành vi fallback hiện có).
- Ghi chú: cụm này điều khiển `waveStyle` — TRÙNG với Inspector Waveform (§4.3.2). Đây là chủ ý: gallery để duyệt nhanh, inspector chỉnh chi tiết; cả hai cùng bind `store.waveStyle`.

### 4.2 CANVAS STAGE

**File:** `panels/CanvasStage.tsx` — port từ phần preview của `StepLayout.tsx` (giữ nguyên logic Rnd zones).

```
┌───────────────────────────────────────────┐
│   (pit bg #08080D, canvas căn giữa)       │
│        ┌─────────────────────┐            │
│        │   WaveformCanvas    │            │
│        │   + zone overlays   │            │
│        └─────────────────────┘            │
│                                           │
│  [16:9|1:1|9:16]      fit ─●── 100% ⛶    │ ← stage footer 36px
└───────────────────────────────────────────┘
```

- Canvas: shadow `0 16px 56px rgba(0,0,0,.55)`, radius 8, fit trong pit với margin 32px mọi phía; scale theo cửa sổ.
- **Stage footer** (thanh 36px trong pit, không phải panel riêng): trái = SegmentedControl ratio (`16:9 · 1:1 · 9:16` → `canvasSize`, label tooltip "YouTube 1280×720" v.v. từ `CANVAS_SIZES`); phải = zoom control (v1: chỉ "Fit" mặc định — zoom slider để v1.1, chừa chỗ) + nút ⛶ fullscreen preview (overlay đen, Esc thoát).
- **Zone overlays** (giữ từ code hiện tại, nâng cấp):
  - Idle: KHÔNG vô hình nữa — mỗi zone có border 1px dashed `rgba(255,255,255,.07)` để user biết có thứ click được (fix "hidden interaction", DESIGN_REVIEW §B).
  - Hover: border dashed màu element (`EL_META` giữ nguyên: wave #6C4FF6 · title #F59E0B · subtitle #22C55E · avatar #EC4FC4) + label tag góc trên trái.
  - Selected: border solid 2px + 8 resize handles (Rnd) + label tag. Đồng bộ: chọn zone ⇄ Inspector đổi section (§4.3).
  - Kéo/resize: giữ logic fraction 0–1 hiện có (`updateZone`). Khi kéo: hiện guide line căn giữa canvas (dọc + ngang, 1px accent 50%) và snap ±8px.
  - `Esc` = bỏ chọn. `Delete` không xoá zone (zones là cố định theo template) — không hành động.
- **Inline title edit:** giữ nguyên pattern hiện tại (click title zone khi đã selected → contentEditable, Enter/Esc/blur = commit/exit; `StepLayout.tsx:317`).
- **First-run hint:** lần đầu vào Design mode (flag trong session.json): tooltip mũi tên trỏ vào canvas "Click any element on the canvas to edit it" — tự dismiss sau click đầu hoặc 8s.
- **Reset layout:** nút ghost nhỏ hiện ở stage footer phải (cạnh zoom) CHỈ khi `zones !== null`: "Reset layout" → confirm popover nhỏ → `set({zones:null})`.

### 4.3 INSPECTOR (phải, 280px)

**File:** `panels/DesignInspector.tsx`. Nội dung phụ thuộc `selectedEl` (state cục bộ studio, không vào store).

#### 4.3.0 Header inspector
- 40px: chấm màu element 8px + tên (`Canvas` / `Waveform` / `Title` / `Subtitle` / `Avatar`) 13px w600. Khi có element chọn: nút `×` phải = deselect (không dùng nút "←" như cũ — inspector không phải navigation stack).

#### 4.3.1 Khi `selectedEl === null` → **Canvas (global)**
| Cụm | Control | Bind |
|---|---|---|
| BACKGROUND | Swatch row: 6 màu `BG_COLORS` + custom color well | `bgColor` |
| COVER IMAGE *(chỉ khi `template.needsAvatar`)* | Image well 248×80: empty = dashed "Add cover image · JPG PNG WEBP"; filled = ảnh cover + hover overlay 2 nút `Replace` `Remove` | `coverImagePath` |
| TITLE TEXT | Text input 1 dòng (đồng bộ 2 chiều với inline edit trên canvas) | `title` |

*(Canvas size đã ra stage footer; FPS chuyển sang Export Sheet — không còn trong inspector.)*

#### 4.3.2 `selectedEl === 'wave'` → **Waveform**
| Cụm | Control | Bind |
|---|---|---|
| STYLE | Select (dropdown, custom) 9 styles — gọn hơn gallery, đồng bộ với nó | `waveStyle` |
| COLOR | Swatch row 7 màu `WAVE_COLORS` + custom | `waveColor` |
| POSITION | Row 4 ô số nhỏ read-only X/Y/W/H (%) — hiển thị zone hiện tại, giúp user hiểu drag làm gì; v1 read-only | `zones.waveform` |

#### 4.3.3 `selectedEl === 'title'` → **Title**
| Cụm | Control | Bind |
|---|---|---|
| TEXT | Text input | `title` |
| COLOR | Swatch row `WAVE_COLORS` + custom | `titleColor` |
| FONT | Select: Arial · Georgia · Impact · Verdana (item render bằng chính font đó) | `fontName` |
| SIZE | Slider 70–140 step 5, value label "100%" bên phải | `fontSize` |
| FORMAT | Toggle-button row: `[≡left][≡center][≡right]` + `[B][I]` (icon buttons 32×28, group liền) | `titleAlign` `titleBold` `titleItalic` |

> Lưu ý: `fontName`/`fontSize` hiện áp cho cả subtitle (render dùng chung). Spec v1 giữ nguyên hành vi — đặt ở Title inspector, tooltip ghi "Also applies to captions".

#### 4.3.4 `selectedEl === 'subtitle'` → **Subtitle**
Chỉ style *vị trí/màu preview*; nội dung captions ở mode Captions.
| Cụm | Control | Bind |
|---|---|---|
| COLOR | Swatch row 6 `SUBTITLE_COLORS` + custom | `subtitleColor` |
| KARAOKE | Toggle "Karaoke highlight" + khi bật: swatch row 6 `KARAOKE_COLORS` + custom | `karaokeEnabled` `karaokeColor` |
| — | Hint 11px: "Edit caption text in Captions mode →" (link chuyển mode) | |

Toggle karaoke disabled khi `segments.length === 0` → tooltip "Transcribe audio first (Captions mode)".

#### 4.3.5 `selectedEl === 'avatar'` → **Avatar**
| Cụm | Control | Bind |
|---|---|---|
| IMAGE | Image well (như §4.3.1) | `coverImagePath` |
| POSITION | X/Y/W/H read-only như wave | `zones.avatar` |

---

## 5. STUDIO — Captions mode

### 5.1 LEFT PANEL — Transcribe + Segment list

**File:** `panels/CaptionsPanel.tsx`.

```
┌──────────────────────────────┐
│ TRANSCRIBE cluster           │
│ Model: [Base ✓ ▾]            │
│ [🎙 Transcribe]              │
├──────────────────────────────┤
│ [🔍 Search captions…]        │
│ 11 SEGMENTS                  │
│ ┌──────────────────────────┐ │
│ │ ▶ 0:00→0:01  1.9s        │ │
│ │ Kinh thánh là nơi         │ │
│ ├──────────────────────────┤ │
│ │ ...(virtualized list)... │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

#### Cụm 1 — Transcribe (cao ~92px, luôn hiển thị trên cùng)
- **Model select** (1 dòng, thay cả block model picker cũ): trigger hiện `Model: Base · 142 MB ✓`. Dropdown mở **Model popover** (§8.5) — nơi chứa download/progress. Bind `whisperModel`.
- **Nút Transcribe** `Button primary md` full-width:
  - Chưa có segments: `🎙 Transcribe` 
  - Đã có: `↺ Re-transcribe` (variant secondary) → confirm dialog §8.1
  - Đang chạy: spinner + `Transcribing… 12s` (đếm elapsed như hiện tại), nút disabled, **thanh loading indeterminate 2px** chạy dưới nút
  - `!audioPath` không xảy ra (Captions chỉ vào được từ studio đã có audio)
- Lỗi transcribe: inline alert đỏ dưới nút (12px, bg `#F87171` 12%, border `#F87171` 40%) + nút `Retry`.

#### Cụm 2 — Search
- Input với icon 🔍, placeholder `Search captions…`, cao 32px. Filter client-side theo text (case/diacritic-insensitive). Khi có query: list chỉ hiện match, count đổi "3 of 11 segments"; Esc trong input = clear.

#### Cụm 3 — Segment list (Virtuoso — giữ từ code hiện tại)
**Row anatomy** (pad 8 10, radius-s, gap dọc 4):
```
▶  0:00.0 → 0:01.9   [1.9s]        ← hàng meta 10px mono
Kinh thánh là nơi                   ← text 12.5px, line-height 1.5
```
| Trạng thái | Style |
|---|---|
| Default | bg transparent, border 1px transparent |
| Hover | bg `--bg-elevated` |
| **Active (playhead trong range)** | bg `--accent-soft`, border-left 2px `--accent`, text w500; auto-scroll vào giữa (giữ logic `scrollToIndex` hiện có) |
| Selected (click) | border 1px `--accent` |
| Editing | text thành textarea auto-height, border `--accent`, Enter=commit, Esc=cancel, ⌘Enter=commit+chọn segment kế |
| Duration badge | `<1.2s` bg amber (giữ cảnh báo hiện tại), ngược lại `--bg-elevated` |

**Tương tác:**
- Click ▶ hoặc double-click row = seek đến `seg.start` + play.
- Click 1 lần vào text = select; Enter hoặc click lần 2 = edit (commit gọi `write_srt` như `updateSegment` hiện tại).
- `↑/↓` = di chuyển selection; `Enter` = edit; `Space` = play/pause toàn cục (không bị nuốt bởi list).
- **Context menu** (chuột phải, §8.6): Play from here · Edit text · Split at playhead · Merge with next · Delete. *(Split/merge/delete là năng lực MỚI — thao tác thuần mảng `segments` + re-write SRT; split tại `currentTime` nếu playhead nằm trong segment, ngược lại tại điểm giữa.)*

### 5.2 INSPECTOR — Caption Style

**File:** `panels/CaptionsInspector.tsx`. Tĩnh (không phụ thuộc selection).

| Cụm | Control | Bind / Ghi chú |
|---|---|---|
| SHOW CAPTIONS | Toggle "Show captions in export" — disabled + tooltip "Transcribe first" khi chưa có segments | `showSubtitles` |
| TEXT COLOR | Swatch row 6 `SUBTITLE_COLORS` (White/Cream/Sky/Mint/Rose/Lavender) + custom; disabled mờ khi toggle off | `subtitleColor` |
| KARAOKE | Toggle "Karaoke highlight" + sub 11px "Text sweeps with audio progress"; khi bật: swatch row 6 `KARAOKE_COLORS` + custom | `karaokeEnabled` `karaokeColor` |
| POSITION | Slider dọc-ẩn dưới dạng "Vertical position" ngang 0–100% + nút `Auto` (= `subtitleYPct:null`); kéo subtitle zone trên canvas cũng chỉnh được | `subtitleYPct` |
| FILES | Row nhỏ: `captions.srt ✓` + nút ghost `Reveal` (chỉ khi `srtPath`) | `srtPath` |

Status line cuối inspector (11px `--text-3`): `11 segments · {swatch○} white` — **swatch tròn 10px + tên màu**, không hex (fix finding F).

---

## 6. Transport bar

**File:** `shell/TransportBar.tsx`. Cao 64px, bg `--bg-panel`, border-top 1px `--border`. Own `<audio>` element (chuyển từ StepTranscript lên shell — sống xuyên mode).

```
[▶] 0:12.4 ┃━━━━━━●━━━━━━━━━━━━━━━━━━━━┃ 1:24.0  [♪ segment text đang phát…]
 40px      └────────── seek strip ──────────┘        max 280px, ellipsis
```

| Phần | Spec |
|---|---|
| Play/Pause | Nút tròn 40px, bg `--accent`, icon trắng 14px; `Space` toàn app (trừ khi focus trong input/textarea/contentEditable). Chưa decode xong audio: disabled + spinner nhỏ |
| Timecode | 12px mono tabular, `--text-2`; trái = current, phải = duration |
| **Seek strip** | Cao 40px, flex 1. Vẽ mini waveform từ `peaks` (envelope đã có trong store) — bars 2px, gap 1px, màu `--text-3`; phần đã phát màu `--accent`. Click/drag = seek. Hover: playhead ghost + tooltip timecode tại vị trí chuột |
| Playhead | Vạch 2px trắng, cao đầy strip |
| **Segment blocks (chỉ mode Captions)** | Dải 6px sát đáy strip: mỗi segment 1 block radius 2px, bg `--accent` 45%; active segment 100% + glow nhẹ; hover tooltip text; click = seek + select row tương ứng trong list |
| Now-playing chip (phải) | Chỉ khi có segments & đang phát: text segment hiện tại, 12px, 1 dòng ellipsis, bg `--bg-elevated` pill. Click = scroll list đến segment |
| Phím | `←/→` seek ∓5s · `⇧←/→` ∓1s · `Home` về 0 |

Mode Design: transport vẫn đầy đủ (play để xem preview động) — chỉ thiếu segment blocks & now-playing chip khi chưa transcribe.

---

## 7. Export Sheet

**File:** `sheets/ExportSheet.tsx`. Modal 560px wide, bg `--bg-elevated`, radius-l, overlay đen 60%, mở bằng nút Export/⌘E, đóng Esc (trừ khi đang render → §7.3). 4 trạng thái tuần tự:

### 7.1 State A — Settings

```
Export video                                    ✕
─────────────────────────────────────────────────
FORMAT      [16:9 YouTube ▾]     1280×720 · MP4 H.264
FRAME RATE  [24] [30] [60]                (segmented)
CAPTIONS    (●) Burn into video · 11 segments
            ( ) No captions
            [✓] Karaoke highlight        (sub-toggle)
FILE NAME   [my-episode            ] .mp4
─────────────────────────────────────────────────
Estimated: ~45 MB · ~2 min          [Cancel] [Export]
```

| Control | Spec | Bind |
|---|---|---|
| Format select | 3 options từ `CANVAS_SIZES`, đổi ở đây = đổi `canvasSize` toàn app (preview sau lưng cập nhật — nhìn thấy qua overlay mờ) | `canvasSize` |
| Frame rate | SegmentedControl 24/30/60 (chuyển từ Layout step cũ về đây — FPS chỉ ảnh hưởng export) | `fps` |
| Captions radio | Chỉ enabled khi có segments; chọn burn-in ⇄ `showSubtitles`; karaoke sub-toggle ⇄ `karaokeEnabled` | `showSubtitles` |
| File name | Prefill từ `title` slug; đuôi `.mp4` cố định ngoài input | — |
| Estimated | Size ≈ `duration × bitrate_ước_tính(canvasSize, fps)`; time ≈ heuristic từ duration × fps (hiện "~" luôn) | — |
| **Export** button | → native `save()` dialog (defaultPath = file name) → State B | |

### 7.2 State B — Rendering

```
Exporting…                          (không có ✕)
─────────────────────────────────────────────────
  ✓ Preparing audio
  ✓ Writing captions
  ◉ Rendering frames          1,240 / 3,600
  ○ Encoding video
─────────────────────────────────────────────────
━━━━━━━━━━━━━━━━━●─────────── 42% · ~1:10 left
                            ▸ Show details
                                       [Cancel]
```

- Checklist 4 bước map từ pipeline thực (`render_audiogram`): Preparing (trước frame đầu) → Writing captions (nếu có, gọi `write_ass` trước) → Rendering frames (chiếm `render_progress` 0–95, hiện frame count nếu parse được từ log) → Encoding/Finalizing (95–100).
- Bước active: icon ◉ accent pulse; done: ✓ `--success`; pending: ○ `--text-3`.
- Progress bar 6px + % + **ETA** (tính từ tốc độ % trung bình 10s gần nhất; hiện sau ≥5% & ≥5s; format "~1:10 left").
- `▸ Show details` disclosure: mở khu log mono 11px cao 120px (chính `logs` stream hiện tại) — mặc định ĐÓNG.
- **Cancel**: confirm inline "Stop exporting? Partial file will be deleted. [Keep going] [Stop]" → kill ffmpeg child process (cần thêm command Rust `cancel_render` — ghi chú backend nhỏ, ngoài đó ra spec này thuần frontend).
- Sheet có thể **thu nhỏ**: click ngoài overlay = minimize (không cancel) → nút Export trên toolbar thành progress chip `◔ 42%` (§3.3); dock icon hiện progress (Tauri `set_progress_bar`).

### 7.3 State C — Success

```
        ✓ (icon 48px, --success, pop-in 200ms)
        Export complete
        my-episode.mp4 · 46.2 MB · 1:24
─────────────────────────────────────────────────
   [Reveal in Finder]   [Export Another]   Done
```
- `Reveal in Finder` = primary (mở `open_folder` — hành vi `openOutput` hiện tại). `Export Another` = quay lại State A. `Done` = ghost, đóng sheet.
- Nếu app không focus lúc xong: native notification "Export complete — my-episode.mp4".

### 7.4 State D — Error
- Icon ⚠ `--danger` + "Export failed" + message 1 dòng thân thiện; `▸ Show details` mở log (auto-scroll xuống dòng Error). Nút `[Try Again]` (về State A giữ settings) + `[Close]`.

---

## 8. Dialog & popup phụ

Tất cả dialog: 400px, bg `--bg-elevated`, radius-l, title 15px w600, body 13px `--text-2`, nút phải-sang-trái: primary → secondary. `Esc` = cancel, `Enter` = primary.

### 8.1 Confirm re-transcribe
> **Replace current captions?** — "11 segments — including your edits — will be replaced." · `[Re-transcribe]` (danger) / `[Cancel]`

### 8.2 Confirm replace/open audio khi đã có project
> **Replace audio?** — "Layout and design are kept. Captions will be cleared (they belong to the old audio)." · `[Replace]` / `[Cancel]`
- `New Project` variant: "Start a new project? Unsaved changes are kept in Recents." · `[New Project]` / `[Cancel]`

### 8.3 Quit/close khi đang render
> **Export in progress** — "Quitting now will cancel the export at 42%." · `[Keep Exporting]` (primary) / `[Quit Anyway]` (danger)
- Hook `onCloseRequested` của Tauri window.

### 8.4 Locate missing file (từ Recents hoặc session restore)
> **Audio file not found** — "`episode-01.mp3` was moved or deleted." · `[Locate File…]` (mở dialog, re-link giữ toàn bộ settings) / `[Remove from Recents]` / `[Cancel]`

### 8.5 Model popover (từ Model select, §5.1)
- Popover 300px neo dưới trigger. List 5 model từ `list_models` (giữ `ModelInfo`): mỗi row = radio + label + size (`142 MB` mono 10px) + note 11px `--text-3` + trạng thái phải:
  - Downloaded: chọn được, ✓ accent
  - Chưa: nút ghost `Get ↓` (28px cao); đang tải: progress bar 3px trong row + `42%`, các nút Get khác disabled (event `model_download_progress` như hiện tại)
  - Model `base`: badge `Recommended` (thay "BUNDLED") 9px pill `--success` 15%
- Chọn model chưa tải = không cho (row disabled) — phải Get trước (giữ hành vi hiện tại).

### 8.6 Context menus (native-feel, custom render)
- **Segment row** (§5.1): Play from here · Edit text `↵` · ─ · Split at playhead · Merge with next · ─ · Delete (đỏ). Items disabled hợp ngữ cảnh (Merge disabled ở row cuối; Split disabled khi playhead ngoài segment và segment <0.6s).
- **Recent card** (§2.3): Open · Reveal Audio in Finder · ─ · Remove from Recents.
- **Canvas zone** (v1.1, optional): Reset this element · Reset all layout.

### 8.7 Toast
- Góc dưới-phải, trên transport 12px; 320px max; auto-dismiss 4s; variants info/success/error. Dùng cho: file sai định dạng, SRT saved, model download xong, lỗi không chặn luồng.

---

## 9. Control primitives (`src/components/ui/`)

| Component | Kích thước & states chính |
|---|---|
| **Button** | Cao: sm 28 / md 34. Pad ngang 12/16. Radius-s. Variants: `primary` (bg accent, hover +8% sáng, active scale .98) · `secondary` (bg `--bg-elevated`, border 1px `--border`) · `ghost` (transparent, hover bg elevated) · `danger` (bg `--danger` 15%, text danger, hover 25%). Shortcut hint: 11px mờ 60% cách label 8px. Loading: spinner 14px thay icon, giữ width |
| **Select** | Trigger cao 32, bg `--bg-elevated`, border `--border`, caret ▾; mở popover listbox radius-m shadow; item cao 30, hover bg accent-soft, selected ✓ trái; điều hướng ↑↓, Enter chọn, Esc đóng, type-ahead |
| **SegmentedControl** | Track bg `--bg-app` inset, radius-s; thumb bg `--bg-elevated` slide 150ms ease-out; item pad 0 12, 12.5px |
| **Toggle** | 36×20, thumb 16, track off `--border` / on `--accent`, 150ms; label trái 13px, sub-label 11px `--text-3`; disabled: 40% + tooltip bắt buộc có lý do |
| **Slider** | Track 4px `--border`, fill accent, thumb 14px trắng shadow; value label phải 11px mono; ←/→ = ±step khi focus |
| **SwatchRow** | Swatch 24×24 radius 6, gap 6, wrap; selected: ring 2px trắng + 2px accent (double ring); cuối hàng luôn có **custom color well** 24×24 (native `input[type=color]` ẩn dưới, hiển thị bg = giá trị hiện tại + viền conic-gradient mảnh); tooltip = tên màu |
| **Field** | Label 11px uppercase `--text-3` letter-spacing .05em, margin-bottom 8; stack gap 24 giữa các Field trong panel |
| **Input / Textarea** | Cao 32 (input), bg `--bg-app`, border `--border`, radius-s, focus ring accent; textarea auto-grow max 4 dòng |
| **Tooltip** | Delay 400ms, bg #000 90%, 11px, radius 4, max-w 220; shortcut hiển thị dạng key caps mờ; **mọi icon-button và mọi control disabled bắt buộc có tooltip** |
| **Modal/Sheet** | Overlay #000 60%, sheet radius-l, vào: scale .97→1 + fade 150ms; focus trap; Esc đóng (trừ render) |
| **Popover** | Neo anchor, offset 6px, radius-m, shadow `0 8px 24px rgba(0,0,0,.5)`, đóng khi click ngoài/Esc |
| **ContextMenu** | Như Popover; item cao 28, 12.5px; danger item text `--danger`; separator 1px `--border` margin 4 |
| **ProgressBar** | 4–6px, track `--border`, fill accent, indeterminate: dải 30% chạy 1.2s |
| **Toast** | §8.7 |

---

## 10. Parity checklist

Mọi field trong `AppState` phải có "nhà mới". Bảng này là điều kiện xoá code cũ (Phase 3 của REBUILD_PLAN):

| Store field | Vị trí UI mới |
|---|---|
| `audioPath/audioName` | START drop zone · Toolbar file chip |
| `title` | Inline edit trên canvas · Inspector Canvas/Title §4.3.1/4.3.3 |
| `canvasSize` | Stage footer ratio switcher §4.2 · Export sheet §7.1 |
| `layoutTemplate` | Template gallery §4.1 |
| `coverImagePath` | Inspector Canvas/Avatar §4.3.1/4.3.5 |
| `waveStyle` | Wave gallery §4.1 · Inspector Waveform §4.3.2 |
| `waveColor` | Inspector Waveform §4.3.2 |
| `bgColor` | Inspector Canvas §4.3.1 |
| `fps` | Export sheet §7.1 (RỜI khỏi Design) |
| `logs` | Export sheet "Show details" §7.2 |
| `isRendering` | Export sheet states B · toolbar progress chip §3.3 |
| `lastOutput` | Export sheet Success §7.3 |
| `segments` | Segment list §5.1 · transport blocks §6 |
| `srtPath` | Captions inspector FILES §5.2 |
| `isTranscribing` | Transcribe button state §5.1 |
| `showSubtitles` | Captions inspector §5.2 · Export sheet captions radio §7.1 |
| `whisperModel` | Model select + popover §8.5 |
| `peaks` | Transport seek strip §6 (+ split logic giữ nguyên) |
| `fontSize/fontName` | Inspector Title §4.3.3 |
| `karaokeEnabled/karaokeColor` | Captions inspector §5.2 · Inspector Subtitle §4.3.4 · Export sheet §7.1 |
| `subtitleColor` | Captions inspector §5.2 · Inspector Subtitle §4.3.4 |
| `subtitleYPct` | Captions inspector POSITION §5.2 · kéo zone subtitle |
| `zones` | Canvas Rnd overlays §4.2 · Reset layout |
| `titleColor/Align/Bold/Italic` | Inspector Title §4.3.3 |
| `step` *(bỏ)* | → `screen: 'start'│'studio'` + `mode: 'design'│'captions'` |

**Field/state MỚI cần thêm:** `screen`, `mode`, `recents[]` (session.json), `selectedSegmentId`, `renderStage`, transient `exportSheetState`.

**Backend cần thêm (nhỏ, ghi chú cho sau):** `cancel_render` command (§7.2) · thumbnail PNG cho recents (render offscreen phía frontend, không cần Rust).

---

## Thứ tự build spec này (map vào REBUILD_PLAN phases)

| Phase | Sections của spec |
|---|---|
| P1 Shell | §1, §3, §6 (khung transport chưa cần blocks), §9 |
| P2 Design | §2, §4 |
| P3 Captions+Export | §5, §7, §8 |
| P4 Polish | first-run hint, toasts, ETA, context menus phụ, §10 audit |
