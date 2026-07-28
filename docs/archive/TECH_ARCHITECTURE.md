# Audiogram — Phân tích kiến trúc & kỹ thuật chi tiết
*Ngày lập: 25/07/2026 · Đồng hành với: `UI_REBUILD_PLAN.md` (sản phẩm) + `UI_DESIGN_SPEC.md` (giao diện)*
*Phạm vi: kiến trúc source code hướng enterprise — tối ưu khả năng nâng cấp, cải tiến, tích hợp plugin.*

---

## PHẦN I — ĐÁNH GIÁ HIỆN TRẠNG

### 1.1 Backend Rust: ĐÃ đạt chuẩn — giữ nguyên hướng

Commit `d7ec4ca` đã refactor backend sang **clean architecture** đúng nghĩa:

```
src-tauri/src/
├── main.rs / lib.rs
├── shared/            error.rs, util.rs          ← cross-cutting
├── domain/entities/   segment, layout, wave_style, render_job,
│                      model_spec, write_ass_params   ← thuần data, không I/O
├── application/       render.rs, transcribe.rs, model.rs  ← use-cases
├── infrastructure/
│   ├── ffmpeg/        resolver, audio, filter, render/{frame,wave,pixel}
│   ├── subtitle/      srt, ass, util
│   ├── spectrum/      rustfft
│   └── whisper/       runner, model_repo
└── presentation/commands/  audio, video, transcript, utils  ← Tauri boundary
```

Đánh giá: phân tầng đúng (dependency chỉ chảy vào trong: presentation → application → domain; infrastructure bị application gọi qua interface ngầm). Đây là **chuẩn mà frontend phải theo kịp**.

> ⚠️ `CLAUDE.md` vẫn mô tả cây module cũ (ffmpeg.rs, video/, transcribe/ ở root) — cần cập nhật (đã tạo task riêng).

### 1.2 Frontend: nợ kiến trúc — bảng vấn đề

| # | Vấn đề | Bằng chứng | Hệ quả |
|---|---|---|---|
| F1 | **God store** — 25 field phẳng trộn 6 mối quan tâm (project, design, captions, playback, render, nav) trong 1 zustand store | `store.ts` | Không undo/redo theo scope được, persistence phải cherry-pick tay, component nào cũng với tới mọi thứ |
| F2 | **IPC rải rác** — `invoke()` gọi thẳng trong component, string command + tham số shape tự do, không có contract | `StepTranscript.tsx:158`, `StepExport.tsx:98` (`render_audiogram` params snake_case viết tay) | Đổi 1 command Rust = grep toàn codebase; typo chỉ phát hiện lúc runtime |
| F3 | **Event listener trong component** — `listen('log'/'render_progress'/'model_download_progress')` gắn theo lifecycle của Step, đã từng gây bug stale-closure (fix tại `StepExport.tsx:45`) | 3 component | Sự kiện bị mất khi component unmount (bug "render_progress chưa nối" trong known_issues) |
| F4 | **Business logic trong UI** — `splitSegments`/`findSilence` (60 dòng thuật toán) nằm trong `StepTranscript.tsx`; ước lượng file size, slug filename... sẽ tiếp tục rơi vào component | `StepTranscript.tsx:14-43` | Không test được, không tái dùng được |
| F5 | **Style phi hệ thống** — 100% inline styles, hex hard-code lặp ~200 lần, Tailwind 4 đã cài nhưng không dùng | mọi component | Đổi theme = sửa từng dòng; dark rebuild sẽ đau đúng chỗ này |
| F6 | **Parity thủ công 2 ngôn ngữ** — hằng số & hình học layout chép tay TS ↔ Rust, chỉ được bảo vệ bằng lời dặn trong CLAUDE.md | bảng parity CLAUDE.md | Drift là chuyện thời gian; không có test nào bắt được |
| F7 | **Audio engine gắn React** — decode + envelope + `<audio>` element sống trong `WaveformCanvas`/`StepTranscript` lifecycle | `WaveformCanvas.tsx` mount effect | Đổi step = decode lại; transport bar xuyên mode (spec §6) không làm được nếu giữ nguyên |
| F8 | **Zero test, zero CI gate** — không vitest, không cargo test, `tsc --noEmit` chạy tay | `package.json` | Refactor lớn sắp tới không có lưới an toàn |

### 1.3 Hạt giống tốt cần nhân rộng

- **`src/waves/` registry** — mẫu extension-point chuẩn: interface `WaveEffect {id,label,desc,draw(ctx)}`, registry object, UI list derive từ registry, mỗi effect 1 file, ghi rõ file Rust parity. *Đây là hình mẫu cho toàn bộ hệ plugin.*
- `DEFAULT_ZONES` — layout template đã là **data** (fraction 0–1), không phải code. Mở đường cho template-as-JSON.
- `react-virtuoso` (list lớn), `react-rnd` (đã bọc gọn trong 1 chỗ), zustand (đúng chọn lựa, chỉ thiếu cấu trúc).

---

## PHẦN II — KIẾN TRÚC ĐÍCH

### 2.1 Nguyên tắc

1. **Frontend soi gương backend**: cùng ngôn ngữ phân tầng — `domain` (thuần) / `core` (hạ tầng app) / `features` (use-case + UI) / `ui` (primitives câm).
2. **Một biên giới IPC duy nhất, có type**: component không bao giờ import `@tauri-apps/api` trực tiếp.
3. **Contract sinh tự động, không chép tay**: types + hằng số parity có 1 nguồn, sinh ra 2 phía.
4. **Extension-point là kiến trúc, không phải afterthought**: mọi danh mục "có thể thêm item" (wave, template, palette, preset) đi qua cùng 1 cơ chế registry.
5. **Mọi tầng dưới `features` phải test được không cần Tauri runtime** (mock IPC port).

### 2.2 Cây thư mục frontend đích

```
src/
├── app/                        # composition root
│   ├── main.tsx                # bootstrap: providers, ipc init, session restore
│   ├── App.tsx                 # screen router (start | studio) — mỏng
│   ├── shortcuts.ts            # bảng phím tắt toàn cục (declarative)
│   └── menu.ts                 # native menu definition → gọi cùng actions với shortcuts
│
├── core/                       # hạ tầng phía app — KHÔNG có React ở đây
│   ├── ipc/
│   │   ├── bindings.gen.ts     # ★ SINH TỰ ĐỘNG từ Rust (tauri-specta) — commands + types
│   │   ├── client.ts           # facade: retry/normalize error, mock được trong test
│   │   └── events.ts           # typed event bus: subscribe 1 LẦN lúc bootstrap,
│   │                           #   fan-out vào store actions (hết đời bug F3)
│   ├── audio/
│   │   └── AudioEngine.ts      # singleton ngoài React: decode → envelope cache,
│   │                           #   HTMLAudioElement sở hữu tại đây, pub state qua store
│   ├── persistence/
│   │   ├── SessionRepository.ts# save/load session.json (debounced), recents + thumbnails
│   │   └── migrations.ts       # session schema có `version`, migration tuần tự
│   ├── errors.ts               # AppError chuẩn hoá {kind, message, detail, retryable}
│   └── telemetry.ts            # dev logger có cấu trúc (console groups), no-op ở prod
│
├── domain/                     # thuần TypeScript, zero import React/Tauri — test 100%
│   ├── types.ts                # (chuyển từ src/types.ts) Segment, LayoutZones...
│   ├── contract.gen.ts         # ★ SINH từ contract/constants.json (xem §2.4)
│   ├── segments/               # splitSegments, findSilence (RỜI StepTranscript),
│   │   └── ops.ts              #   splitAt, mergeWithNext, remove — cho context menu mới
│   ├── zones.ts                # clamp/snap/fraction math của layout editor
│   └── export/estimate.ts      # ước lượng size/time cho Export sheet
│
├── store/                      # zustand — 1 store, NHIỀU slice
│   ├── index.ts                # compose slices + middleware (persist-partialize, temporal)
│   ├── project.slice.ts        # audioPath, audioName, title, screen, recents
│   ├── design.slice.ts         # template, waveStyle/Color, bgColor, zones, title*, cover  ← undo scope
│   ├── captions.slice.ts       # segments, srtPath, whisperModel, subtitle*, karaoke*     ← undo scope
│   ├── playback.slice.ts       # currentTime, playing, duration, peaks (từ AudioEngine)
│   ├── render.slice.ts         # isRendering, stage, progress, eta, logs, lastOutput
│   └── ui.slice.ts             # mode, selectedEl, selectedSegmentId, sheet/dialog state — KHÔNG persist
│
├── extensions/                 # ★ hệ plugin — PHẦN III
│   ├── kernel.ts               # ExtensionPoint<T> + registry + manifest types
│   ├── waves/                  # (di trú từ src/waves/) — built-in wave effects
│   ├── templates/              # built-in layout templates (data-first)
│   ├── palettes/               # WAVE_COLORS/BG_COLORS/... thành palette entries
│   └── presets/                # export presets (YouTube/TikTok/IG...)
│
├── features/                   # mỗi feature = UI + hook + service cục bộ, import xuống dưới
│   ├── start/                  # StartScreen, RecentGrid
│   ├── studio/                 # StudioLayout, Toolbar, mode switch
│   ├── design/                 # DesignPanel, CanvasStage, DesignInspector, galleries
│   ├── captions/               # CaptionsPanel, SegmentList, CaptionsInspector, transcribe hook
│   ├── transport/              # TransportBar, seek strip, segment blocks
│   ├── export/                 # ExportSheet (4 states), useRenderJob
│   └── preview/                # WaveformCanvas (renderer thuần) + thumbnailer
│
└── ui/                         # primitives câm theo spec §9 — không import store
    ├── Button.tsx  Select.tsx  Slider.tsx  Toggle.tsx  SwatchRow.tsx
    ├── SegmentedControl.tsx  Field.tsx  Tooltip.tsx  Modal.tsx
    ├── Popover.tsx  ContextMenu.tsx  Progress.tsx  Toast.tsx
    └── tokens.css              # @theme Tailwind 4 — nguồn token duy nhất
```

**Luật import (cưỡng chế bằng ESLint `import/no-restricted-paths`):**

```
ui        → (không import gì của app)
domain    → (không import gì của app)
core      → domain
extensions→ domain, core
store     → domain, core, extensions
features  → tất cả ở trên
app       → features
CẤM: ui/domain import store; features import chéo feature khác (đi qua store)
```

### 2.3 Tầng IPC có type — diệt F2/F3

**Chọn `tauri-specta` v2** (Tauri v2 support): derive `specta::Type` trên các entity + macro trên commands → build script sinh `bindings.gen.ts` chứa toàn bộ command signatures & event types.

```rust
// presentation/commands/video.rs
#[tauri::command]
#[specta::specta]
pub async fn render_audiogram(params: RenderJob, ...) -> Result<String, AppError> { ... }
```

```ts
// core/ipc/client.ts — LỚP DUY NHẤT được import bindings
import { commands, events } from './bindings.gen'

export const ipc = {
  renderAudiogram: (job: RenderJob) => wrap(commands.renderAudiogram(job)),
  transcribeAudio: (p: string, model: string) => wrap(commands.transcribeAudio(p, model)),
  // wrap(): Result<T, AppError> → throw AppError chuẩn hoá (core/errors.ts)
}
```

```ts
// core/ipc/events.ts — subscribe MỘT lần ở bootstrap, không bao giờ trong component
export function attachIpcEvents(store: AppStore) {
  events.renderEvent.listen(e => store.getState().render.onRenderEvent(e.payload))
  events.modelDownloadProgress.listen(e => store.getState().captions.onModelProgress(e.payload))
}
```

**Nâng cấp event render (backend nhỏ, giá trị lớn):** thay 2 kênh `log: String` + `render_progress: f32` bằng 1 event có cấu trúc — UI Export sheet (spec §7.2) cần đúng cái này:

```rust
#[derive(Serialize, specta::Type, Clone)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum RenderEvent {
  Stage { stage: RenderStage },              // Preparing|Captions|Frames|Encoding|Done
  Progress { pct: f32, frame: u32, total: u32 },
  Log { line: String },                      // vẫn giữ cho "Show details"
  Failed { error: AppError },
}
```

### 2.4 Contract & Parity — diệt F6 (rủi ro số 1 của codebase)

**Vấn đề:** `WAVE_BARS=64`, `BAR_FILL=0.64`, `DEFAULT_ZONES`, geometry 6 layout... tồn tại 2 bản chép tay TS + Rust. Đây là invariant sống còn (preview = export).

**Giải pháp 3 lớp:**

**(a) Hằng số → 1 nguồn JSON, sinh 2 phía**
```
contract/
├── constants.json        # WAVE_BARS, BAR_FILL, GAP_FILL, EQ_BANDS, EQ_BPS,
│                         #   WAVE_BPS, BG_DARK_TOP/BOTTOM, intro_duration...
├── zones.json            # DEFAULT_ZONES per template (đã là data sẵn)
└── codegen.mjs           # → src/domain/contract.gen.ts
                          # → src-tauri/src/domain/contract_gen.rs (build.rs include!)
```
Chạy trong `npm run dev/build` (vite plugin watch) + `build.rs`. Xoá bản chép tay ở cả 2 phía.

**(b) Types → sinh từ Rust** (tauri-specta ở §2.3 — Segment, RenderJob, LayoutZones... Rust là chủ sở hữu type).

**(c) Golden-frame test — lưới an toàn cuối:**
- `cargo test golden_frames`: render frame tại t=0/25%/50% cho từng (template × wave style tiêu biểu) với peaks giả cố định → PNG vào `tests/golden/`, so pixel-hash với bản đã commit.
- Phía TS: vitest + node-canvas render cùng frame với cùng input → so SSIM ≥ 0.98 với PNG golden của Rust (cho phép lệch anti-aliasing).
- Chạy trong CI; PR nào làm lệch parity là thấy ngay bằng ảnh diff.

### 2.5 State — slices, undo, persistence

- **Slices** như cây §2.2. Component chỉ subscribe qua **selector hooks** của feature (`useDesign(s => s.waveColor)`) — cấm `useAppStore(s => s)` nguyên con.
- **Undo/redo (⌘Z):** middleware `zundo` (temporal) bọc **riêng** `design.slice` + `captions.slice` (2 history stack độc lập theo mode đang active — đúng kỳ vọng người dùng editor). Playback/render/ui không vào history.
- **Persistence:** `SessionRepository` subscribe store (debounce 800ms), `partialize` = project + design + captions + whisperModel. Schema:
```ts
interface SessionFile { version: 1; savedAt: string; project: {...}; design: {...}; captions: {...} }
```
  `migrations.ts` chạy tuần tự `v1→v2→...` khi load — chi phí gần 0 hôm nay, cứu mạng khi field đổi nghĩa sau này.
- **Recents:** mảng tối đa 8 `{sessionPath, title, audioPath, duration, thumbnailPng, savedAt}` trong `recents.json` + thumbnail do `features/preview/thumbnailer` render offscreen lúc save.

### 2.6 AudioEngine — diệt F7

Singleton ngoài React, khởi tạo ở bootstrap:

```ts
class AudioEngine {
  load(path: string): Promise<void>       // decode 1 lần: envelope (WAVE_BPS) + duration
  //  đồng thời kick invoke analyze_spectrum (eq) — cache theo path
  play/pause/seek/toggle(...)             // sở hữu <audio> element duy nhất
  get envelope(): number[]                // nguồn của store.playback.peaks
  onTick(cb)                              // rAF-throttled currentTime → playback.slice
}
```

Hệ quả: chuyển mode/screen không re-decode; transport bar (spec §6) và mọi preview đọc cùng nguồn; `WaveformCanvas` trở thành **renderer thuần** nhận props, không side-effect decode nữa.

---

## PHẦN III — KIẾN TRÚC PLUGIN / EXTENSION

### 3.1 Mô hình 3 cấp (quyết định kiến trúc quan trọng nhất)

Bài toán đặc thù của audiogram: **một "hiệu ứng" phải chạy ở 2 nơi** — canvas TS (preview) và Rust (export). Mọi thiết kế plugin phải trả lời câu hỏi parity trước tiên. Phân tích 3 phương án cho code-plugin:

| Phương án | Parity | Sandbox | Chi phí | Kết luận |
|---|---|---|---|---|
| (A) Dual-impl compile-time (hiện tại) | Tay + golden test | N/A (trusted) | Thấp | **v1 — giữ** |
| (B) DSL khai báo (JSON mô tả bars/curve/glow trên primitive ops) | Miễn phí (2 interpreter đọc cùng data) | An toàn tuyệt đối | Trung bình; biểu đạt giới hạn | **v2 — cho template/palette/preset (đã là data), và "wave variant"** |
| (C) WASM module (1 impl, chạy wasmtime ở Rust + WebAssembly ở webview) | Miễn phí thật sự | Tốt (fuel limit, no imports) | Cao (toolchain, ABI, versioning) | **v3 — chỉ khi có marketplace thật** |

**Quyết định:** kernel extension viết **ngay từ v1** (rẻ), 3 cấp nội dung:

- **Cấp 0 (v1)** — *built-in, compile-time*: wave effects, templates, palettes, export presets đăng ký qua kernel. Plugin = thêm file + 1 dòng registry (chuẩn `src/waves/` hiện tại, tổng quát hoá).
- **Cấp 1 (v1.x)** — *data extensions, load động*: template/palette/preset là JSON thuần → load an toàn từ `app_data_dir/extensions/*.audiogram-ext.json`, validate bằng zod schema, không có code thực thi. Rust không cần biết palette; template-as-data thì Rust đã đọc zones động sẵn (`RenderJob` mang zones).
- **Cấp 2 (v2+)** — *wave effect DSL rồi WASM*: thiết kế interface hôm nay sao cho `WaveEffect.draw` có thể được thay bằng interpreter/wasm-host mà call-site không đổi.

### 3.2 Kernel API (viết ở v1, ~100 dòng)

```ts
// extensions/kernel.ts
export interface ExtensionManifest {
  id: string            // 'com.audiogram.wave.bar'
  kind: 'wave' | 'template' | 'palette' | 'export-preset'
  version: string       // semver — dùng cho migration data sau này
  label: string
  builtin: boolean
}

export class ExtensionPoint<T extends { manifest: ExtensionManifest }> {
  register(ext: T): void            // throw nếu trùng id; builtin đăng ký lúc bootstrap
  get(id: string): T | undefined
  list(): readonly T[]              // ổn định thứ tự: builtin trước, theo label
  onChange(cb: () => void): Unsub   // UI gallery re-render khi load extension động
}

export const wavePoint     = new ExtensionPoint<WaveExtension>()
export const templatePoint = new ExtensionPoint<TemplateExtension>()
export const palettePoint  = new ExtensionPoint<PaletteExtension>()
export const presetPoint   = new ExtensionPoint<ExportPresetExtension>()
```

**Contract từng loại:**

```ts
interface WaveExtension {           // Cấp 0: draw là code TS + tên counterpart Rust
  manifest: ExtensionManifest
  draw(c: WaveDrawCtx): void        // giữ nguyên interface src/waves/types.ts
  rustId: string                    // validate lúc dev: registry Rust phải có id này
  thumbnailSim?: (t: number) => number[]  // cho gallery animation, default dùng chung
}

interface TemplateExtension {       // data-first — draw KHÔNG nằm ở đây
  manifest: ExtensionManifest
  zones: LayoutZones                // vị trí các block (đã là chuẩn hiện tại)
  defaults: { waveColor: string; bgColor: string; waveStyle: string; karaoke: boolean }
  needsAvatar: boolean
  tags: string[]
  composition: CompositionSpec      // ★ xem 3.3
}

interface PaletteExtension  { manifest; colors: {hex: string; name: string}[]; for: 'wave'|'bg'|'subtitle'|'karaoke' }
interface ExportPresetExtension { manifest; canvasSize: CanvasSize; fps: number; note: string }
```

Store lưu **id string** (`waveStyle: string` thay vì union type cứng) — union `WaveStyle` hiện tại chuyển thành id của built-ins; validate qua kernel khi load session (extension bị gỡ → fallback `bar` + toast).

### 3.3 Template = composition data (mở khoá Cấp 1)

Hiện 6 hàm `drawSpotify/drawSplit/...` (TS) + 6 match arms (Rust) chủ yếu khác nhau ở: block nào có mặt, đặt ở đâu (zones — đã là data), và vài biến thể trang trí (avatar tròn/vuông, có progress ring, overlay gradient). Chuẩn hoá phần "vài biến thể" thành spec:

```ts
interface CompositionSpec {
  background: { kind: 'color' } | { kind: 'cover-blur'; dim: number }
  avatar?:    { shape: 'circle' | 'rounded' | 'fill-half'; ring?: boolean }
  title:      { maxLines: 1 | 2 }
  subtitle?:  { style: 'pill' | 'bare' | 'karaoke-block' }
}
```

2 phía cùng render từ spec này (TS compositor + Rust compositor) → **hàm draw per-template biến mất**, template mới = 1 file JSON, tự động parity. Đây là refactor có lợi nhất sau IPC — làm ở Phase 2/3 của rebuild khi port `WaveformCanvas` & `frame.rs` (dù sao cũng phải sờ vào).

### 3.4 Load extension động (Cấp 1) — an toàn

```
app_data_dir/extensions/
└── sunset-template.audiogram-ext.json    # {manifest, ...TemplateExtension}
```
- Bootstrap: đọc dir (qua ipc `list_extensions` — thêm 1 command Rust đọc file, hoặc `plugin-fs` scope hẹp), `zod.safeParse` từng file, lỗi → toast + bỏ qua, không crash.
- Không eval, không import code → không cần sandbox. UI: mục Settings nhỏ "Extensions" liệt kê + Reveal folder.

---

## PHẦN IV — CROSS-CUTTING CONCERNS

### 4.1 Error handling — một đường ống duy nhất

```
Rust: AppError (shared/error.rs — đã có) --serde--> bindings
TS:   core/errors.ts  normalize mọi nguồn (ipc, dom, engine) → AppError
      { kind: 'ffmpeg-missing' | 'decode-failed' | 'whisper-failed' | 'io' | 'cancelled' | 'unknown',
        message: string,          // người đọc được, đã map sẵn theo kind
        detail?: string,          // log kỹ thuật — vào "Show details"
        retryable: boolean }
```
Quy tắc hiển thị: lỗi chặn luồng (render/transcribe fail) → inline trong sheet/panel với Retry; lỗi phụ (SRT write, thumbnail) → toast; không bao giờ hiện raw string exception.

### 4.2 Concurrency & cancellation (Rust)

- `render_audiogram` hiện chạy blocking + không cancel được. Thêm:
  - `RenderJobHandle { cancel: Arc<AtomicBool> }` trong Tauri `State`; frame-loop check mỗi frame; `cancel_render` command flip flag + kill ffmpeg child + xoá temp file.
  - Chặn job trùng: command trả lỗi `already-rendering` nếu handle active (UI đã chặn nhưng backend phải tự vệ).
- `transcribe_audio`: tương tự ở v1.x (nice-to-have; whisper chạy process riêng → kill child).

### 4.3 Performance budgets

| Điểm nóng | Ngân sách | Cơ chế |
|---|---|---|
| Preview rAF | 1 vòng rAF duy nhất toàn app (canvas chính + 9 gallery thumbnail vẽ chung 1 tick, gallery throttle 15fps) | `features/preview/rafHub.ts` |
| Envelope decode | 1 lần / file (AudioEngine cache theo path) | §2.6 |
| Segment list | Virtuoso (đã có), search debounce 150ms | |
| Store update từ audio tick | ≤ 10 Hz vào store (UI timecode); canvas đọc trực tiếp từ engine (không qua store) mỗi frame | tách "hot path" khỏi React |
| Session save | debounce 800ms, thumbnail chỉ render lúc idle (`requestIdleCallback`) | |

### 4.4 Testing & CI

```
vitest:  domain/** (segments ops, zones math, estimate) — coverage gate 90% cho domain
         store/**  (slice actions, undo scoping, persistence partialize)
         core/ipc/client (mock bindings)
cargo:   domain entities, subtitle/ass builder, golden_frames (§2.4c)
CI (GitHub Actions):  tsc --noEmit → eslint (luật import §2.2) → vitest
                      → cargo check → cargo test  (matrix macOS trước)
```
Scripts thêm vào `package.json`: `test`, `test:ui`, `lint`, `typecheck`, `contract:gen`.

### 4.5 ADR — bắt đầu ghi quyết định

Tạo `docs/adr/`: `0001-studio-workspace-thay-wizard`, `0002-tauri-specta-cho-ipc`, `0003-contract-json-codegen-parity`, `0004-plugin-3-cap`, `0005-template-as-composition-data`. Mỗi file 15 dòng (context/decision/consequences) — đủ để 6 tháng sau không tranh luận lại.

---

## PHẦN V — LỘ TRÌNH KỸ THUẬT (khớp 4 phase của UI_REBUILD_PLAN)

Chiến lược **strangler**: hạ tầng mới mọc dưới UI cũ trước, feature port sang sau, không có big-bang.

### Phase 1 — Nền móng (song song với Shell UI)
| # | Việc | Diệt |
|---|---|---|
| 1 | `ui/tokens.css` + primitives; ESLint luật import | F5 |
| 2 | tauri-specta: annotate commands + entities → `bindings.gen.ts`; `core/ipc/{client,events}`; bootstrap attach events 1 lần | F2, F3 |
| 3 | Tách store thành slices (giữ nguyên field names → Step components cũ chạy tiếp qua re-export tạm `useAppStore`) | F1 (nửa) |
| 4 | `AudioEngine` + `playback.slice`; transport bar dùng ngay | F7 |
| 5 | `contract/` codegen cho constants + zones; xoá bản chép tay 2 phía | F6 (a) |

### Phase 2 — Domain & extensions (song song Design mode)
| 6 | Chuyển `splitSegments` → `domain/segments`; viết vitest đầu tiên | F4 |
| 7 | `extensions/kernel.ts`; di trú waves → wavePoint; templates/palettes/presets thành extension data | — |
| 8 | `RenderEvent` enum phía Rust + `render.slice`; `cancel_render` | F3, §4.2 |
| 9 | `SessionRepository` + migrations + recents | — |

### Phase 3 — Port features + parity guard (song song Captions/Export UI)
| 10 | `CompositionSpec` refactor 2 phía (khi port WaveformCanvas & frame.rs) | §3.3 |
| 11 | Golden-frame tests + CI pipeline | F6 (c), F8 |
| 12 | Xoá Step components + re-export tạm; ESLint bật full luật | F1 (xong) |

### Phase 4 — Mở rộng
| 13 | Load extension Cấp 1 từ app_data_dir + Settings "Extensions" | §3.4 |
| 14 | Undo/redo temporal middleware 2 scope | §2.5 |
| 15 | ADR backfill + cập nhật CLAUDE.md theo kiến trúc mới | — |

### Rủi ro kỹ thuật & đối sách

| Rủi ro | Đối sách |
|---|---|
| tauri-specta chưa cover kiểu nào đó (Vec<f32> lớn, enum lạ) | Spike 1 buổi ở đầu Phase 1 với 2 command khó nhất (`render_audiogram`, `analyze_spectrum`); nếu kẹt → viết bindings tay trong `core/ipc` (facade không đổi, chỉ mất codegen) |
| Golden-frame flaky vì font rendering khác môi trường | So sánh SSIM có ngưỡng thay vì hash tuyệt đối; frame test không chứa text (tách text-layout test riêng phía Rust) |
| CompositionSpec không biểu đạt hết 6 template hiện có | Cho phép `composition.custom: string` escape-hatch trỏ về draw fn built-in trong giai đoạn chuyển tiếp; xoá khi đủ spec |
| Store refactor phá UI cũ giữa chừng | Re-export `useAppStore` giữ nguyên shape phẳng (proxy vào slices) đến hết Phase 3 |
```
