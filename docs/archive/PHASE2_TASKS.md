# Phase 2 — Task plan chi tiết (giao cho Sonnet thực thi)
*Ngày lập: 27/07/2026 · Nguồn: `UI_REBUILD_PLAN.md` P2 (mục 8–13) + `UI_DESIGN_SPEC.md` §2, §4, §6 + `TECH_ARCHITECTURE.md` Phần V P2 (mục 6, 7, 9) + `PACKAGE_SPLIT_PLAN.md` đợt 2*
*Điều kiện vào: Phase 1 đã đóng (T1–T18, commit `0c855c8`).*

---

## A. LUẬT CHUNG cho mọi task (executor PHẢI đọc trước khi làm bất kỳ task nào)

1. **Một task = một commit** (hoặc chuỗi commit nhỏ cùng prefix). Message: `p2-t<số>: <mô tả ngắn>`.
2. **Sau MỖI task chạy đủ 4 lệnh nghiệm thu chung** (ngoài nghiệm thu riêng của task), chạy từ `apps/desktop` trừ khi ghi khác:
   ```bash
   npm run typecheck                  # tsc --noEmit
   npm run lint                       # 0 error
   npm run test                       # vitest, xanh
   npm run tauri dev                  # mở app, import 1 file audio, preview chạy, play/pause chạy
   ```
3. **CẤM tuyệt đối:**
   - Sửa bất kỳ hằng số / hình học render nào: `WAVE_BARS`, `BAR_FILL`, `GAP_FILL`, `EQ_BANDS`, `EQ_BPS`, `WAVE_BPS`, `BG_DARK_TOP/BOTTOM`, `DEFAULT_ZONES`, toàn bộ số học trong 6 hàm `draw*` của `WaveformCanvas.tsx` và trong `crates/audiogram-render`. Task T2 **di chuyển** các hàm này — di chuyển = copy nguyên văn, không đổi một con số nào. Nguồn duy nhất của hằng số là `contract/*.json` (P1-T14).
   - Đụng vào Rust / `src-tauri/src/**` / `crates/**`. Phase 2 là **frontend + config only** (UI_REBUILD_PLAN §6). Ngoại lệ duy nhất được phép: thêm plugin + permission trong `tauri.conf.json` / `capabilities/default.json` ở T4 (không có logic Rust nào được viết).
   - Sửa logic 2 component cũ còn sống sau Phase 2 (`StepTranscript`, `StepExport`) — chúng bị thay ở Phase 3. Phase 2 chỉ được **giữ chúng chạy** (xem luật 5).
   - Thêm dependency ngoài danh sách ghi trong từng task.
4. **Khi kẹt >30 phút** ở một quyết định không có trong spec: dừng, ghi `// TODO(p2-tX): <câu hỏi>` + báo lại trong kết quả, KHÔNG tự phát minh giải pháp khác hướng tài liệu.
5. **`WaveformCanvas.tsx` phải giữ default export tương thích đến hết Phase 3.** 4 component cũ (`StepLayout`, `StepTranscript`, `StepExport`, `StepCustomize`) đang import nó với props hiện tại. T2 biến nó thành adapter mỏng gọi renderer mới; props và hành vi nhìn từ ngoài KHÔNG đổi (trừ watermark — xem T2).
6. Code + comment tiếng Anh. UI string tiếng Anh (UI_REBUILD_PLAN §1.8). Tài liệu tham chiếu: `UI_DESIGN_SPEC.md` (§ được trỏ trong từng task), `TECH_ARCHITECTURE.md`, `PACKAGE_SPLIT_PLAN.md`.
7. Đường dẫn viết tắt trong tài liệu này đều tính từ `apps/desktop/` (VD `src/features/design/...`), trừ khi ghi `packages/` hoặc `contract/` (root).

**Thứ tự bắt buộc & phụ thuộc:**

```
T1 (extension kernel + registries) ─┬─► T6 (design panel galleries)
                                    └─► T8 (inspector: palettes)
T2 (renderer thuần + PreviewCanvas) ─┬─► T3 (thumbnailer) ─► T6
                                     ├─► T7 (canvas stage)
                                     └─► T10 (playback ↔ preview)
T4 (SessionRepository + recents) ───► T5 (StartScreen) ─┐
T6, T7, T8 ────────────────────────► T9 (ghép Design mode) ◄┘
T9 ─► T10 (transport/preview sync + shortcut mở rộng)
T11 (@audiogram/segments) — độc lập, chạy song song bất kỳ lúc nào
tất cả ─► T12 (dọn dẹp + nghiệm thu phase)
```

Milestones: **M1** = T1–T3 (nền renderer + registry, chưa nhìn thấy gì) · **M2** = T4–T5 (START thật) · **M3** = T6–T9 (Design mode thật) · **M4** = T10–T12 (khớp nối + dọn).

**Ngân sách:** ~10–12 ngày Sonnet. *(UI_REBUILD_PLAN ước "3–4 ngày" cho Phase 2 — con số đó viết trước khi có kiến trúc T-A; Phase 1 ước 2–3 ngày và thực tế tốn 14–16 ngày. Ước lượng dưới đây là bản hiệu chỉnh, không phải scope creep: phạm vi tính năng vẫn đúng mục 8–13.)*

**Quyết định đã chốt trước khi bắt tay (không mở lại):**

| Câu hỏi | Quyết định | Lý do |
|---|---|---|
| `selectedEl` để đâu? | `ui.slice` (không persist) | Spec §4.3 nói "state cục bộ studio" nhưng canvas (T7), inspector (T8) và gallery (T6) là 3 component anh em — đi qua store là cách duy nhất không vi phạm luật "features không import chéo" (TECH_ARCHITECTURE §2.2) |
| Ratio `4:5` (UI_REBUILD_PLAN mục 13) | **KHÔNG làm** ở Phase 2 | `CANVAS_SIZES` chỉ có 3 ratio; thêm ratio = đụng contract + Rust geometry = vi phạm luật A.3. UI_DESIGN_SPEC §4.2 (bản chi tiết hơn, ra sau) chỉ liệt kê 3. Ghi backlog Phase 4. |
| `features/preview` bị luật "no cross-feature import" chặn | Nới luật: `preview` là **shared leaf feature** — mọi feature được import nó, nó không import feature nào | Sửa trong T2, kèm comment lý do trong `eslint.config.js` |
| Session persistence đầy đủ (UI_REBUILD_PLAN mục 22, Phase 4) | Phase 2 làm **hạ tầng + recents**; auto-restore project lúc mở app để Phase 4 | START screen (mục 8) cần recents ngay, viết `SessionRepository` 2 lần thì phí |
| Thêm `@tauri-apps/plugin-fs` | Được, thay vì viết command Rust mới | Giữ đúng "Phase 2 không đụng Rust"; scope permission chỉ `$APPDATA` |

---

## T1 — Extension kernel + registries built-in (1 ngày)

**Tham chiếu:** TECH_ARCHITECTURE §3.1–3.2 (Cấp 0), §2.2 (cây `extensions/`).
**Mục tiêu:** mọi danh mục "có thể thêm item" (wave / template / palette) đi qua một cơ chế; gallery ở T6 và swatch row ở T8 đọc từ registry chứ không từ mảng hard-code rải rác.

**Các bước:**
1. `src/extensions/kernel.ts` — đúng API TECH_ARCHITECTURE §3.2, ~100 dòng: `ExtensionManifest`, `class ExtensionPoint<T>` với `register/get/list/onChange`, throw khi trùng `id`. `list()` ổn định: builtin trước, giữ thứ tự đăng ký (KHÔNG sort theo label — thứ tự template/wave hiện tại là thứ tự sản phẩm).
2. `src/extensions/templates/index.ts` — 6 `TemplateExtension` sinh từ `LAYOUT_TEMPLATES` + `DEFAULT_ZONES` hiện có. **Không viết lại data**: import từ `types.ts` / `@audiogram/contract` và bọc thành extension (`manifest`, `zones`, `defaults`, `needsAvatar`, `tags`). Trường `composition` trong TECH_ARCHITECTURE §3.2 **CHƯA làm** (Phase 3, cùng CompositionSpec) — ghi `// TODO(p3): composition spec`.
3. `src/extensions/waves/index.ts` — bọc `WAVE_EFFECTS` từ `@audiogram/wave-effects` thành `WaveExtension` (`draw` trỏ thẳng vào effect, `rustId = id`). KHÔNG move code effect vào đây (chúng đã ở package từ P1-T17).
4. `src/extensions/palettes/index.ts` — 4 palette: `wave` (`WAVE_COLORS`), `bg` (`BG_COLORS`), `subtitle`, `karaoke`. Hai palette sau **di chuyển** `SUBTITLE_COLORS`/`KARAOKE_COLORS` đang nằm trong `StepTranscript.tsx:46,51` — copy giá trị nguyên văn, rồi sửa StepTranscript import từ palette (đây là ngoại lệ duy nhất được phép chạm StepTranscript, chỉ là đổi nguồn hằng số, không đổi logic).
5. `src/extensions/index.ts` — `registerBuiltins()` gọi 1 lần trong bootstrap `main.tsx` (idempotent: gọi 2 lần không throw — dev HMR).
6. Test `src/extensions/__tests__/kernel.test.ts`: register trùng id → throw; `list()` giữ thứ tự; `onChange` bắn khi register; và **test dữ liệu**: `templatePoint.list()` có đúng 6 id khớp `LAYOUT_TEMPLATES`, `wavePoint.list()` đúng 9 id khớp `WAVE_STYLES`.

**Nghiệm thu:**
- [ ] 4 registry có dữ liệu đúng số lượng (6/9/4), test xanh
- [ ] `grep -rn "SUBTITLE_COLORS\|KARAOKE_COLORS" src` chỉ còn trong `extensions/palettes` + call site
- [ ] App chạy như cũ (registry chưa có UI đọc — task này thuần hạ tầng)
- [ ] Commit `p2-t1: extension kernel + builtin template/wave/palette registries`

---

## T2 — Tách renderer thuần khỏi `WaveformCanvas` + `PreviewCanvas` chạy trên AudioEngine (1.5 ngày)

**Tham chiếu:** TECH_ARCHITECTURE §2.6 (F7), §1.2 F7; UI_DESIGN_SPEC §4.2. **Đây là task xương sống của Phase 2** — T3, T7, T10 đều đứng trên nó.

**Vấn đề đang có (đã xác minh trong code):**
- `WaveformCanvas.tsx:503` tự `fetch + decodeAudioData` mỗi lần mount → decode trùng với `AudioEngine` (TODO(p1-t10) đã ghi sẵn ở đó).
- `WaveformCanvas.tsx:557` lấy thời gian từ timestamp rAF (`ts/1000`, `waveLoop: true`) → preview chạy vòng lặp riêng, **không khớp playhead**; transport (P1-T12) hiện không điều khiển được preview.
- `drawWatermark` (`WaveformCanvas.tsx:207`) vẽ chữ "audiogram" — **phía Rust không có watermark** (`grep -rn watermark crates src-tauri` = 0 hit). Đây là vi phạm parity preview↔export đang tồn tại, đồng thời UI_REBUILD_PLAN §1.3 yêu cầu bỏ. → **Xoá hàm + mọi call site.**

**Các bước:**
1. `src/domain/preview/renderer.ts` — **di chuyển nguyên văn** từ `WaveformCanvas.tsx`: `DC`, `getZ`, `wrapText`, `drawWaveform`, `drawAvatar`, `drawTitle`, `drawSubtitle`, `drawBg`, `drawSpotify`, `drawSplit`, `drawMinimal`, `drawFullBg`, `drawKaraoke`, `drawBrand`. Export duy nhất:
   ```ts
   export interface FrameSpec { /* mọi field của DC trừ ctx/W/H */ }
   export function drawFrame(ctx: CanvasRenderingContext2D, W: number, H: number, spec: FrameSpec): void
   ```
   `drawFrame` chứa đúng cái `switch (layoutTemplate)` hiện có. Đặt ở `domain/` (không `features/preview/`) vì file này zero React / zero Tauri → test được và là ứng viên `@audiogram/renderer` đợt 3 (PACKAGE_SPLIT_PLAN §3.2).
   **Bỏ `drawWatermark`** (lý do ở trên) — ghi comment 2 dòng giải thích để người sau không tưởng là sót.
2. `src/features/preview/PreviewCanvas.tsx` — component mới, React wrapper mỏng:
   - Props: `{ width?: number; ratio: number; className?: string }`. Mọi thứ khác **đọc thẳng từ store** (design slice + captions slice + playback slice) — đây là component của app, không phải primitive.
   - Ảnh cover: `convertFileSrc` + cache `HTMLImageElement` theo path (di chuyển từ `WaveformCanvas.tsx:530`).
   - FFT: gọi `ipc.analyzeSpectrum(audioPath)` (KHÔNG `invoke` trực tiếp — luật §2.3), cache theo path trong module-level Map. Bỏ hoàn toàn khỏi vòng đời component (không refetch khi remount).
   - Đồng hồ: `audioEngine.onFrame(t => ...)` là nguồn `waveTime`. Khi `duration > 0`: `waveTime = t`, `waveLoop = false`. Khi chưa có audio: giữ hành vi demo cũ (`performance.now()/1000`, `waveDur = 30`, `waveLoop = true`) để preview vẫn động trên file rỗng.
   - Không tự decode nữa: `peaks`/`duration` đọc từ `playback` slice (AudioEngine đã ghi vào đó qua `bootstrap.ts`).
3. `src/components/WaveformCanvas.tsx` → **adapter mỏng** (giữ default export, giữ nguyên props signature — luật A.5): map props → `drawFrame` qua cùng vòng rAF cũ, `onPeaksReady` vẫn gọi (đọc peaks từ store, gọi 1 lần khi peaks đổi). Sau task này file chỉ còn ~80 dòng, không còn decode/FFT/draw function nào.
4. `eslint.config.js`: nới zone cross-feature — `preview` được mọi feature import (`from: FEATURES.filter(x => x !== f && x !== 'preview')`), kèm comment lý do.
5. Test `src/domain/preview/__tests__/renderer.test.ts` (jsdom + `canvas.getContext('2d')` giả lập bằng mock ghi lại lệnh vẽ — cùng kiểu mock đã dùng ở `packages/wave-effects/src/effects.test.ts`, KHÔNG thêm node-canvas): với mỗi trong 6 template, `drawFrame` không throw và có gọi ≥1 lệnh vẽ; assert **không có** `fillText('audiogram', …)`.

**Nghiệm thu:**
- [ ] `npm run tauri dev`: preview trong Design (StepLayout cũ) trông **giống hệt** trước task, trừ watermark đã biến mất
- [ ] Bấm play ở transport → sóng trong preview chạy **theo playhead**, pause thì đứng, seek thì nhảy đúng chỗ
- [ ] Import file thứ 2 rồi quay lại file 1 → không decode lại (log/devtools: chỉ 1 `decodeAudioData` mỗi path)
- [ ] `grep -n "decodeAudioData\|invoke(" src/components/WaveformCanvas.tsx` = 0 hit
- [ ] StepTranscript + StepExport vẫn render preview bình thường (luật A.5)
- [ ] Commit `p2-t2: pure frame renderer + PreviewCanvas on AudioEngine`

---

## T3 — Thumbnailer: ảnh template thật + mini preview wave style (¾ ngày)

**Tham chiếu:** UI_DESIGN_SPEC §4.1 (card anatomy); UI_REBUILD_PLAN mục 9–10 (giải quyết finding A).

**Các bước:**
1. `src/features/preview/thumbnailer.ts`:
   - `renderTemplateThumb(templateId, opts?): string` — offscreen `<canvas>` 320×180 (2× của 160×90 cho màn Retina), gọi `drawFrame` với: peaks giả **cố định, deterministic** (sinh bằng hàm sin như nhánh fallback `envelope.ts:fallbackEnvelope` — dùng lại, không viết mới), màu default của chính template, `title: 'Your episode title'`, `waveTime` cố định (VD `waveDur * 0.33`), `coverImg: null`. Trả `canvas.toDataURL('image/png')`.
   - Cache module-level `Map<string, string>` khoá `${templateId}` — render 1 lần cho mỗi template, không phụ thuộc audio (spec §4.1: "render 1 lần sau khi app mount, không chờ audio").
   - `renderProjectThumb(): string | null` — chụp preview hiện tại 160×90 cho recents (T4 dùng): dùng state thật trong store, peaks thật nếu có.
2. `src/features/preview/WaveMiniPreview.tsx` — canvas 216×88 (2× của 108×44) vẽ **chỉ waveform** của 1 style (gọi thẳng `wavePoint.get(id).draw` với rect full canvas, `heights` từ `waveHeights` trên peaks giả). Một **rAF loop dùng chung cho tất cả instance** (module-level scheduler: instance đăng ký/hủy đăng ký; loop dừng khi không còn ai, khi `document.hidden`, hoặc khi window blur — spec §4.1).
3. Test: `renderTemplateThumb` gọi 2 lần cho cùng id → cùng chuỗi (cache hit, so bằng `===` reference); 6 template đều trả chuỗi bắt đầu `data:image/png`.

**Nghiệm thu:**
- [ ] Thêm tạm vào `?gallery=1` (gallery từ P1-T4) một khu vực hiện 6 thumbnail + 9 mini preview → nhìn mắt: thumbnail nhận ra được layout, mini preview chạy mượt
- [ ] DevTools Performance: 9 mini canvas chạy chung 1 rAF, CPU idle < 5% khi window blur
- [ ] Commit `p2-t3: template thumbnailer + wave style mini previews`

---

## T4 — `SessionRepository` + recents + migrations (1 ngày)

**Tham chiếu:** TECH_ARCHITECTURE §2.2 (`core/persistence/`), §2.5 (schema + partialize + recents).
**Dep mới:** `@tauri-apps/plugin-fs` (JS) + `tauri-plugin-fs` (Rust dep trong `Cargo.toml` + `.plugin(tauri_plugin_fs::init())` — **đây là ngoại lệ Rust duy nhất của Phase 2, chỉ 2 dòng wiring, không viết logic**).

**Các bước:**
1. `capabilities/default.json`: thêm `"fs:default"`, `"fs:allow-appdata-read-recursive"`, `"fs:allow-appdata-write-recursive"`. KHÔNG mở scope nào ngoài `$APPDATA` (recents chỉ lưu *đường dẫn* audio, không đọc file audio bằng fs plugin — kiểm tra tồn tại dùng `exists` với `baseDir` mặc định của path đó; nếu quyền không cho, fallback: coi như file còn sống và để lỗi nổi lên lúc decode — ghi TODO, KHÔNG mở scope toàn ổ đĩa).
2. `src/core/persistence/migrations.ts`: `type SessionFile = { version: 1; savedAt: string; project; design; captions }`; `migrate(raw: unknown): SessionFile | null` chạy tuần tự v1→vN (hôm nay chỉ có v1: validate shape, trả `null` nếu hỏng — **không throw**, file hỏng không được làm chết app).
3. `src/core/persistence/SessionRepository.ts` (không import store — nhận state qua tham số, giống `AudioEngine`):
   - `save(session: SessionFile)` / `load(): Promise<SessionFile | null>` → `$APPDATA/session.json`
   - `listRecents() / pushRecent(entry) / removeRecent(audioPath)` → `$APPDATA/recents.json`, tối đa 8 entry, khoá theo `audioPath`, mới nhất lên đầu. Entry: `{ audioPath, audioName, title, duration, thumbnailPng, savedAt }` (`thumbnailPng` = dataURL từ T3).
   - Mọi thao tác ghi đi qua 1 hàng đợi tuần tự (không ghi chồng), lỗi ghi → `console.warn`, không throw lên UI.
4. `src/core/persistence/attach.ts` — seam nối store (giống `core/audio/bootstrap.ts`): subscribe store, **debounce 800ms**, `partialize` = project + design + captions (KHÔNG playback/render/ui), ghi `session.json`. Gọi từ bootstrap `main.tsx`.
5. `pushRecent` được gọi khi `audioPath` đổi sang giá trị khác rỗng (trong cùng `attach.ts`); `thumbnailPng` lấy từ `thumbnailer.renderProjectThumb()` — nhưng **chỉ chụp lại sau debounce**, không chụp mỗi keystroke.
6. **Auto-restore CHƯA bật** ở Phase 2 (mở app vẫn vào START). Ghi `// TODO(p4): restore last session on launch` tại chỗ gọi `load()`.
7. Test: `migrations.test.ts` (raw hỏng → null; v1 hợp lệ → pass-through); `SessionRepository.test.ts` với fs plugin mock (`vi.mock('@tauri-apps/plugin-fs')`): recents giữ tối đa 8, dedupe theo path, mới nhất đầu tiên.

**Nghiệm thu:**
- [ ] Import audio, đổi template, đợi 1s → `$APPDATA/audiogram/session.json` tồn tại, nội dung khớp state (mở file xem tay)
- [ ] Import 9 file khác nhau → `recents.json` chỉ giữ 8, đúng thứ tự
- [ ] Xoá tay 2 file json → app mở lại bình thường, không lỗi
- [ ] Commit `p2-t4: SessionRepository, recents + session schema migrations`

---

## T5 — START screen thật (1 ngày)

**Tham chiếu:** UI_DESIGN_SPEC §2 (toàn bộ). Thay `features/start/StartScreen.tsx` tạm của P1-T11.

**Các bước:**
1. `features/start/StartScreen.tsx` — layout §2.1: drag strip 48px (`data-tauri-drag-region`) + logo text "≈ Audiogram" 13px `text-2` căn giữa; nội dung căn giữa; recents phía dưới.
2. `features/start/DropZone.tsx` — bảng §2.2 làm đủ 5 dòng: kích thước/radius/border dashed, hover, **drag-over** (border solid accent, bg accent-soft, icon scale 1.08/120ms, text đổi "Release to import"), file sai định dạng → shake 300ms + `toast.show` (Toast từ P1-T5) đúng câu trong spec. Toàn zone là 1 click target duy nhất; nút `Open Audio… ⌘O` bên trong zone gọi cùng `actions.openAudio()`.
   - Drag & drop: dùng sự kiện drag-drop của Tauri v2 (`getCurrentWebview().onDragDropEvent`) — **bọc trong `core/` chứ không gọi thẳng trong component**: thêm `src/core/ipc/dragDrop.ts` export `onFileDrop(cb): Unsub` (giữ luật "component không import `@tauri-apps/api` trực tiếp").
   - Validate đuôi file bằng đúng danh sách đang có: `['mp3','wav','m4a','flac','aac','ogg']` (`app/actions.ts:16`). Đặt danh sách này thành `AUDIO_EXTENSIONS` trong `domain/` và cho cả `actions.openAudio` dùng chung.
3. Sau khi chọn/thả file hợp lệ: set `audioPath/audioName/title` (auto-title như `actions.openAudio` hiện tại) + `screen:'studio'`, `mode:'design'` **trong cùng một `set()`** — và **xoá effect cầu tạm ở `App.tsx:24`** (nó là seam của P1-T11, hết vai trò).
4. `features/start/RecentGrid.tsx` — §2.3: chỉ hiện khi có ≥1 entry; grid `auto-fill minmax(160px,1fr)` gap 16; card thumbnail 160×90 + hover border accent + overlay ▶; tên + "`{relative time}` · `{duration}`". Hàm `formatRelativeTime` vào `domain/format.ts` (thuần, có test: <1 phút / giờ / ngày / >7 ngày).
   - Context menu chuột phải (ContextMenu từ P1-T5): `Open` / `Reveal Audio in Finder` (`ipc.openFolder`) / `Remove from Recents`.
   - File không còn tồn tại (`exists` từ T4): thumbnail opacity 40% + badge "File missing"; click → dialog §8.4 **rút gọn cho Phase 2**: Modal 2 nút `Locate…` (mở file dialog, chọn xong thì cập nhật `audioPath` của entry + mở project) / `Remove from Recents`.
5. Mở project từ recents = set project fields từ entry + `screen:'studio'`. (Khôi phục **đầy đủ** design/captions của session là Phase 4 — Phase 2 chỉ mở lại audio + title; ghi TODO.)

**Nghiệm thu:**
- [ ] Mở app lần đầu (xoá recents.json): thấy đúng drop zone §2.1, không có recents
- [ ] Kéo file .mp3 từ Finder thả vào cửa sổ: drag-over đổi màu, thả xong vào thẳng Studio Design (không có bước xác nhận)
- [ ] Kéo file .txt: shake + toast đúng câu, không đổi state
- [ ] Import 3 file → quay lại START (`New Project` trong toolbar) → 3 card recents có thumbnail thật, meta đúng; chuột phải đủ 3 item; rename file trên đĩa → card hiện "File missing"
- [ ] `grep -rn "StepUpload" src` = 0 hit (T12 sẽ xoá file; task này bỏ import)
- [ ] Commit `p2-t5: real START screen with drop zone + recents`

---

## T6 — Design mode LEFT PANEL: template & wave galleries (1 ngày)

**Tham chiếu:** UI_DESIGN_SPEC §4.1 (làm đúng số px trong đó).

**Các bước:**
1. `features/design/DesignPanel.tsx` — cột dọc pad 16, gap 24, 2 cụm; label 11px uppercase `text-3`.
2. Cụm TEMPLATE: grid 2 cột gap 8, 6 card từ `templatePoint.list()`; thumbnail từ `renderTemplateThumb` (T3); tên 12px w600 + tags ratio 9px; states default/hover/selected (border 1.5px accent + check ✓ 14px) đúng spec.
   - Click → `applyTemplate(id)` (đã có sẵn trong `design.slice`, P1-T7 — **không viết lại logic**) + `set({ selectedEl: null })`.
   - Nếu `zones !== null` **hoặc** `waveColor/bgColor` khác default của template đang chọn → Popover confirm inline "Switching template resets layout & colors. [Switch] [Cancel]" (spec §4.1). Không confirm trong trường hợp còn lại.
3. Cụm WAVE STYLE: grid 2 cột gap 8, 9 card từ `wavePoint.list()`, mỗi card 1 `WaveMiniPreview` (T3) + label 11px; click → `set({ waveStyle: id })`. States như template card.
4. Panel chỉ chạy animation khi `mode === 'design'` và window visible (T3 scheduler lo phần dừng; DesignPanel unmount khi đổi mode là đủ).

**Nghiệm thu:**
- [ ] 6 thumbnail template render đúng layout tương ứng, đổi template thấy canvas đổi ngay
- [ ] 9 mini preview chạy, chọn style nào canvas đổi style đó, `eq` chạy simulation kể cả khi chưa có FFT
- [ ] Kéo 1 zone rồi đổi template → hiện confirm; bấm Cancel → giữ nguyên
- [ ] Commit `p2-t6: design panel — template + wave style galleries`

---

## T7 — Design mode CANVAS STAGE (1.5 ngày)

**Tham chiếu:** UI_DESIGN_SPEC §4.2. Port phần preview + Rnd zones từ `StepLayout.tsx:195–350`.

**Các bước:**
1. `features/design/CanvasStage.tsx`: pit `bg-pit`, canvas căn giữa, margin 32px mọi phía, `aspectRatio` theo `CANVAS_SIZES[canvasSize]`, shadow `0 16px 56px rgba(0,0,0,.55)`, radius 8; scale theo cửa sổ (ResizeObserver — di chuyển từ `StepLayout.tsx:65`). Bên trong là `PreviewCanvas` (T2).
2. Zone overlays — **di chuyển** logic Rnd hiện có (fraction 0–1, `updateZone`, `EL_META`, clamp) rồi nâng cấp theo spec:
   - Idle: border 1px dashed `rgba(255,255,255,.07)` (fix hidden interaction — DESIGN_REVIEW §B). Hover: dashed màu element + label tag. Selected: solid 2px + 8 handle Rnd + label tag.
   - Chọn zone ⇄ `ui.selectedEl` (2 chiều với inspector T8).
   - Khi kéo: guide line căn giữa canvas (dọc + ngang, 1px accent 50%) + **snap ±8px**. Toán snap/clamp vào `src/domain/zones.ts` (thuần, có test: snap trong ngưỡng, không snap ngoài ngưỡng, clamp trong [0,1−w]).
   - `Esc` = bỏ chọn (đăng ký ở `shortcuts.ts` hay local? → local trong CanvasStage, vì Esc còn đóng modal; ưu tiên modal xử lý trước — kiểm tra bằng tay).
3. Inline title edit: di chuyển nguyên pattern `StepLayout.tsx:317–350` (contentEditable, Enter/Esc/blur commit).
4. Stage footer 36px trong pit: trái = `SegmentedControl` ratio 3 item (`16:9 · 1:1 · 9:16` → `canvasSize`) với tooltip từ `CANVAS_SIZES[..].label`; phải = nút ⛶ fullscreen preview (overlay đen, Esc thoát; ẩn zone overlay khi fullscreen) + nút ghost "Reset layout" **chỉ khi `zones !== null`** → confirm popover → `set({ zones: null })`. Zoom slider: **chừa chỗ, không làm** (spec ghi v1.1) — comment TODO.
5. First-run hint (spec §4.2): **KHÔNG làm ở Phase 2** (cần flag trong session, thuộc Phase 4 polish) — ghi TODO ở đúng chỗ.

**Nghiệm thu:**
- [ ] Kéo/resize từng zone (wave/title/subtitle/avatar tuỳ template) → preview đổi ngay, thả ra rồi đổi ratio → tỉ lệ zone giữ đúng (fraction)
- [ ] Kéo gần tâm → guide line hiện + snap dính; kéo ra ngoài biên → bị clamp
- [ ] Idle nhìn thấy viền dashed mờ của mọi zone; click title 2 lần → sửa chữ inline, Enter commit
- [ ] Đổi 3 ratio → canvas fit đúng pit ở cả cửa sổ 1000px và 1600px, không tràn, không scroll trang
- [ ] Fullscreen ⛶ rồi Esc thoát; "Reset layout" chỉ hiện sau khi đã kéo
- [ ] Commit `p2-t7: canvas stage — pit, zone overlays, ratio switcher, fullscreen`

---

## T8 — Design mode INSPECTOR (1 ngày)

**Tham chiếu:** UI_DESIGN_SPEC §4.3.0–4.3.5 (bảng bind từng cụm — làm đúng, không thêm control ngoài bảng).

**Các bước:**
1. `ui.slice`: thêm `selectedEl: 'wave'|'title'|'subtitle'|'avatar'|null` + action `selectEl`. Không persist (đã loại trong partialize T4).
2. `features/design/DesignInspector.tsx` — header 40px (chấm màu `EL_META` + tên + nút `×` deselect khi có selection), rồi switch theo `selectedEl`:
   - `null` → Canvas: BACKGROUND (SwatchRow từ palette `bg` + custom well) · COVER IMAGE (chỉ khi `template.needsAvatar`; image well 248×80, empty/filled + Replace/Remove) · TITLE TEXT (Input, đồng bộ 2 chiều với inline edit T7)
   - `wave` → STYLE (Select 9 style từ `wavePoint`) · COLOR (SwatchRow palette `wave`) · POSITION (4 ô số X/Y/W/H % **read-only**)
   - `title` → TEXT · COLOR · FONT (Select 4 font, item render bằng chính font đó) · SIZE (Slider 70–140 step 5, label "%") · FORMAT (align 3 nút + B/I, icon button 32×28 nhóm liền). Tooltip trên FONT/SIZE: "Also applies to captions".
   - `subtitle` → COLOR (palette `subtitle`) · KARAOKE (Toggle + khi bật hiện SwatchRow palette `karaoke`) · hint 11px "Edit caption text in Captions mode →" (click = `actions.setModeCaptions()`). Toggle disabled khi `segments.length === 0`, `disabledReason="Transcribe audio first (Captions mode)"`.
   - `avatar` → IMAGE (image well dùng chung với Canvas) · POSITION read-only
3. Dùng **duy nhất** primitives từ `src/ui` (P1-T4/T5). Không inline hex, không `<select>` native, không viết swatch mới — nếu thiếu variant thì báo theo luật A.4, KHÔNG tự thêm primitive mới.
4. `pickCoverImage` (`StepLayout.tsx:101`) di chuyển vào `features/design/useCoverImage.ts` (dùng `plugin-dialog` — được phép, không phải `@tauri-apps/api/core`).
5. **FPS rời khỏi inspector** (spec §4.3.1 note): không render control fps ở đâu trong Design. `fps` vẫn nằm trong store, StepExport cũ vẫn chỉnh được → không mất tính năng.

**Nghiệm thu:**
- [ ] Click từng zone trên canvas → inspector đổi section tương ứng; nút `×` bỏ chọn về Canvas
- [ ] Mọi control trong 5 bảng §4.3 đổi được và thấy hiệu lực ngay trên preview
- [ ] Karaoke toggle khi chưa transcribe: disabled + tooltip đúng câu
- [ ] `grep -rn "#[0-9A-Fa-f]\{6\}" src/features/design` chỉ còn hit trong data màu (nếu có) — không có màu UI hard-code
- [ ] Commit `p2-t8: design inspector (canvas/wave/title/subtitle/avatar)`

---

## T9 — Ghép Design mode vào StudioLayout 3 pane + toolbar recents (¾ ngày)

**Các bước:**
1. `StudioLayout.tsx`: đổi từ grid 2 cột (P1 tạm) sang **3 cột đúng spec §1.2** — `280px | 1fr | 280px`, inspector co còn 240px khi window < 1080 (ResizeObserver có sẵn trong file). Transport giữ nguyên hàng 3.
2. `App.tsx`: `mode==='design'` → `leftPanel={<DesignPanel/>}`, giữa `<CanvasStage/>`, phải `<DesignInspector/>`. `mode==='captions'` → tạm giữ `StepTranscript` chiếm cả vùng canvas+inspector như Phase 1 (Phase 3 thay). `step==='export'` → giữ `StepExport` như Phase 1.
3. Fade-slide 150ms khi đổi mode: giữ wrapper `key={mode}` hiện có; kiểm tra nó **không** làm remount `PreviewCanvas` gây giật (nếu có: nâng key lên chỉ bọc panel trái/phải, canvas nằm ngoài animation).
4. Toolbar (`features/studio/Toolbar.tsx`) — bật 2 item đang disabled "Coming in Phase 2" nay đã có hạ tầng T4:
   - `Open Recent ▸` → submenu 8 entry từ `listRecents()`
   - `Replace Audio…` → mở dialog + confirm §8.2 ("Replace audio? Layout and captions are kept." / captions sẽ lệch thời gian → cảnh báo 1 dòng nếu `segments.length > 0`), giữ toàn bộ design/captions state, chỉ đổi `audioPath/audioName`
5. `New Project` hiện có: bổ sung set `screen:'start'` sau khi reset (P1 quên → reset xong vẫn ở studio).

**Nghiệm thu:**
- [ ] Studio hiện đúng 3 pane, kéo cửa sổ 1000↔1600px: inspector co/giãn đúng ngưỡng, canvas không vỡ, **không có scroll dọc trang** (chỉ nội dung panel scroll)
- [ ] Đổi Design ↔ Captions 10 lần: không leak rAF (DevTools Performance), preview không đen chớp
- [ ] Open Recent mở đúng file; Replace Audio giữ template/màu/segments
- [ ] Commit `p2-t9: 3-pane studio layout + design mode wiring + toolbar recents`

---

## T10 — Playback ↔ preview ↔ transport khớp hoàn toàn (½ ngày)

**Tham chiếu:** UI_DESIGN_SPEC §6 (phần chưa làm ở P1-T12, trừ segment blocks & now-playing chip = Phase 3).

**Các bước:**
1. Bổ sung phím theo bảng §6: `⇧←/→` = ∓1s, `Home` = về 0 (đăng ký trong `app/shortcuts.ts` + `actions.ts`, không viết listener mới).
2. Transport disabled + spinner khi `audioPath` có nhưng `duration === 0` (đang decode) — kiểm tra state này thật sự xuất hiện sau T2 (AudioEngine ghi duration sau decode).
3. Preview: khi phát tới cuối file, `<audio>` `ended` → `playing:false`, playhead đứng ở cuối (không tự về 0 — hành vi editor).
4. Kiểm tra chéo hiệu năng: preview + mini previews + transport playhead cùng chạy → 60fps trên file 30 phút (đo bằng DevTools; nếu tụt <45fps, ghi TODO + báo, KHÔNG tối ưu tuỳ hứng).

**Nghiệm thu:**
- [ ] 5 phím transport (`Space`, `←/→`, `⇧←/→`, `Home`) đúng; gõ trong input không bị cướp phím
- [ ] Seek trên strip → sóng trong preview nhảy tức thì (cùng frame)
- [ ] Commit `p2-t10: transport/preview sync + extended playback shortcuts`

---

## T11 — Package `@audiogram/segments` (½ ngày, độc lập)

**Tham chiếu:** PACKAGE_SPLIT_PLAN §6 đợt 2; TECH_ARCHITECTURE Phần V P2 mục 6 (diệt F4).

**Các bước:**
1. `packages/segments/` — package.json như `@audiogram/wave-effects` (private, `0.0.0`, `exports: './src/index.ts'`), dep: `@audiogram/contract` nếu cần, **không** react/tauri (thêm test import-hygiene giống P1-T17).
2. **Di chuyển nguyên văn** `splitSegments` + `findSilence` từ `StepTranscript.tsx:14–43` sang `packages/segments/src/split.ts`; thêm `ops.ts`: `splitAt(seg, t)`, `mergeWithNext(list, i)`, `remove(list, i)` (Phase 3 context menu dùng). StepTranscript đổi sang import từ package (chỉ đổi import — luật A.3, không sửa logic khác).
3. Test: `split.test.ts` với fixture segment thật (3–4 câu, có khoảng lặng) — assert số segment sau split, biên thời gian không chồng lấn, tổng thời lượng không đổi; `ops.test.ts` cho 3 hàm mới.

**Nghiệm thu:**
- [ ] `npm test -w @audiogram/segments` xanh · flow transcribe + split trong app chạy y như trước
- [ ] Commit `p2-t11: @audiogram/segments package (split/findSilence/ops)`

---

## T12 — Dọn dẹp & nghiệm thu Phase 2 (½ ngày)

**Các bước:**
1. **Xoá file** đã hết vai trò: `src/components/StepUpload.tsx`, `src/components/StepLayout.tsx`, `src/components/StepCustomize.tsx` (dead code — không ai import, đã xác minh). Trước khi xoá: đối chiếu checklist tính năng của StepLayout (template, cover, bg, canvas size, fps, wave style/color, title format, zones, reset layout) → mỗi mục chỉ ra **chỗ ở mới** trong Design mode; **fps** ghi rõ là đã chuyển sang StepExport/Export sheet, không mất.
2. `types.ts`: `AppState`/`Step` — giữ (StepTranscript/StepExport còn dùng `step`), ghi TODO xoá ở Phase 3.
3. `eslint.config.js`: nâng rule cấm `@tauri-apps/api/core` từ `warn` → `error` **cho `src/features/**` và `src/domain/**`** (2 component cũ còn lại vẫn `warn` — bật full ở Phase 3 theo TECH_ARCHITECTURE Phần V mục 12).
4. **Parity audit** (bắt buộc, UI_REBUILD_PLAN mục 25): export 1 video **trước** khi bắt đầu Phase 2 (dùng commit `0c855c8`) và 1 video **sau** T11 với cùng input/settings → so sánh bằng mắt frame đầu/giữa/cuối. Khác biệt hợp lệ duy nhất: **không có** (watermark chỉ tồn tại ở preview, không ở export). Nếu lệch → dừng, báo cáo.
5. Cập nhật `CLAUDE.md`: mô tả cây frontend mới (features/design, features/preview, domain/preview, extensions, core/persistence) + ghi renderer thuần là `domain/preview/renderer.ts` (không còn `WaveformCanvas.tsx` là nguồn draw). Cập nhật bảng parity: trỏ tới `contract/constants.json` là nguồn duy nhất.
6. Tổng hợp mọi `TODO(p2-*)` + TODO đã ghi trong task thành mục "Input cho Phase 3" ở cuối file này (append, không sửa nội dung task).

**Nghiệm thu:**
- [ ] `npm run ci` (root) xanh từ máy sạch
- [ ] Flow đầy đủ: mở app → START → thả file → Design (đổi template/wave/màu/kéo zone) → Captions (StepTranscript cũ, transcribe) → Export MP4 → video đúng như trước Phase 2
- [ ] `grep -rn "StepUpload\|StepLayout\|StepCustomize" src` = 0 hit
- [ ] Commit `p2-t12: remove StepUpload/StepLayout/StepCustomize, phase 2 audit`

---

## B. Tổng ngân sách & cách giao việc

| Milestone | Tasks | Ước lượng |
|---|---|---|
| M1 nền renderer/registry | T1, T2, T3 | 3–3.5 ngày |
| M2 START | T4, T5 | 2 ngày |
| M3 Design mode | T6, T7, T8, T9 | 4–4.5 ngày |
| M4 khớp nối + dọn | T10, T11, T12 | 1.5 ngày |
| **Tổng Phase 2** | 12 tasks | **~10–12 ngày Sonnet** (T11 song song được bất kỳ lúc nào; T4 song song với T2/T3) |

**Prompt template giao từng task cho Sonnet:**

> Đọc `PHASE2_TASKS.md` mục A (luật chung) và task T\<n\> trong repo. Đọc thêm các mục được task trỏ tới trong `UI_DESIGN_SPEC.md` / `TECH_ARCHITECTURE.md` / `PACKAGE_SPLIT_PLAN.md`, và code hiện tại ở các file/dòng mà task chỉ đích danh. Thực hiện đúng phạm vi T\<n\>, không làm lố sang task khác. Chạy đủ nghiệm thu chung (mục A.2) + nghiệm thu riêng của task, báo cáo kết quả từng checkbox, liệt kê mọi TODO đã ghi. Nếu kẹt theo luật A.4 thì dừng và hỏi.

**Điều kiện đóng Phase 2 (review bởi model lớn hơn trước khi sang Phase 3):**
- [ ] 12 task commit đủ, `npm run ci` xanh
- [ ] START + Design mode chạy 100% theo UI_DESIGN_SPEC §2 và §4; không còn `StepUpload`/`StepLayout` trong repo
- [ ] Preview đọc **cùng một** envelope/đồng hồ với transport (một `decodeAudioData` cho mỗi file, playhead khớp sóng)
- [ ] Video export trước/sau Phase 2 giống hệt nhau
- [ ] Không component nào ngoài `core/` import `@tauri-apps/api/*`, trừ 2 Step component còn lại
- [ ] Danh sách TODO(p2-*) được tổng hợp thành input cho Phase 3

---

## C. Input cho Phase 3 (tổng hợp sau khi đóng Phase 2)

*Ghi lúc thực thi T12 — không sửa nội dung task ở trên, chỉ append.*

### Hoàn thành

12/12 task (T1–T11 + Đợt 0/Đợt 1 của OPTIMIZATION_PLAN.md làm trước Phase 2) đã commit. `npm run typecheck/lint/test -w audiogram`, `npm test` (root, cả 3 package), `cargo check --workspace`, `cargo test --workspace` (bao gồm golden-frame test) đều xanh tại thời điểm đóng.

### TODO còn lại trong code (grep `TODO` toàn bộ `apps/desktop/src` + `packages/`)

| Vị trí | Nội dung | Vì sao chưa làm |
|---|---|---|
| `extensions/kernel.ts:76` (`TODO(p3)`) | `TemplateExtension.composition: CompositionSpec` chưa có — `draw()` vẫn nằm trong `domain/preview/renderer.ts`'s per-layout match arm | Đợi CompositionSpec refactor (TECH_ARCHITECTURE §3.3), gắn với việc mổ `WaveformCanvas`/`frame.rs` một lần cho `@audiogram/renderer` (đợt 3, PACKAGE_SPLIT_PLAN §3.2) |
| `features/transport/TransportBar.tsx:164` (`TODO(p1-t12)`) | Segment blocks (dải 6px) + now-playing chip trên seek strip | Cần data Captions mode thật (segment list UI) — spec §6, việc của Phase 3 |

### Quyết định/đơn giản hoá đã áp dụng trong Phase 2 (Phase 3 nên biết)

- **Ratio 4:5** — chưa thêm (chỉ 3 ratio trong `CANVAS_SIZES`). Nếu Phase 3/4 cần, phải đụng `contract/` + geometry Rust, không chỉ frontend.
- **First-run hint** (canvas "Click any element to edit") — chưa làm, cần flag trong session.json (Phase 4 polish theo UI_REBUILD_PLAN §5 P4).
- **Auto-restore session lúc mở app** — `SessionRepository.loadSession()` tồn tại nhưng không có call site nào đọc nó vào store lúc bootstrap; Recents chỉ mở lại audio+title (`actions.openRecentEntry`), không khôi phục design/captions đầy đủ. Đây là Phase 4 (UI_REBUILD_PLAN §4.4).
- **Toolbar "Open Recent"** — làm dạng list mở rộng ngay trong dropdown (không phải flyout submenu hover ra bên cạnh như phác thảo ban đầu ở UI_DESIGN_SPEC §3.1). Hành vi "mở đúng file" đúng như spec; phần trực quan (submenu thật) có thể nâng cấp sau nếu cần.
- **Zoom slider** ở stage footer — cố tình bỏ qua (spec đánh dấu v1.1).
- **FPS control** — StepLayout.tsx bị xoá ở T12 lấy đi control fps duy nhất (StepExport trước đó chỉ hiển thị, không đổi được); đã bù bằng 1 hàng chọn 24/30/60fps ngay trong StepExport.tsx's summary card (tạm, tới khi Export Sheet thật ở Phase 3 thay thế toàn bộ StepExport).
- **60fps-under-load perf check** (T10 step 4) — không verify được, môi trường thực thi task này không có GUI/profiler.
- **Golden-frame test chỉ phủ 3/9 wave style** (bar/eq/orb) × 6 layout × 3 mốc thời gian — đủ để bảo vệ hình học layout + đường dẫn có state (eq), nhưng KHÔNG phủ 6 style còn lại (line/mirror/dot/neon/pulse/player). Nếu sửa các style đó, golden test sẽ không bắt được lệch — cân nhắc mở rộng khi có thời gian.
- **Chưa unify text rendering** (title/subtitle vẫn ffmpeg `drawtext`/libass, không phải Rust rasterize) — đây là OPTIMIZATION_PLAN.md "Đợt 2", dự định làm SAU Phase 2 và TRƯỚC Phase 3 nhưng chưa thực hiện trong phiên này. Vẫn còn nguyên rủi ro F1 (3 text engine khác nhau) nêu trong OPTIMIZATION_PLAN.

### Việc KHÔNG làm trong Phase 2 (đúng theo kế hoạch, nhắc lại cho Phase 3)

- `audiogram-cli` (F8, optional) — chưa làm, không nằm trong đường găng.
- Model download `curl→reqwest` (Đợt 0) và cancel/stage/ETA UI (Đợt 0) đã xong trước khi vào Phase 2 T1.
