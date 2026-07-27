# Phase 1 — Task plan chi tiết (giao cho Sonnet thực thi)
*Ngày lập: 25/07/2026 · Nguồn: `UI_REBUILD_PLAN.md` P1 + `TECH_ARCHITECTURE.md` Phần V P1 + `PACKAGE_SPLIT_PLAN.md` đợt 1*

---

## A. LUẬT CHUNG cho mọi task (executor PHẢI đọc trước khi làm bất kỳ task nào)

1. **Một task = một commit** (hoặc chuỗi commit nhỏ cùng prefix). Message: `p1-t<số>: <mô tả ngắn>`.
2. **Sau MỖI task chạy đủ 3 lệnh nghiệm thu chung** (ngoài nghiệm thu riêng của task):
   ```bash
   npx tsc --noEmit                    # (từ thư mục app)
   cd src-tauri && cargo check         # (đường dẫn sau T1: apps/desktop/src-tauri)
   npm run tauri dev                   # mở được cửa sổ, import 1 file audio, thấy preview chạy
   ```
3. **CẤM tuyệt đối:**
   - Sửa bất kỳ hằng số render nào: `WAVE_BARS`, `BAR_FILL`, `GAP_FILL`, `EQ_BANDS`, `EQ_BPS`, `WAVE_BPS`, geometry trong `frame.rs`/`wave/*`/`waves/*` — trừ khi task nói rõ "di chuyển" (di chuyển = copy nguyên văn, không đổi giá trị).
   - Restyle / sửa logic 4 component cũ `StepUpload/StepLayout/StepTranscript/StepExport` (chúng sẽ bị thay ở Phase 2–3; Phase 1 chỉ *bọc* chúng).
   - Thêm dependency ngoài danh sách đã ghi trong task.
   - Đổi tên field trong store (Phase 1 giữ nguyên 100% tên field — điều kiện để component cũ chạy tiếp).
4. **Khi kẹt >30 phút** ở một quyết định không có trong spec: dừng, ghi `// TODO(p1-tX): <câu hỏi>` + báo lại trong kết quả, KHÔNG tự phát minh giải pháp khác hướng tài liệu.
5. Code + comment tiếng Anh. Tài liệu tham chiếu: `UI_DESIGN_SPEC.md` (§ được trỏ trong từng task), `TECH_ARCHITECTURE.md`.
6. Đường dẫn trong tài liệu này viết theo repo SAU T1 (`apps/desktop/...`). Task T1 là task duy nhất chạy trên cấu trúc cũ.

**Thứ tự bắt buộc & phụ thuộc:**

```
T1 (workspace move) ──► T2 (tooling) ──► T3 (tokens+font) ──► T4,T5 (primitives)
                                    └──► T6 (window/titlebar)
T2 ──► T7 (store slices) ──► T9 (RenderEvent+render.slice)
T2 ──► T8 (specta/ipc)   ──► T9
T7 ──► T10 (AudioEngine+playback)
T3,T4,T7 ──► T11 (shell: StudioLayout+Toolbar+routing)
T10,T11  ──► T12 (TransportBar)
T11      ──► T13 (shortcuts+menu)
T2       ──► T14 (contract codegen)
T1       ──► T15 (crates: spectrum+core) ──► T16 (render+subtitle crates)
T14      ──► T17 (npm packages: contract, wave-effects)
tất cả   ──► T18 (CI)
```

Milestones: **M0** = T1–T2 xong (repo mới boot được) · **M1** = T3–T6 (design system) · **M2** = T7–T10 (state/ipc/audio) · **M3** = T11–T13 (shell nhìn thấy được) · **M4** = T14–T18 (contract/packages/CI xanh).

---

## T1 — Di chuyển repo sang cấu trúc workspace `apps/desktop` (½ ngày, CƠ HỌC THUẦN)

**Mục tiêu:** monorepo layout, app chạy y hệt trước. KHÔNG sửa nội dung file nào ngoài config đường dẫn.

**Các bước:**
1. `git mv` — TOÀN BỘ bằng git mv, không copy:
   ```
   src/  index.html  vite.config.ts  tsconfig*.json  postcss.config.* → apps/desktop/
   src-tauri/                                                         → apps/desktop/src-tauri/
   scripts/                                                           → giữ ở root (dùng chung)
   ```
2. Root `package.json` mới:
   ```json
   { "name": "audiogram-monorepo", "private": true,
     "workspaces": ["apps/*", "packages/*"],
     "scripts": {
       "dev":   "npm run tauri dev -w audiogram",
       "build": "npm run tauri build -w audiogram",
       "postinstall": "node scripts/copy-ffmpeg.mjs || true"
     } }
   ```
   `apps/desktop/package.json` = package.json cũ (giữ tên `"audiogram"`), sửa script `postinstall` bỏ đi (đã lên root), sửa đường dẫn script `fetch:ffmpeg`/`setup:whisper` thành `../../scripts/...`.
3. Kiểm tra & sửa đường dẫn trong:
   - `apps/desktop/src-tauri/tauri.conf.json`: `build.frontendDist`, `beforeDevCommand/beforeBuildCommand` (chạy `npm run dev --prefix ../..`? — KHÔNG: giữ `npm run dev` vì Tauri chạy lệnh từ thư mục app; xác nhận bằng chạy thật), đường dẫn `bundle.externalBin`, `bundle.resources` (đều relative với src-tauri → thường KHÔNG cần sửa).
   - `scripts/copy-ffmpeg.mjs` + `scripts/setup-whisper.sh`: cập nhật đích `src-tauri/binaries` → `apps/desktop/src-tauri/binaries` (đọc file script trước, sửa đúng biến path).
   - `vite.config.ts`: nếu có path tương đối ra ngoài → sửa.
4. Root `Cargo.toml` CHƯA tạo ở task này (để T15). `dist_build2/ dist_test/` cũ ở root: thêm vào `.gitignore`, không di chuyển.

**Nghiệm thu:**
- [ ] `npm install` từ root chạy sạch, `binaries/` được copy đúng chỗ mới
- [ ] `npm run dev` (root) mở app, import audio, preview chạy, transcribe chạy (nếu máy có model)
- [ ] `npm run build` (root) hoặc `npm run tauri build -w audiogram` ra bundle không lỗi đường dẫn
- [ ] `git log --follow apps/desktop/src/store.ts` còn history (xác nhận git mv đúng)
- [ ] Commit: `p1-t1: move app into apps/desktop workspace layout` — KHÔNG lẫn thay đổi logic

---

## T2 — Tooling: ESLint + vitest + luật import (½ ngày)

**Dep mới (devDeps ở `apps/desktop`):** `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-import`, `vitest`, `@vitest/coverage-v8`, `jsdom`.

**Các bước:**
1. `apps/desktop/eslint.config.js` (flat config): base recommended + rule `import/no-restricted-paths` với zones theo TECH_ARCHITECTURE §2.2 (khai báo sẵn cả các thư mục CHƯA tồn tại — `ui`, `domain`, `core`, `store`, `features`, `extensions` — để luật có hiệu lực dần khi thư mục mọc ra):
   - `ui/**` và `domain/**` cấm import từ `store|features|core|app`
   - `core/**` cấm import từ `features|app|store` và cấm `react`
   - `features/**` cấm import chéo `features/*` khác
   - Toàn bộ `src/**` trừ `core/ipc/**` cấm import `@tauri-apps/api/core` (bật ở mức `warn` trong Phase 1, `error` từ Phase 3 — vì component cũ còn vi phạm)
2. `vitest.config.ts` (environment jsdom, include `src/**/*.test.ts?(x)`), test mẫu `src/domain/__smoke__.test.ts` (expect(true)) để pipeline có gì đó chạy.
3. Scripts `apps/desktop/package.json`: `"lint": "eslint src"`, `"test": "vitest run"`, `"typecheck": "tsc --noEmit"`.

**Nghiệm thu:** `npm run lint` (chỉ warning ở component cũ, 0 error) · `npm run test` xanh · commit `p1-t2`.

---

## T3 — Design tokens + Inter font + nền dark (½ ngày)

**Tham chiếu:** UI_DESIGN_SPEC quy ước chung + UI_REBUILD_PLAN §3.1–3.2. **Dep mới:** `@fontsource-variable/inter` (font bundle offline — KHÔNG dùng Google Fonts CDN).

**Các bước:**
1. Tạo `apps/desktop/src/ui/tokens.css`:
   ```css
   @import 'tailwindcss';
   @theme {
     --color-bg-app: #0E0E16;      --color-bg-panel: #16161F;
     --color-bg-elevated: #1E1E2A; --color-bg-pit: #08080D;
     --color-border: #262633;      --color-accent: #7C5CFF;
     --color-accent-soft: rgb(124 92 255 / 0.14);
     --color-success: #34D399;     --color-danger: #F87171;
     --color-text-1: #F4F4F6;  --color-text-2: #A0A0B0;  --color-text-3: #5C5C6E;
     --radius-s: 6px;  --radius-m: 10px;  --radius-l: 14px;
     --font-sans: 'Inter Variable', system-ui, sans-serif;
   }
   ```
2. `main.tsx`: import `@fontsource-variable/inter` + `./ui/tokens.css` (thay import css cũ nếu trùng vai — App.css cũ GIỮ NGUYÊN, load sau, vì component cũ dựa vào nó).
3. Base styles trong tokens.css: `body { @apply bg-bg-app text-text-1 font-sans; }` + class tiện ích `.tabular { font-variant-numeric: tabular-nums }` + scrollbar overlay 6px (webkit) theo spec §1.2.
4. **Lưu ý xung đột:** app cũ nền sáng — sau task này 4 Step cũ trông "lạc tông" trên nền tối là CHẤP NHẬN ĐƯỢC (bị thay ở Phase 2–3). Không đi sửa màu từng component cũ.

**Nghiệm thu:** app mở nền `#0E0E16`, font Inter render (kiểm bằng devtools computed font-family), offline vẫn có font · commit `p1-t3`.

---

## T4 — UI primitives, đợt 1/2: Button · Field · Tooltip · Toggle · Slider · SegmentedControl (1 ngày)

**Tham chiếu BẮT BUỘC:** bảng spec UI_DESIGN_SPEC §9 (kích thước, states, variants — làm ĐÚNG số px trong bảng). Vị trí: `apps/desktop/src/ui/<Name>.tsx`, mỗi file 1 component + named export; `src/ui/index.ts` barrel.

**Quy ước kỹ thuật:**
- Chỉ Tailwind classes từ tokens (T3). Không hex literal, không inline style (trừ giá trị động như width %).
- Props tối thiểu, TypeScript strict. `Button`: `variant('primary'|'secondary'|'ghost'|'danger')`, `size('sm'|'md')`, `shortcutHint?`, `loading?`. `Toggle`: `label`, `subLabel?`, `disabledReason?` (bắt buộc render Tooltip khi disabled — spec §9). `Tooltip`: delay 400ms, dùng CSS position + portal, KHÔNG thêm lib.
- Mỗi component 1 file test render smoke (vitest + jsdom): render không throw, click gọi handler, disabled không gọi.

**Nghiệm thu:** `npm run test` xanh (≥6 test files) · tạo `src/ui/__gallery__.tsx` (route tạm `?gallery=1` trong main.tsx, if `location.search` chứa gallery thì render gallery thay App) hiển thị mọi variant/state để nghiệm mắt · commit `p1-t4`.

---

## T5 — UI primitives, đợt 2/2: Select · Popover · Modal · ContextMenu · Toast · Progress · SwatchRow · Input (1–1.5 ngày)

Như T4. Điểm khó cần làm đúng:
- `Popover`: anchor + offset 6, đóng khi click-ngoài/Esc, focus không bị cướp. `Select` xây trên Popover: ↑↓/Enter/Esc/type-ahead (spec §9).
- `Modal`: focus trap (tab loop thủ công — không thêm lib), overlay 60%, scale .97→1 150ms, Esc đóng qua prop `dismissable`.
- `ContextMenu`: mở tại toạ độ chuột phải, item `danger`, separator, disabled + reason.
- `Toast`: manager singleton module (`toast.show({kind,msg})`), stack góc dưới-phải, auto-dismiss 4s (spec §8.7).
- `SwatchRow`: double-ring selected + custom color well bọc `input[type=color]` (spec §9).

**Nghiệm thu:** gallery bổ sung đủ 8 component, keyboard walkthrough Select/Modal bằng tay OK, test smoke từng cái · commit `p1-t5`.

---

## T6 — Cửa sổ & titlebar overlay (¼ ngày)

**Các bước:**
1. `tauri.conf.json` → `app.windows[0]`: `width 1280, height 800, minWidth 1000, minHeight 680, center true, title "Audiogram", titleBarStyle "Overlay", hiddenTitle true` (2 key cuối là macOS-only — Windows tự bỏ qua).
2. `productName` → `"Audiogram"`.
3. `src/app/platform.ts`: export `isMac` (từ `navigator.userAgent` hoặc `@tauri-apps/api os` — dùng userAgent cho khỏi thêm plugin), constant `TRAFFIC_LIGHT_INSET = 78`.

**Nghiệm thu:** cửa sổ mở 1280×800 giữa màn hình, traffic lights nổi trên nền app (macOS), resize xuống dưới 1000×680 bị chặn · commit `p1-t6`.

---

## T7 — Store slices (giữ shape phẳng — compat 100%) (1 ngày)

**Tham chiếu:** TECH_ARCHITECTURE §2.2, §2.5. **Nguyên tắc vàng: tên field KHÔNG ĐỔI** — slices chỉ là cách tổ chức file; store compose ra vẫn phẳng nên 4 Step cũ + `useAppStore` chạy nguyên vẹn.

**Các bước:**
1. Tạo `apps/desktop/src/store/` với 6 file slice theo phân chia TECH_ARCHITECTURE §2.2 (project/design/captions/playback/render/ui). Pattern:
   ```ts
   // store/design.slice.ts
   import type { StateCreator } from 'zustand'
   export interface DesignSlice {
     layoutTemplate: LayoutTemplate; waveStyle: WaveStyle; waveColor: string
     bgColor: string; coverImagePath: string; zones: LayoutZones | null
     titleColor: string; titleAlign: 'left'|'center'|'right'; titleBold: boolean; titleItalic: boolean
     fontSize: number; fontName: string
     applyTemplate: (id: LayoutTemplate) => void   // chuyển logic từ StepLayout.handleTemplateChange
   }
   export const createDesignSlice: StateCreator<AppStore, [], [], DesignSlice> = (set) => ({ ...defaults, applyTemplate: ... })
   ```
   Phân bổ field (đầy đủ 25 field cũ + 2 mới):
   - `project`: audioPath, audioName, title, **screen: 'start'|'studio'** (MỚI — derive khởi tạo: có audioPath? không, mặc định 'start')
   - `design`: như trên
   - `captions`: segments, srtPath, isTranscribing, showSubtitles, whisperModel, karaokeEnabled, karaokeColor, subtitleColor, subtitleYPct
   - `playback`: peaks, playing, currentTime, duration (3 field sau MỚI — T10 dùng)
   - `render`: fps, canvasSize, logs, isRendering, lastOutput (+ field mới T9)
   - `ui`: **mode: 'design'|'captions'** (MỚI), step (GIỮ — component cũ cần), goTo/next/back (GIỮ), set (GIỮ)
2. `store/index.ts`: `create<AppStore>()((...a) => ({ ...createProjectSlice(...a), ...createDesignSlice(...a), ... }))`. Export `useAppStore` từ đây; `src/store.ts` cũ thành re-export 1 dòng `export * from './store/index'` (giữ import path cũ sống).
3. Test: `store/__tests__/compat.test.ts` — snapshot toàn bộ key của store mới === toàn bộ key store cũ (viết cứng danh sách 25 key cũ trong test) + `applyTemplate('karaoke')` set đúng 5 field như logic cũ.

**Nghiệm thu:** app chạy đủ 4 step như trước (đi tay hết flow import→layout→transcript→export) · test xanh · commit `p1-t7`.

---

## T8 — IPC layer: tauri-specta spike → bindings + client + events (1–1.5 ngày, CÓ FALLBACK)

**Tham chiếu:** TECH_ARCHITECTURE §2.3. **Timebox spike: 3 giờ.**

**Bước 1 — Spike (3h):** thêm vào `apps/desktop/src-tauri/Cargo.toml`: `specta = "=2.0.0-rc"`, `tauri-specta = { version = "=2.0.0-rc", features = ["derive", "typescript"] }` (pin đúng rc mới nhất tương thích Tauri 2 — tra crates.io tại thời điểm làm). Annotate 2 command KHÓ NHẤT: `render_audiogram` (struct `RenderJob` lồng nhau + `Vec<f32>` peaks) và `analyze_spectrum`. Builder trong `lib.rs` export bindings ra `apps/desktop/src/core/ipc/bindings.gen.ts` khi `cargo run --bin export-bindings` hoặc build-time.
- **Nếu spike PASS** → annotate nốt toàn bộ commands còn lại (`list_models`, `download_model`, `transcribe_audio`, `write_srt`, `write_ass`, `open_folder`, `resolve_ffmpeg_path`, ...  liệt kê từ `generate_handler!` trong lib.rs).
- **Nếu FAIL** (compile lỗi không gỡ được trong timebox) → **Fallback:** viết tay `bindings.manual.ts` cùng shape (`commands.renderAudiogram(job): Promise<Result<...>>`) — types chép từ Rust structs, đánh dấu `// HAND-WRITTEN: keep in sync with presentation/commands/*.rs`. Ghi rõ trong báo cáo là đã fallback.
2. `src/core/ipc/client.ts`: facade như TECH_ARCHITECTURE §2.3 — mọi command bọc `wrap()` normalize lỗi về `AppError` (`src/core/errors.ts`: `{kind, message, detail?, retryable}` — bảng map string lỗi hiện tại → kind: chứa "ffmpeg"→`ffmpeg-missing`, "whisper"|"model"→`whisper-failed`, else `unknown`).
3. `src/core/ipc/events.ts`: `attachIpcEvents(store)` — subscribe `log`, `render_progress`, `model_download_progress` MỘT lần; handler ghi vào store (`render.slice`, `captions` model progress — thêm field `modelDownload: {name,pct} | null` vào captions slice). Gọi từ `main.tsx` bootstrap.
4. **Migration tối thiểu** (chứng minh đường ống, không càn quét): `StepExport.tsx` bỏ 2 `listen()` cục bộ (dùng store từ events.ts — logs/progress đọc từ render slice), `invoke('render_audiogram')` → `ipc.renderAudiogram`. StepTranscript bỏ listener `model_download_progress` cục bộ tương tự. Các invoke khác trong component cũ ĐỂ NGUYÊN (Phase 2–3 port).

**Nghiệm thu:** export MP4 thật thành công qua đường ống mới, progress + logs hiện như cũ; tải model thấy % chạy; `cargo check` + `tsc` sạch · commit `p1-t8` (+ tag báo cáo spike PASS/FALLBACK).

---

## T9 — RenderEvent có cấu trúc + render.slice hoàn chỉnh (1 ngày)

**Tham chiếu:** TECH_ARCHITECTURE §2.3 (enum RenderEvent) + §4.2 (cancel). UI_DESIGN_SPEC §7.2 cần: stage, pct, frame/total, eta, cancel.

**Rust:**
1. `domain/entities/render_event.rs`: enum như TECH_ARCHITECTURE §2.3 (Stage/Progress/Log/Failed + `Done { output: String }`), derive Serialize + specta::Type (nếu T8 PASS).
2. `application/render.rs`: emit `render_event` (1 kênh mới) tại các mốc: trước decode → `Stage(Preparing)`; nếu có captions → `Stage(Captions)`; vào frame loop → `Stage(Frames)` + `Progress{pct, frame, total}` mỗi 1% (throttle sẵn có); sau frame cuối → `Stage(Encoding)`; xong → `Done{output}`. GIỮ 2 kênh cũ `log`/`render_progress` phát song song (component cũ còn nghe) — xoá ở Phase 3.
3. **Cancel:** `RenderControl { cancel: Arc<AtomicBool> }` vào `tauri::State` (đăng ký `.manage()` trong lib.rs). Command mới `cancel_render` flip flag. Frame loop check mỗi frame: nếu cancelled → kill ffmpeg child, xoá temp file, emit `Failed{kind:"cancelled"}`, return Err. Reset flag khi bắt đầu job mới; job mới khi đang render → trả `AppError{kind:"already-rendering"}`.

**TS:** `render.slice` thêm: `stage: 'idle'|'preparing'|'captions'|'frames'|'encoding'|'done'|'failed'`, `progressPct`, `frame`, `totalFrames`, `etaSeconds: number|null` (tính trong slice: trung bình tốc độ pct 10s gần nhất — giữ mảng `[t,pct]` nội bộ), action `onRenderEvent(ev)`. `events.ts` subscribe `render_event` → action này. `ipc.cancelRender()` thêm vào client.

**Nghiệm thu:** export thật → console.log chuỗi event đúng thứ tự Stage/Progress/Done; gọi `ipc.cancelRender()` giữa chừng từ devtools → ffmpeg process chết (kiểm `ps aux | grep ffmpeg`), temp file bị xoá, store stage='failed' · `cargo check` sạch · commit `p1-t9`.

---

## T10 — AudioEngine + playback.slice (1 ngày)

**Tham chiếu:** TECH_ARCHITECTURE §2.6. **Mục tiêu:** decode 1 lần, `<audio>` sống ngoài React, transport dùng được ở T12.

**Các bước:**
1. `src/core/audio/AudioEngine.ts` — class singleton (export instance):
   - `load(path)`: `convertFileSrc` → fetch → `AudioContext.decodeAudioData` → build envelope `WAVE_BPS=120` (COPY nguyên thuật toán từ `WaveformCanvas.tsx` — tìm đoạn build `peaks`; đây là "di chuyển", giữ nguyên số học) → set `playback.peaks` + `duration`. Cache theo path (Map path→envelope; giữ tối đa 2 entries).
   - Sở hữu 1 `HTMLAudioElement` (tạo bằng `new Audio()`): `play/pause/toggle/seek(t)/seekBy(dt)`.
   - `timeupdate` → throttle 10Hz → `playback.currentTime`; đăng ký callback rAF riêng `onFrame(cb)` cho canvas đọc `audioEl.currentTime` trực tiếp (hot path không qua store — TECH_ARCHITECTURE §4.3).
2. `playback.slice`: field đã khai ở T7 + actions `_setFromEngine(patch)` (chỉ engine gọi).
3. Nối: khi `project.audioPath` đổi (subscribe trong bootstrap `main.tsx`) → `engine.load(path)`.
4. **Không** gỡ decode trong `WaveformCanvas` ở task này (component cũ vẫn tự decode — trùng 1 lần decode là chấp nhận được trong Phase 1; gỡ ở Phase 2 khi port preview). Ghi TODO.

**Nghiệm thu:** import audio → `useAppStore.getState().peaks.length > 0` và `duration > 0` (check devtools) TRƯỚC khi vào step transcript; play/pause từ console `engine.toggle()` phát tiếng · test unit cho envelope builder (fixture: sine wave WAV nhỏ generate trong test, kiểm envelope length = ceil(dur×120)) · commit `p1-t10`.

---

## T11 — Shell: screen routing + StudioLayout + Toolbar (1–1.5 ngày)

**Tham chiếu:** UI_DESIGN_SPEC §1.2 (grid), §3 (toolbar đầy đủ). Đây là task "nhìn thấy" lớn nhất Phase 1.

**Các bước:**
1. `src/features/studio/StudioLayout.tsx`: grid đúng spec §1.2 — toolbar 48 / [left 280 | canvas flex | right 280] / transport 64 (transport chừa chỗ trống, T12 lấp). Inspector co 240 khi window <1080 (ResizeObserver trên root).
2. `src/features/studio/Toolbar.tsx` theo spec §3 ĐẦY ĐỦ:
   - trái: inset 78px nếu `isMac` (T6) + file chip (audioName, ellipsis giữa) + dropdown menu (dùng Popover T5) với items §3.1 — `Open Audio…` hoạt động thật (logic pickFile chuyển từ StepUpload: copy hàm, giữ nguyên filter/auto-title); `Open Recent/Replace/New Project` render disabled + tooltip "Coming in Phase 2" (trừ New Project: confirm Modal → reset store về DEFAULT + screen 'start').
   - giữa: SegmentedControl `Design|Captions` bind `ui.mode` + badge số segments (spec §3.2).
   - phải: Button primary `Export ⌘E` — Phase 1 hành vi tạm: `set({step:'export'})` và panel trái render StepExport (sheet thật ở Phase 3); disabled khi !audioPath.
   - Toàn toolbar `data-tauri-drag-region`.
3. `App.tsx` viết lại: `screen==='start'` → `features/start/StartScreen.tsx` **tạm** = bọc `StepUpload` cũ trong container căn giữa nền tối (Start thật ở Phase 2; khi StepUpload set audioPath → effect trong App set `screen:'studio'`); `screen==='studio'` → StudioLayout với nội dung TẠM: mode design → panel trái trống + canvas giữa = `StepLayout` cũ nguyên con chiếm vùng canvas+inspector; mode captions → `StepTranscript` cũ tương tự. XOÁ: `Sidebar.tsx` (file + import), top bar cũ, step pills.
4. Fade-slide 150ms khi đổi mode (spec §1.2): wrapper `key={mode}` + CSS animation.

**Nghiệm thu:** flow tay: mở app (start screen nền tối) → import → tự vào studio, toolbar đúng spec, đổi Design/Captions thấy 2 step cũ, Export đi tới StepExport cũ và export chạy · không còn Sidebar/step-pills trong DOM · `npm run lint` 0 error · commit `p1-t11`.

---

## T12 — TransportBar (1 ngày)

**Tham chiếu:** UI_DESIGN_SPEC §6 — làm đúng từng phần TRỪ segment blocks + now-playing chip (cần captions mode mới — Phase 3; chừa slot trong JSX với TODO).

**Các bước:**
1. `src/features/transport/TransportBar.tsx`: play/pause 40px (engine.toggle), timecode `tabular` 2 bên, seek strip vẽ mini waveform từ `playback.peaks` lên `<canvas>` (bars 2px/gap 1px, played = accent — vẽ lại khi peaks/size đổi; playhead update qua `engine.onFrame`, KHÔNG qua store). Click/drag strip → `engine.seek(pct*duration)`. Hover tooltip timecode theo vị trí chuột.
2. Disabled state (chưa có audio / đang decode): nút mờ + spinner theo spec.
3. Gắn vào StudioLayout hàng transport.

**Nghiệm thu:** play/pause/seek/drag hoạt động, playhead mượt (không giật theo store 10Hz — xác nhận đọc từ engine), Space CHƯA cần (T13) · commit `p1-t12`.

---

## T13 — Shortcuts + native menu (½ ngày)

**Tham chiếu:** UI_REBUILD_PLAN §4.2–4.3, spec §các phím trong từng màn.

**Các bước:**
1. `src/app/shortcuts.ts`: bảng declarative `[{combo:'space', when:'notTyping', run: ()=>engine.toggle()}, {combo:'mod+o',...}, {combo:'mod+1|mod+2', run: setMode}, {combo:'mod+e',...}, {combo:'left|right', when:'notTyping', run: seekBy(∓5)}]` — 1 listener keydown toàn cục ở bootstrap; guard `notTyping` = target không phải input/textarea/contentEditable. Undo (⌘Z) CHƯA nối (Phase 4) — không đăng ký.
2. `src/app/menu.ts`: Tauri Menu API (`@tauri-apps/api/menu`) — File (Open Audio ⌘O, Export ⌘E) / Edit (submenu mặc định copy/paste — dùng `PredefinedMenuItem`) / View (Design ⌘1, Captions ⌘2) / Help (Keyboard Shortcuts → Modal liệt kê từ bảng shortcuts — single source). Menu item và shortcut GỌI CHUNG một action registry (không duplicate handler).

**Nghiệm thu:** cả 5 combo phím + menu bar macOS chạy; gõ trong input không bị Space cướp; Help mở modal danh sách phím · commit `p1-t13`.

---

## T14 — Contract codegen (constants + zones) (1 ngày)

**Tham chiếu:** TECH_ARCHITECTURE §2.4a. **Nguyên tắc: GIÁ TRỊ COPY NGUYÊN VĂN từ code hiện tại — task này KHÔNG đổi bất kỳ con số nào.**

**Các bước:**
1. `contract/constants.json` — chép đúng giá trị đang có: `WAVE_BARS:64, BAR_FILL:0.64, GAP_FILL:0.36, EQ_BANDS:40, EQ_BPS:30, WAVE_BPS:120, BG_DARK_TOP:0.22, BG_DARK_BOTTOM:0.50, INTRO_DURATION:3, SPLIT_BPS:30` (đối chiếu từng cái với `waves/support.ts`, `frame.rs`, `spectrum/rustfft.rs`, `StepTranscript.tsx` trước khi ghi). `contract/zones.json` = `DEFAULT_ZONES` từ `types.ts` nguyên văn.
2. `contract/codegen.mjs`: sinh
   - `apps/desktop/src/domain/contract.gen.ts` (`export const WAVE_BARS = 64 as const` ... + `DEFAULT_ZONES` typed)
   - `apps/desktop/src-tauri/src/domain/contract_gen.rs` (`pub const WAVE_BARS: usize = 64;` ... + zones dưới dạng `pub fn default_zones(template: &str) -> ...` hoặc const array — chọn dạng khớp cách `frame.rs` đang dùng zones)
   - Cả 2 file có header `// GENERATED — edit contract/*.json instead`.
3. Wire: script `"contract:gen"` ở root package.json; gọi trong `dev`/`build` của app (`predev`/`prebuild`); Rust: `build.rs` chạy node script? KHÔNG — build.rs không được phụ thuộc node. Thay vào đó: file .rs sinh sẵn được COMMIT vào repo, codegen chỉ chạy phía npm; thêm test Rust `contract_gen_is_fresh` = hash constants trong file .rs khớp hash trong 1 file `.hash` do codegen ghi (đơn giản: so sánh giá trị từng const với literal test — đủ tốt).
4. **Thay thế bản chép tay:** TS — `waves/support.ts` import từ contract.gen (xoá literal); `types.ts` DEFAULT_ZONES → re-export từ contract.gen. Rust — `frame.rs`/`rustfft.rs` dùng `crate::domain::contract_gen::*` (xoá literal cũ). Chạy golden bằng MẮT: export 1 video trước/sau task, so sánh 2 file trông giống hệt.

**Nghiệm thu:** grep không còn literal `0.64`/`= 64`/`= 40` bản chép ở call-sites cũ (trừ file gen) · export video before/after giống nhau · sửa thử 1 giá trị trong JSON → gen → cả TS lẫn Rust đổi theo (rồi revert) · commit `p1-t14`.

---

## T15 — Cargo workspace + crates `audiogram-spectrum`, `audiogram-core` (1 ngày)

**Tham chiếu:** PACKAGE_SPLIT_PLAN §3.1, §6 đợt 1.

**Các bước:**
1. Root `Cargo.toml`: `[workspace] members = ["crates/*", "apps/desktop/src-tauri"] resolver = "2"` (+ `[workspace.dependencies]` cho serde, thiserror). Sửa `apps/desktop/src-tauri/Cargo.toml` dùng workspace deps.
2. `crates/audiogram-spectrum`: move `infrastructure/spectrum/rustfft.rs` (nguyên văn, đổi path serde import nếu cần). App crate: `audiogram-spectrum = { path = "../../../crates/audiogram-spectrum" }`, module cũ thành re-export.
3. `crates/audiogram-core`: move `domain/entities/*` + `shared/error.rs` + phần THUẦN của `shared/util.rs` (hex_to_rgb, wrap_text_2lines, escape_drawtext, time formatters). `emit_log` (dính tauri) Ở LẠI app crate (`shared/util.rs` còn lại mỗi nó). Lưu ý: `AppError` đang derive gì liên quan tauri (vd `impl Serialize` cho command return) — nếu có phần dính tauri, tách `impl` đó ở app crate (newtype hoặc feature flag `tauri` trong core — chọn feature flag: `[features] tauri = ["dep:tauri"]`, mặc định off, app bật).
4. Specta derive (nếu T8 PASS): core crate thêm optional dep specta sau feature flag tương tự.

**Nghiệm thu:** `cargo check --workspace` sạch · `cargo test -p audiogram-spectrum` (viết 1 test: sine 440Hz → band chứa 440Hz có năng lượng max) · app chạy như cũ · commit `p1-t15`.

---

## T16 — Crates `audiogram-render` + `audiogram-subtitle` (ProgressSink) (1–1.5 ngày)

**Tham chiếu:** PACKAGE_SPLIT_PLAN §3.1 (vết bẩn duy nhất: AppHandle/Emitter), §6 bước 3.

**Các bước:**
1. `crates/audiogram-render`: move `infrastructure/ffmpeg/render/{frame,wave,pixel}.rs` + deps (rayon, audiogram-core, audiogram-spectrum, contract_gen — **chuyển `contract_gen.rs` vào audiogram-core** để render/subtitle cùng dùng, cập nhật codegen T14 output path).
2. Cắt tauri khỏi render loop:
   ```rust
   // crates/audiogram-render/src/progress.rs
   pub trait ProgressSink: Send + Sync {
     fn emit(&self, event: RenderEvent);   // RenderEvent chuyển vào audiogram-core
   }
   ```
   Hàm render nhận `&dyn ProgressSink` (hoặc generic `S: ProgressSink`) thay `AppHandle`. App crate: `struct TauriSink(AppHandle)` implement bắn cả kênh mới `render_event` lẫn 2 kênh cũ (giữ tương thích T9).
   **Ranh giới move:** chỉ phần rasterize thuần (frame/wave/pixel + vòng lặp sinh RGBA). Spawn/quản lý ffmpeg process (encode_blocking, resolver) Ở LẠI app crate — app đọc RGBA từ crate qua callback/iterator per-frame (`render_frames(params, &mut impl FnMut(&[u8]) -> anyhow::Result<()>, sink)`).
3. `crates/audiogram-subtitle`: move `infrastructure/subtitle/{srt,ass,util}.rs` — cần format helpers từ core (đã move ở T15).
4. Test trong crate render: `renders_one_frame` — params tối thiểu (minimal template, bar style, peaks giả `vec![0.5; 1200]`, 320×180) → buffer đúng size `w*h*4`, không panic, pixel giữa khung ≠ pixel nền (có vẽ gì đó). Test subtitle: ass builder với 2 segment karaoke → chuỗi chứa `\k` tags đúng thứ tự thời gian.

**Nghiệm thu:** `cargo test --workspace` xanh · export video thật OK (đường ống qua sink mới) · so video before/after giống nhau · app crate không còn `mod render`/`mod subtitle` nội bộ (chỉ re-export) · commit `p1-t16`.

---

## T17 — npm packages `@audiogram/contract` + `@audiogram/wave-effects` (1 ngày)

**Tham chiếu:** PACKAGE_SPLIT_PLAN §3.2, §4.

**Các bước:**
1. `packages/contract`: move output TS của codegen T14 vào đây (`src/index.ts` = contract.gen.ts; codegen.mjs đổi đích). package.json `{"name":"@audiogram/contract","version":"0.0.0","type":"module","exports":{".":"./src/index.ts"}}` (export TS source trực tiếp — Vite xử lý; không cần build step). App import đổi `../domain/contract.gen` → `@audiogram/contract` (workspace dep).
2. `packages/wave-effects`: move `apps/desktop/src/waves/**` → `packages/wave-effects/src/`. Đổi `id: WaveStyle` → `id: string` trong `WaveEffect` interface; `WAVE_EFFECTS` record → `Record<string, WaveEffect>`; app phía `types.ts` giữ union `WaveStyle` cho store (validate qua registry khi cần). Dep: `@audiogram/contract` (WAVE_BARS). KHÔNG dep react/tauri — thêm test import-hygiene: test đọc package.json assert deps chỉ chứa contract.
3. Vitest cho wave-effects (chạy trong package): node-canvas? — KHÔNG thêm node-canvas (native build nặng); thay bằng mock CanvasRenderingContext2D ghi lại calls (`beginPath/fill/...`), test 9 effects: draw với heights giả không throw + có gọi lệnh vẽ >0. jsdom đủ.
4. Root: `"test": "npm run test -ws --if-present"`.

**Nghiệm thu:** app chạy + preview 9 style như cũ · `npm test -w @audiogram/wave-effects` xanh · `npm run lint` 0 error · commit `p1-t17`.

---

## T18 — CI pipeline (½ ngày)

`.github/workflows/ci.yml` — trigger PR + push main/design-dark; runner `macos-latest`:
```
jobs:
  frontend:  npm ci → npm run contract:gen → typecheck (-w audiogram) → lint → test -ws
  rust:      (cache cargo) cargo check --workspace → cargo test --workspace
```
KHÔNG chạy `tauri build` trong CI Phase 1 (chậm & cần sidecar binaries — ghi TODO Phase 3). Nếu repo chưa có remote GitHub: vẫn commit file workflow + thêm script tổng `npm run ci` chạy local đúng chuỗi trên.

**Nghiệm thu:** `npm run ci` local xanh từ máy sạch (`git clean -xfd` + `npm install` — cẩn thận: backup trước) · commit `p1-t18`.

---

## B. Tổng ngân sách & cách giao việc

| Milestone | Tasks | Ước lượng |
|---|---|---|
| M0 nền repo | T1, T2 | 1 ngày |
| M1 design system | T3, T4, T5, T6 | 2.5–3 ngày |
| M2 state/ipc/audio | T7, T8, T9, T10 | 4–4.5 ngày |
| M3 shell | T11, T12, T13 | 2.5–3 ngày |
| M4 contract/packages/CI | T14–T18 | 4–5 ngày |
| **Tổng Phase 1** | 18 tasks | **~14–16 ngày Sonnet** (song song hoá được: M1 ∥ M2 sau T2) |

**Prompt template giao từng task cho Sonnet:**

> Đọc `PHASE1_TASKS.md` mục A (luật chung) và task T<n> trong repo. Đọc thêm các mục được task trỏ tới trong `UI_DESIGN_SPEC.md` / `TECH_ARCHITECTURE.md` / `PACKAGE_SPLIT_PLAN.md`. Thực hiện đúng phạm vi T<n>, không làm lố sang task khác. Chạy đủ nghiệm thu chung (mục A.2) + nghiệm thu riêng của task, báo cáo kết quả từng checkbox, liệt kê mọi TODO đã ghi. Nếu kẹt theo luật A.4 thì dừng và hỏi.

**Điều kiện đóng Phase 1 (review bởi model lớn hơn trước khi sang Phase 2):**
- [ ] 18 task commit đủ, `npm run ci` xanh
- [ ] Flow người dùng cũ (import→layout→transcript→export MP4) chạy 100% trên shell mới
- [ ] Video export before/after Phase 1 giống nhau (parity không suy suyển)
- [ ] Không file nào ngoài `bindings.gen.ts`/`contract.gen.*` là generated-but-hand-edited
- [ ] Danh sách TODO(p1-*) được tổng hợp thành input cho Phase 2
