# Audiogram — Kế hoạch xây dựng lại toàn bộ UI/UX
*Ngày lập: 25/07/2026 · Branch: `design-dark`*
*Kế thừa và thay thế: `DESIGN_REVIEW.md` (findings), `FIGMA_IMPLEMENTATION_PLAN.md` (tokens + dark theme — giữ lại; mô hình wizard — bỏ)*

---

## 0. Vấn đề gốc của UI hiện tại

Không phải màu sắc hay spacing — mà là **mental model sai**. App hiện tại được tổ chức như một **website wizard**: 4 "trang" (Import → Layout → Transcript → Export), mỗi trang là một form, có nút "Next", có sidebar kiểu SaaS ("Free plan", avatar user), header "Create Audiogram" kiểu landing page, content scroll dọc.

Desktop app làm content-creation không hoạt động như vậy. CapCut, Descript, Final Cut, Screen Studio — tất cả đều là **một workspace duy nhất**: preview ở giữa luôn hiển thị, công cụ xung quanh, không có "trang", không có "Next". Người dùng nhìn thấy sản phẩm của mình **mọi lúc** và mọi thao tác phản hồi ngay trên preview.

**Quyết định trung tâm của kế hoạch này: bỏ wizard, chuyển sang Studio workspace.**

---

## 1. Nguyên tắc thiết kế (app, không phải web)

1. **Preview là trung tâm, luôn hiển thị.** Không bao giờ có màn hình nào (trừ màn Start) mà user không nhìn thấy audiogram của mình.
2. **Không scroll trang.** Cửa sổ chia thành các panel cố định; chỉ nội dung *bên trong* panel (danh sách segment, danh sách template) được scroll.
3. **Không có ngôn ngữ web/SaaS.** Bỏ: "Free plan", avatar user, header marketing, badge "BUNDLED", hero section, watermark "audiogram" trên preview. App mua một lần chạy local — UI không cần upsell.
4. **Phím tắt là first-class.** Space = play/pause, ⌘O = mở file, ⌘E = export, ⌘Z = undo, ←/→ = seek. Mọi shortcut hiện trong tooltip.
5. **Offline hoàn toàn.** Font bundle vào assets (không Google Fonts CDN). Không có tài nguyên nào fetch từ mạng.
6. **Native chrome.** macOS: titlebar overlay (traffic lights đè lên toolbar của app), có thể kéo cửa sổ bằng toolbar. Cửa sổ resize được, panel co giãn theo.
7. **Trạng thái bền vững.** Đóng app mở lại → project gần nhất vẫn còn (đường dẫn audio, layout, transcript đã sửa). Đây là hành vi app; website mới bắt đầu lại từ đầu.
8. **Một ngôn ngữ duy nhất** cho toàn UI (tiếng Anh — target bán global; theo finding C trong DESIGN_REVIEW).

---

## 2. Kiến trúc thông tin mới

### 2.1 Hai màn hình duy nhất

```
┌─────────────────────┐      ┌─────────────────────┐
│      START          │ ───► │      STUDIO         │
│  (khi chưa có       │      │  (toàn bộ thời gian │
│   audio/project)    │ ◄─── │   còn lại)          │
└─────────────────────┘      └─────────────────────┘
```

**START** — thay cho StepUpload:
- Drop zone lớn ở giữa + nút "Open Audio…" (⌘O)
- Recent projects (grid thumbnail, nếu có) — mở lại 1 click
- KHÔNG có settings, không có canvas size, không có hero marketing

**STUDIO** — thay cho StepLayout + StepTranscript + StepExport gộp lại:

```
┌──────────────────────────────────────────────────────────────┐
│ ⬤⬤⬤  [tên file ▾]      [Design] [Captions]        [Export ▸]│  ← Toolbar 48px
├──────────────┬───────────────────────────────┬───────────────┤
│              │                               │               │
│  LEFT PANEL  │        CANVAS PREVIEW         │   INSPECTOR   │
│  (đổi theo   │     (luôn hiển thị, live)     │  (properties  │
│   mode)      │                               │   của thứ     │
│              │      [16:9 ▾]  zoom ─●─       │   đang chọn)  │
│              │                               │               │
├──────────────┴───────────────────────────────┴───────────────┤
│ ▶  0:12 ────────●────────────────────── 1:24   [waveform bar]│  ← Transport 56px
└──────────────────────────────────────────────────────────────┘
```

### 2.2 Hai mode thay cho 4 step

Toolbar có segmented control **[Design | Captions]** — chỉ đổi nội dung LEFT PANEL và INSPECTOR, canvas + transport không bao giờ đổi:

| Mode | Left panel | Inspector (phải) |
|---|---|---|
| **Design** | Template gallery (thumbnail thật, render bằng chính draw functions) + wave style gallery (mini preview động) | Properties của element đang chọn trên canvas (waveform / title / avatar / background) — giữ pattern click-to-inspect hiện có, nhưng thêm hover highlight + selection outline để không còn là hidden interaction |
| **Captions** | Segment list (search, click-to-edit, split/merge, speaker) + nút Transcribe & model picker (thu gọn thành 1 dropdown + nút, không chiếm cả panel) | Subtitle style: màu, font, vị trí, karaoke toggle (kèm lý do khi disabled) |

**Export không phải là step** — là nút primary góc phải toolbar, mở **modal/sheet**: preset platform (YouTube/TikTok/IG…), quality, subtitle burn-in, ước tính dung lượng → Start Export → progress checklist (không FFmpeg log; log ẩn sau "Show details" disclosure) → success state với "Reveal in Finder".

### 2.3 Transport bar (mới hoàn toàn)

Thanh phát ở đáy cửa sổ, dùng chung cho cả 2 mode — giải quyết finding D (playback controls nằm sai chỗ):
- Play/pause (Space), current time / duration, seek bar hiển thị mini waveform (tận dụng envelope đã decode sẵn trong `WaveformCanvas`)
- Ở mode Captions: overlay các segment block trên seek bar, click block = seek + select segment (đây là "timeline lite" — chưa cần timeline kéo thả đầy đủ ở phase này; `StepEditor.tsx`/wavesurfer đã có sẵn nền nếu muốn nâng cấp sau)

### 2.4 Luồng người dùng mới

```
Mở app → START → thả file vào
  → vào STUDIO (mode Design), preview chạy ngay với template mặc định
  → chỉnh template/wave/màu (thấy ngay trên canvas)
  → bấm [Captions] → Transcribe → sửa text → bật karaoke nếu muốn
  → bấm [Export ▸] → chọn preset → render → Reveal in Finder
```

Không còn khái niệm "bước 3/4", không còn nav bị disable chờ unlock — chỉ có Export button disable khi chưa có audio.

---

## 3. Design system

### 3.1 Theme: Dark-first

Đúng hướng branch `design-dark` và Figma reference. Tool làm video dùng dark theme vì (a) preview nổi bật, (b) đúng convention của mọi editor (Premiere, CapCut, Final Cut).

```css
/* Tokens — giữ từ FIGMA_IMPLEMENTATION_PLAN, tinh chỉnh */
--bg-app:        #0E0E16;  /* nền cửa sổ */
--bg-panel:      #16161F;  /* left panel, inspector, transport */
--bg-elevated:   #1E1E2A;  /* cards, dropdown, modal */
--bg-canvas-pit: #08080D;  /* vùng lõm quanh canvas preview */
--border:        #262633;
--border-focus:  #7C5CFF;

--accent:        #7C5CFF;  /* CTA, selection, active */
--accent-soft:   rgba(124,92,255,.14);
--success:       #34D399;
--danger:        #F87171;

--text-1: #F4F4F6;  --text-2: #A0A0B0;  --text-3: #5C5C6E;

--radius-s: 6px; --radius-m: 10px; --radius-l: 14px;
/* Spacing: 4-pt grid nghiêm ngặt — 4/8/12/16/24/32 */
```

### 3.2 Typography

- **Inter** (UI) — bundle woff2 vào `src/assets/fonts/`, khai báo `@font-face` trong `index.css`. Tuyệt đối không load từ CDN.
- Scale: 11 (label uppercase) / 13 (body — cỡ chuẩn desktop app, không dùng 16px kiểu web) / 15 (panel heading) / 20 (chỉ dùng ở START screen). Số dùng `font-variant-numeric: tabular-nums` cho timecode.

### 3.3 Component library (`src/components/ui/`)

Chuẩn hóa 1 lần, dùng Tailwind 4 `@theme` tokens thay vì inline styles rải rác như hiện tại:

| Component | Ghi chú |
|---|---|
| `Button` | primary / secondary / ghost / danger, size sm·md, kèm shortcut hint |
| `Select` | custom (không native `<select>` — trông web), dark, keyboard-navigable |
| `Slider` | cho opacity, zoom, font size |
| `Toggle` | animated, kèm lý do khi disabled (tooltip) |
| `Field` | label 11px uppercase + control |
| `Tooltip` | delay 400ms, hiện shortcut; dùng cho mọi icon button |
| `SegmentedControl` | cho [Design ǀ Captions], canvas ratio |
| `Modal / Sheet` | cho Export; đóng bằng Esc |
| `ContextMenu` | chuột phải segment (split/merge/delete) — hành vi app đặc trưng |

### 3.4 Motion

Ít và có chủ đích: panel switch 150ms fade-slide; selection outline 120ms; export progress step check 200ms spring. Không animation trang trí.

---

## 4. Chi tiết app-native (điểm khác biệt web ↔ app)

### 4.1 Cửa sổ — `tauri.conf.json`

```json
{
  "title": "Audiogram",
  "width": 1280, "height": 800,
  "minWidth": 1000, "minHeight": 680,
  "titleBarStyle": "Overlay",        // macOS: traffic lights đè lên toolbar
  "hiddenTitle": true,
  "center": true
}
```
Toolbar 48px có `data-tauri-drag-region` để kéo cửa sổ; chừa 78px trái cho traffic lights trên macOS.

### 4.2 Keyboard shortcuts (global trong app)

| Phím | Hành động |
|---|---|
| `Space` | Play / Pause |
| `⌘O` | Open audio |
| `⌘E` | Export |
| `⌘1 / ⌘2` | Mode Design / Captions |
| `←/→` | Seek −5s / +5s |
| `⌘Z / ⇧⌘Z` | Undo / Redo (layout + transcript edits) |
| `↑/↓` (Captions) | Chọn segment trước/sau |
| `Enter` (Captions) | Sửa segment đang chọn |
| `Esc` | Đóng modal / bỏ chọn element |

Hiện danh sách này ở tooltip và trong menu **Help → Keyboard Shortcuts**.

### 4.3 Menu bar native (Tauri Menu API)

File (Open Audio ⌘O, Open Recent ▸, Export ⌘E) · Edit (Undo/Redo/Cut/Copy/Paste — cần cho input fields hoạt động đúng trên macOS) · View (Design ⌘1, Captions ⌘2, Actual Size) · Help. App không có menu bar là dấu hiệu "web app đóng khung" rõ nhất.

### 4.4 Hành vi hệ thống

- **Drag & drop file audio vào bất kỳ đâu** trên cửa sổ (kể cả trong Studio → thay audio, có confirm)
- **Dock/taskbar progress** khi đang export (Tauri `set_progress_bar`) — user switch app vẫn biết tiến độ
- **Confirm khi đóng cửa sổ** lúc đang export
- **Native notification** khi export xong mà app không focus
- **Persistence:** lưu `AppState` (trừ transient) vào `app_data_dir/session.json`, debounced; Recent projects tối đa 8 entries kèm thumbnail PNG render từ canvas

---

## 5. Kế hoạch thực hiện — 4 phase

> Nguyên tắc: mỗi phase kết thúc app vẫn chạy được đầy đủ. Không có "big bang".

### Phase 1 — Shell & Design system (2–3 ngày)
Dựng khung Studio mới nhưng nội dung panel tạm tái dùng component cũ.

1. `tauri.conf.json`: window size, titlebar overlay, productName "Audiogram"
2. `index.css`: tokens dark theme (Tailwind 4 `@theme`), `@font-face` Inter bundle
3. `src/components/ui/`: Button, Select, Slider, Toggle, Field, Tooltip, SegmentedControl, Modal
4. `src/components/shell/`: `Toolbar.tsx`, `TransportBar.tsx`, `StudioLayout.tsx` (3-pane grid)
5. `store.ts`: `step` → `screen: 'start' | 'studio'` + `mode: 'design' | 'captions'`; giữ field cũ tạm để không phá Step components trong lúc chuyển
6. **Xóa** `Sidebar.tsx`, step pills, header "Create Audiogram"
7. Menu bar native + shortcuts ⌘O ⌘E ⌘1 ⌘2 Space

*Kết quả: mở app thấy shell dark mới, panel trái/phải tạm chứa UI cũ.*

### Phase 2 — Start screen + Design mode (3–4 ngày)
8. `StartScreen.tsx`: drop zone + Open button + Recent projects (đọc `session.json`)
9. Template gallery **có thumbnail thật**: render mỗi template 1 lần bằng chính các hàm `draw*` của `WaveformCanvas` vào offscreen canvas 160×90 → dataURL, cache lại (giải quyết finding A — không cần vẽ SVG tay)
10. Wave style gallery: mini canvas 72×40 chạy fallback simulation loop của từng style
11. Inspector: port từ `StepLayout` inspector, thêm hover-highlight + selection outline trên canvas, transition 150ms khi đổi panel
12. Transport bar nối với audio element + envelope mini-waveform
13. Canvas ratio switcher (16:9 / 1:1 / 9:16 / 4:5) ngay dưới canvas; canvas fit-to-pit theo ratio, cửa sổ resize thì canvas scale theo

### Phase 3 — Captions mode + Export (3–4 ngày)
14. Segment list mới: search, virtualized nếu >200 segments, click = seek + edit inline, context menu chuột phải (split/merge/delete), speaker label
15. Model picker thu gọn: dropdown 1 dòng "Model: base ✓" + progress khi tải; bỏ badge "BUNDLED" → "Recommended"
16. Subtitle style inspector (chuyển từ Layout step về đây — theo finding trong DESIGN_REVIEW §Screen 3); karaoke toggle disabled phải có tooltip lý do
17. Segment blocks overlay trên transport seek bar
18. `ExportSheet.tsx`: platform presets → settings → progress checklist (Analyzing / Rendering frames / Encoding / Finalizing — map từ event `render_progress` + `log` hiện có) → success state (Reveal in Finder, Export Another); FFmpeg log sau disclosure "Show details"
19. Dock progress + notification + confirm-on-close khi đang render
20. **Xóa** `StepUpload/StepLayout/StepTranscript/StepExport/TranscriptPanel` sau khi port xong; quyết định số phận `StepEditor.tsx` (wavesurfer) — giữ làm nền nâng cấp timeline hoặc gác lại

### Phase 4 — Polish & app-feel (2 ngày)
21. Undo/redo (⌘Z) cho layout + transcript edits (zustand temporal middleware hoặc history stack tự viết)
22. Session persistence + Recent projects thumbnails
23. Empty states, error states (audio file moved/deleted → "Locate file…")
24. Rà soát: 1 ngôn ngữ, tabular-nums cho mọi timecode, tooltip đủ 100% icon buttons, focus ring nhất quán, không còn inline-style màu hard-code
25. QA checklist parity: đổi UI **không được** đụng vào hằng số render (`WAVE_BARS`, `BAR_FILL`… — xem CLAUDE.md); preview ↔ export phải khớp như cũ

**Tổng: ~10–13 ngày làm việc.**

---

## 6. Việc KHÔNG làm (chống scope creep)
- ❌ Light theme / theme switcher — dark only cho v1
- ❌ Đổi backend/Rust — kế hoạch này chỉ chạm frontend + tauri.conf + menu/window API

## 7. Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Port 4 step sang 2 mode làm rơi tính năng lẻ (skip, seek-peaks bug trong known_issues) | Checklist tính năng từng Step trước khi xóa file cũ; Phase 1 giữ song song code cũ |
| Titlebar overlay khác biệt macOS/Windows | macOS dùng Overlay; Windows dùng decorations mặc định — `StudioLayout` đọc platform để chừa padding |
| Store refactor (`step` → `screen`+`mode`) phá navigation logic | Làm ở Phase 1 với adapter tạm; xóa adapter ở Phase 3 |
| Thumbnail render template chậm khi mở gallery | Render 1 lần sau khi decode xong envelope, cache dataURL trong store |
