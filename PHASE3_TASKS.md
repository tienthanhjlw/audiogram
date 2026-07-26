# Phase 3 — Task plan chi tiết (giao cho Sonnet thực thi)
*Ngày lập: 27/07/2026 · Nguồn: `UI_REBUILD_PLAN.md` P3 (mục 14–20) + `UI_DESIGN_SPEC.md` §5, §7, §8 + `OPTIMIZATION_PLAN.md` Đợt 2 (F1) + `TECH_ARCHITECTURE.md` Phần V P3 + `PHASE2_TASKS.md` §C*
*Điều kiện vào: Phase 2 đã đóng (commit `e9ddc54`).*

---

## 0. Phát hiện quan trọng khi khảo sát để lập kế hoạch (ĐỌC TRƯỚC)

Trong lúc soạn kế hoạch này tôi đã grep/đối chiếu số học 2 phía và tìm ra **4 lỗi parity đang tồn tại trong sản phẩm**, không phải giả định. Chúng định hình toàn bộ Block A bên dưới:

### 🔴 P-1. `zones` KHÔNG bao giờ được gửi sang Rust — editor kéo/thả zone không ảnh hưởng video export

- `RenderJobDto` (`crates/audiogram-core/src/entities/render_job.rs:8`) không có field `zones`.
- `crates/audiogram-core/src/contract_gen.rs:36` đã sinh sẵn `pub fn default_zones(template)` từ `contract/zones.json`… nhưng **`grep default_zones` trong toàn bộ `crates/` + `src-tauri/` = 0 call site**. Hàm được sinh ra rồi bỏ không.
- `crates/audiogram-render/src/frame.rs` dùng phân số **hard-code** trong từng match arm (dòng 146/159/193/204/229/232).

⇒ Toàn bộ tính năng canvas zone editor (P2-T7: kéo, resize, snap, Reset layout) **chỉ đổi preview, không đổi file xuất ra**. Đây là lỗi nghiêm trọng nhất hiện có.

### 🔴 P-2. Hai con số hình học đã lệch sẵn giữa preview và export

| Chỗ | Preview (`domain/preview/renderer.ts` qua `zones.json`) | Export (`frame.rs`) | Lệch |
|---|---|---|---|
| `fullbg` waveform `y` | `0.60` | `0.62` (dòng 193) | **2% chiều cao** |
| `brand` avatar bán kính | `min(0.08·W, 0.14·H)` (từ zone `w:0.16,h:0.28` ÷2) | `min(0.09·W, 0.14·H)` (dòng 219) | **1% chiều rộng** |

Golden-frame test (Đợt 1) **không bắt được** loại lỗi này vì nó chỉ so Rust với chính Rust. Đây đúng là lỗ hổng đã ghi trong `PHASE2_TASKS.md` §C.

### 🔴 P-3. Title style trong Inspector không tới được export

`DesignInspector` (P2-T8) cho chỉnh `titleColor` / `titleAlign` / `titleBold` / `titleItalic`, nhưng `RenderJobDto` không mang 4 field đó, và `build_filter_complex` (`render/mod.rs:380`) hard-code `fontcolor=white@0.95`, căn giữa cứng theo layout (`center_y` dòng 352–358), không đọc title zone. ⇒ 4 control mới của Phase 2 là **no-op khi export**.

### 🟡 P-4. `StepTranscript.tsx` có `<audio>` element thứ hai

`StepTranscript.tsx:175` vẫn tự tạo `<audio>` riêng, song song với `<audio>` duy nhất của `AudioEngine` (P1-T10). Vào Captions mode hiện tại = 2 nguồn phát độc lập. Chết theo `StepTranscript` ở T13, nhưng phải xoá đúng lúc port (T7), không được bê nguyên sang component mới.

> **Hệ quả cho kế hoạch:** Block A (parity) phải xong **trước** khi làm UI Captions/Export. `OPTIMIZATION_PLAN.md` xếp "Đợt 2 — thống nhất render chữ" vào giữa Phase 2 và Phase 3 chính là vì việc này; P-1/P-2/P-3 cho thấy phạm vi thật còn rộng hơn F1 một chút (không chỉ chữ, mà cả zones).

---

## A. LUẬT CHUNG cho mọi task (executor PHẢI đọc trước khi làm bất kỳ task nào)

1. **Một task = một commit.** Message: `p3-t<số>: <mô tả ngắn>`.
2. **Sau MỖI task chạy đủ 6 lệnh nghiệm thu chung:**
   ```bash
   # từ apps/desktop
   npm run typecheck
   npm run lint                        # 0 error
   npm run test
   # từ repo root
   npm test                            # cả 3 package
   cargo check --workspace
   cargo test --workspace              # BAO GỒM golden_frames — xem luật 3
   ```
3. **Golden-frame test là cổng chặn, KHÔNG phải phiền toái.** Khác với Phase 2 (frontend-only), Phase 3 **sửa `audiogram-render`**. Luật:
   - `cargo test --workspace` đỏ ở `golden_frames` ⇒ **dừng lại và đọc ảnh diff** ở `target/golden-diffs/*.png` trước khi làm bất cứ gì khác.
   - Nếu thay đổi là **cố ý** (T2/T4 chắc chắn sẽ làm goldens đổi): xoá PNG bị ảnh hưởng → chạy lại test để sinh lại → **mở từng ảnh mới xem bằng mắt** → commit ảnh mới **cùng commit** với thay đổi code, và ghi trong commit message *tại sao* frame đổi.
   - **CẤM** xoá/regenerate golden để "cho test xanh" mà không xem ảnh. Đây là lưới an toàn duy nhất của invariant preview↔export.
4. **Hằng số & hình học: một nguồn duy nhất.** Sau T2, mọi toạ độ layout đọc từ `contract/` (qua `@audiogram/contract` / `contract_gen.rs`). **CẤM** thêm phân số layout hard-code mới ở bất kỳ phía nào. Sửa hình học = sửa `contract/*.json` + `npm run contract:gen` + regenerate goldens.
5. **Khi kẹt >30 phút** ở quyết định không có trong spec: dừng, ghi `// TODO(p3-tX): <câu hỏi>`, báo lại, KHÔNG tự phát minh hướng khác.
6. Code + comment tiếng Anh. UI string tiếng Anh.
7. Đường dẫn viết tắt tính từ `apps/desktop/` trừ khi ghi `packages/`, `crates/`, `contract/`.
8. **CẤM sửa 2 component cũ (`StepTranscript.tsx`, `StepExport.tsx`) ngoài việc đọc chúng để port.** Chúng bị xoá ở T13. Ngoại lệ: T13 chính nó.

**Thứ tự bắt buộc & phụ thuộc:**

```
BLOCK A (parity — phải xong trước Block B/C)
T1 (golden 9 style) ──► T2 (zones qua RenderJob + contract hoá hình học)
                             │
                        T3 (text engine cosmic-text) ──► T4 (title vào frame.rs, bỏ drawtext)
                                                              └─► T5 (wrap thống nhất + audit)
BLOCK B (Captions mode)
T2 ──► T6 (Captions shell + transcribe/model) ──► T7 (segment list) ──► T8 (inspector + preview captions)
                                                        └────────────► T9 (transport blocks + chip)
BLOCK C (Export)
T5, T9 ──► T10 (estimate + sheet State A) ──► T11 (State B) ──► T12 (State C/D + OS integration)
BLOCK D
T12 ──► T13 (xoá Step components + eslint full) ──► T14 (ADR + docs + đóng phase)
```

Milestones: **M1** = T1–T5 (parity đóng, export đúng bằng preview) · **M2** = T6–T9 (Captions mode thật) · **M3** = T10–T12 (Export sheet) · **M4** = T13–T14 (dọn + đóng).

**Ngân sách:** ~14–17 ngày Sonnet. *(Block A một mình đã ~5–6 ngày — đúng bằng "Đợt 2: 3–4 ngày" của OPTIMIZATION_PLAN cộng thêm phần zones/P-1 mà tài liệu đó chưa biết. UI_REBUILD_PLAN ước Phase 3 "3–4 ngày" là con số viết trước khi có kiến trúc; Phase 1 ước 2–3 ngày → thực 14–16, Phase 2 ước 3–4 → thực 12 task.)*

**Quyết định đã chốt trước khi bắt tay (không mở lại):**

| Câu hỏi | Quyết định | Lý do |
|---|---|---|
| `CompositionSpec` đầy đủ (TECH_ARCHITECTURE §3.3: bỏ 6 hàm draw, template = JSON) | **HOÃN sang v1.1** — Phase 3 chỉ làm lát cắt hẹp: zones + title style đi qua `RenderJob`, hình học về `contract/` | Full spec-interpreter 2 phía là refactor lớn, rủi ro cao, và **không cần** cho mục tiêu Phase 3 (Captions + Export). Lát cắt hẹp đã fix được P-1/P-2/P-3 — tức là toàn bộ giá trị thực tế — với ~1/4 công. Ghi ADR để không tranh luận lại. |
| Subtitle chuyển từ libass sang Rust rasterize | **KHÔNG** — chỉ title chuyển | Đúng theo `OPTIMIZATION_PLAN.md` 2.6 ("có thể hoãn… libass xử lý karaoke `\kf` khá phức tạp"). Title là phần đang sai (P-3); subtitle qua libass hiện đã có đường parity riêng (`ass.rs` đọc `subtitle_y_pct` + boxY từng layout). |
| Tách `@audiogram/renderer` / `@audiogram/ui` (PACKAGE_SPLIT đợt 3) | **HOÃN** | Điều kiện của chính PACKAGE_SPLIT §3.2 chưa đạt: chưa có consumer thứ 2 (CLI chưa tồn tại — F8 vẫn optional). `domain/preview/renderer.ts` đã sạch ranh giới rồi (P2-T2), tách chỉ còn là `git mv` cơ học — làm lúc thật sự có CLI, không phải bây giờ. |
| Undo/redo (⌘Z) | **KHÔNG** — Phase 4 | UI_REBUILD_PLAN §5 P4 mục 21. |
| Timeline kéo-thả đầy đủ | **KHÔNG** | UI_REBUILD_PLAN §6 "việc KHÔNG làm". Transport segment blocks (T9) là "timeline lite" đúng như §2.3 đã chốt. |
| Golden test có nên phủ cả 9 style? | **CÓ, làm ngay T1** | `PHASE2_TASKS.md` §C ghi đây là lỗ hổng; Block A sắp sửa `frame.rs`/`wave/*` nên phải bịt trước, không phải sau. |

---

## T1 — Golden-frame test phủ đủ 9 wave style (½ ngày)

**Tham chiếu:** `PHASE2_TASKS.md` §C (mục "golden-frame test chỉ phủ 3/9"), `OPTIMIZATION_PLAN.md` 1.1.
**Mục tiêu:** bịt lỗ hổng lưới an toàn **trước** khi T2–T4 đụng vào renderer.

**Các bước:**
1. `crates/audiogram-render/tests/golden_frames.rs`: `STYLES` từ 3 → **9** (`bar/line/mirror/dot/neon/orb/pulse/eq/player`). Giữ nguyên 6 layout × 3 mốc thời gian.
2. Tổ hợp thành 162 ảnh (từ 54). Kiểm tra thời gian chạy: nếu `cargo test -p audiogram-render` vượt **30s** (mốc trong PACKAGE_SPLIT_PLAN "cột mốc kiểm chứng"), giảm còn 6 layout × 9 style × **1 mốc** `t=25%` + giữ 3 mốc cho riêng `bar`/`eq` (2 đường code khác nhau nhất). Ghi rõ lựa chọn trong comment đầu file.
3. Chạy lần đầu → sinh ảnh mới → **xem bằng mắt từng ảnh mới** (đặc biệt `line/neon/pulse/player` chưa từng được chụp) → xác nhận không có ảnh đen/trắng hoàn toàn hay vỡ hình → commit.
4. Cập nhật comment đầu file `golden_frames.rs` + đoạn tương ứng trong `CLAUDE.md` (số style được phủ).

**Nghiệm thu:**
- [ ] `cargo test -p audiogram-render --test golden_frames` xanh, chạy < 30s
- [ ] Số PNG trong `tests/golden/` khớp số tổ hợp đã chọn; **đã xem mắt toàn bộ ảnh mới sinh**
- [ ] Chạy lần 2 vẫn xanh (deterministic)
- [ ] Commit `p3-t1: extend golden-frame coverage to all 9 wave styles`

---

## T2 — `zones` đi qua `RenderJob`; hình học layout về `contract/` (1.5 ngày) 🔴

**Tham chiếu:** phát hiện P-1 + P-2 ở §0; `TECH_ARCHITECTURE.md` §2.4a; `CLAUDE.md` mục Parity.
**Mục tiêu:** editor zone của Design mode có tác dụng thật lên video; xoá 2 drift đã biết; xoá **mọi** phân số layout hard-code trong `frame.rs`.

**Các bước:**
1. **DTO + entity:**
   - `RenderJobDto` (`crates/audiogram-core/src/entities/render_job.rs`) thêm `pub zones: Option<LayoutZonesDto>` (dùng lại `LayoutZone`/`LayoutZones` đã sinh trong `contract_gen.rs`; nếu cần derive `Deserialize`/`specta::Type` thì thêm ở chỗ sinh, tức sửa `contract/codegen.mjs`, KHÔNG sửa tay file `.rs` sinh ra).
   - `RenderJob` thêm `pub zones: LayoutZones`, resolve trong `TryFrom`: `dto.zones` nếu có, ngược lại `default_zones(layout_str)` — **chính là hàm đang bị bỏ không** (`contract_gen.rs:36`).
2. **`frame.rs` đọc zones:** `render_frame_into(...)` thêm tham số `zones: &LayoutZones`. Trong 6 match arm, thay **toàn bộ** phân số hard-code bằng zone tương ứng, dùng **đúng công thức của preview** (`domain/preview/renderer.ts`):
   - waveform rect: `(W·wz.x, H·wz.y, W·wz.w, H·wz.h)`
   - avatar: `cx = W·(az.x + az.w/2)`, `cy = H·(az.y + az.h/2)`, `r = min(W·az.w, H·az.h)/2`
   - **Đây là chỗ 2 drift P-2 biến mất**: `fullbg` y 0.62→0.60, `brand` bán kính 0.09W→0.08W. Cả hai đổi theo hướng "Rust theo preview", vì preview là hợp đồng (`CLAUDE.md`).
   - Phần trang trí không có trong zones (gradient blob, divider, progress bar, dải tối) **giữ nguyên hard-code** — chúng thuộc `CompositionSpec` (đã chốt hoãn). Ghi `// TODO(v1.1): composition spec` tại các chỗ đó.
3. **Frontend gửi zones:** `StepExport.tsx` (còn sống tới T13) thêm `zones` vào payload `ipc.renderAudiogram`. Type tự cập nhật qua `bindings.gen.ts` sau khi chạy app/`cargo run`.
4. **Golden:** goldens của `fullbg` (mọi style) và `brand` (mọi style) **sẽ đổi** — đây là thay đổi cố ý, sửa lỗi. Regenerate + **xem mắt** + commit kèm. Các layout khác **không được đổi** (nếu đổi ⇒ đã port sai công thức, dừng lại điều tra).
5. **Test Rust mới** trong `audiogram-render`: `zones_override_moves_the_waveform` — render 2 frame cùng input nhưng khác `zones.waveform.y`, assert vùng pixel waveform dịch chuyển tương ứng.
6. **Test Rust mới** trong `audiogram-core`: `render_job_falls_back_to_default_zones` — `RenderJobDto{ zones: None }` → `RenderJob.zones == default_zones(layout)`.

**Nghiệm thu:**
- [ ] `grep -nE "\* 0\.[0-9]+" crates/audiogram-render/src/frame.rs` không còn phân số nào thuộc waveform/avatar (chỉ còn phần trang trí có TODO)
- [ ] Goldens `fullbg_*` + `brand_*` đổi và đã xem mắt; goldens 4 layout còn lại **byte-identical**
- [ ] Export thật: kéo zone waveform xuống dưới trong Design mode → export → **video đổi theo** (trước task này thì không)
- [ ] `cargo test --workspace` + toàn bộ nghiệm thu chung xanh
- [ ] Commit `p3-t2: send zones through RenderJob, drive frame.rs geometry from contract`

---

## T3 — Text engine trong `audiogram-render` (cosmic-text + font bundle) (2 ngày)

**Tham chiếu:** `OPTIMIZATION_PLAN.md` Đợt 2 mục 2.1–2.2 (F1). **Task này chỉ dựng engine, CHƯA nối vào pipeline** — nối ở T4. Tách vậy để nếu cosmic-text trục trặc thì chưa phá đường render đang chạy.

**Dep mới (chỉ `crates/audiogram-render`):** `cosmic-text` (bản mới nhất tương thích edition 2021).

**Các bước:**
1. `crates/audiogram-render/src/text.rs`:
   ```rust
   pub struct TextStyle { pub size_px: f32, pub color: [u8;3], pub alpha: f32,
                          pub bold: bool, pub italic: bool, pub align: TextAlign }
   pub enum TextAlign { Left, Center, Right }
   /// Rasterize `text` into the RGBA buffer inside `rect` (px). Returns laid-out line count.
   pub fn draw_text(buf: &mut [u8], w: usize, h: usize,
                    rect: (f32,f32,f32,f32), text: &str, style: &TextStyle) -> usize
   ```
   Dùng `cosmic-text` `FontSystem` + `Buffer`, blend glyph coverage vào buffer bằng `pixel::blend` sẵn có (giữ nguyên convention alpha của crate).
2. **Bundle font, KHÔNG dựa fontconfig** (đây là nửa còn lại của F1 — `drawtext:font='Arial'` hiện phụ thuộc font hệ thống lúc chạy): nhúng Inter (đã có sẵn cho UI qua `@fontsource-variable/inter`) vào crate bằng `include_bytes!`, nạp vào `FontSystem` lúc khởi tạo. `FontSystem` khởi tạo **một lần** cho cả encode (`OnceLock` hoặc truyền vào từ `compute_frame_luts`) — **không** khởi tạo mỗi frame (30 phút × 30fps = 54.000 lần).
   - Copy file font vào `crates/audiogram-render/assets/`; ghi nguồn + license (Inter = OFL) vào `THIRD_PARTY_LICENSES`.
   - Ánh xạ `font_name` của user (`Arial/Georgia/Impact/Verdana`) → hiện chỉ có Inter bundle: ghi `// TODO(p3-t3)` + fallback về Inter cho mọi giá trị, và **báo lại trong kết quả task** để quyết định có bundle thêm font hay đổi danh sách font trong UI (đây là quyết định sản phẩm, không tự quyết — luật A.5).
3. **Test đơn vị** trong `text.rs`:
   - `draws_something`: buffer đen + `draw_text("Hi")` → có pixel khác nền.
   - `respects_color`: màu pixel đậm nhất ≈ màu style.
   - `align_shifts_pixels`: cùng text, `Left` vs `Right` → khối pixel nằm ở nửa khác nhau của rect.
   - `bold_is_wider`: bold cho bounding box rộng hơn regular cùng size.
4. Benchmark thô (không cần crate bench): trong test ghi `eprintln!` thời gian rasterize 1 dòng 30 ký tự — nếu > 2ms/dòng thì báo lại (30fps × 2 dòng = ngân sách ~5% frame time).

**Nghiệm thu:**
- [ ] `cargo test -p audiogram-render` xanh, 4 test text mới
- [ ] `cargo check --workspace` sạch; app vẫn build & export như cũ (**chưa nối** — goldens KHÔNG được đổi ở task này)
- [ ] Ghi rõ kết quả quyết định font mapping trong báo cáo
- [ ] Commit `p3-t3: cosmic-text based text rasterizer + bundled Inter (not yet wired)`

---

## T4 — Title: `drawtext` → `frame.rs`, dùng zone + full style (1.5 ngày) 🔴

**Tham chiếu:** phát hiện P-3 ở §0; `OPTIMIZATION_PLAN.md` 2.3, 2.5.
**Mục tiêu:** title trong video xuất ra **giống hệt** title trong preview: cùng vị trí (title zone), cùng màu/căn/đậm/nghiêng, cùng font metric.

**Các bước:**
1. `RenderJobDto`/`RenderJob` thêm: `title_color: Option<String>` (hex), `title_align: Option<String>`, `title_bold: Option<bool>`, `title_italic: Option<bool>`. Resolve về `[u8;3]` / enum / bool với default khớp store (`#FFFFFF`, `center`, `false`, `false`).
2. `frame.rs`: sau khi vẽ layout, gọi `text::draw_text` cho title trong **title zone** (`zones.title`), font size = `H · 0.058 · (font_size_pct/100)` — **đúng công thức `drawTitle` của preview** (`domain/preview/renderer.ts`), line-height `1.4`, tối đa 2 dòng.
   - Layout `Karaoke`: preview vẽ title **khác** (font `H·0.070`, chỉ khi không có `activeSeg`) — port đúng nhánh đó, đừng dùng nhánh chung.
   - Layout `Brand`: preview căn trái từ mép trái title zone + có dòng "Now Playing" — port đúng.
   - Layout `Spotify`: preview có thêm chữ "Episode" dưới title — port đúng.
3. **Xoá** nhánh title khỏi `build_filter_complex` (`render/mod.rs:350–387`) — bao gồm cả bảng `center_y` hard-code. Filter graph còn lại chỉ `ass=` (subtitle) + `format=yuv420p`. `escape_drawtext` vẫn dùng cho đường dẫn `ass=` nên **giữ**; `wrap_text_2lines` thành mồ côi → xử lý ở T5.
4. **Golden mở rộng phủ title** (OPTIMIZATION_PLAN 2.5): trong `golden_frames.rs` thêm chiều `title` — mỗi layout render thêm 1 ảnh với `title: "The Quick Brown Fox Jumps"` (đủ dài để ép wrap 2 dòng) + style non-default (`bold: true`, `align: Right`, màu accent) để ảnh bắt được cả 4 field mới.
   - ⚠️ Đây là nơi duy nhất golden test có thể **flaky theo môi trường** (font rendering). Vì font đã **bundle** (T3) và không dùng fontconfig, kỳ vọng là deterministic. Nếu CI (macos-latest) khác máy local: **KHÔNG hạ chuẩn xuống SSIM ngay** — điều tra trước (rất có thể là subpixel/hinting setting), báo lại; SSIM-với-ngưỡng chỉ là phương án cuối (TECH_ARCHITECTURE §rủi ro đã dự phòng sẵn cách này).
5. Goldens cũ (không title) giữ nguyên byte-identical — nếu đổi ⇒ đã vô tình sửa phần non-text, dừng điều tra.

**Nghiệm thu:**
- [ ] `grep -n "drawtext" apps/desktop/src-tauri/src/infrastructure/ffmpeg/render/mod.rs` chỉ còn dòng liên quan `ass=` escaping
- [ ] Export thật với title dài + đổi màu/căn/bold trong Inspector → **video khớp preview** (chụp màn hình preview và frame video, so cạnh nhau)
- [ ] Export trên máy **không có font Arial** vẫn ra chữ (test bằng cách đặt `font_name` = tên font rác)
- [ ] Goldens mới có title đã xem mắt; goldens cũ không đổi
- [ ] Commit `p3-t4: render title in Rust from title zone + full style, drop ffmpeg drawtext`

---

## T5 — Thuật toán ngắt dòng thống nhất + audit parity (1 ngày)

**Tham chiếu:** `OPTIMIZATION_PLAN.md` 2.4; §0 P-2/P-3.

**Các bước:**
1. Sau T4, còn **2** bộ ngắt dòng: `wrapText()` (TS, đo pixel qua `ctx.measureText`) và cosmic-text tự wrap (Rust). Chuẩn hoá:
   - Quy tắc chung viết vào `contract/text.json`: `{ "titleMaxLines": 2, "titleLineHeight": 1.4, "subtitleMaxLines": 2, "subtitleLineHeight": 1.35 }` → codegen ra cả 2 phía (mở rộng `contract/codegen.mjs`).
   - Cả 2 phía dùng **cùng chiến lược**: greedy word-wrap theo **chiều rộng đo bằng font metric thật**, cắt ở `maxLines`. TS đã đo pixel thật (`measureText`) — giữ; Rust dùng cosmic-text layout width — giữ. Cái phải thống nhất là **hằng số + quy tắc cắt**, không phải cách đo.
2. **Xoá `wrap_text_2lines`** khỏi `crates/audiogram-core/src/util.rs` (mồ côi sau T4) + test của nó nếu có. Đây là hàm gây lệch gốc (đếm ký tự cứng `30`).
3. `apps/desktop/src/domain/preview/renderer.ts`: `wrapText` đọc `titleMaxLines` từ `@audiogram/contract` thay vì `.slice(0, 2)` hard-code.
4. **Audit parity thủ công** — điền bảng vào cuối task này trong báo cáo, mỗi dòng phải có kết luận ✅/❌:

   | Thuộc tính | Preview đọc từ | Export đọc từ | Khớp? |
   |---|---|---|---|
   | waveform rect | `zones.waveform` | `zones.waveform` (T2) | |
   | avatar tâm/bán kính | `zones.avatar` | `zones.avatar` (T2) | |
   | title vị trí | `zones.title` | `zones.title` (T4) | |
   | title màu/căn/bold/italic | store | `RenderJob` (T4) | |
   | title font size | `H·0.058·pct` | `H·0.058·pct` (T4) | |
   | title ngắt dòng | contract (T5) | contract (T5) | |
   | subtitle vị trí | `zones.subtitle`/`subtitleYPct` | `ass.rs` MarginV | |
   | subtitle màu/karaoke | store | `write_ass` params | |
   | wave bars/fill/gap | `@audiogram/contract` | `contract_gen.rs` | |
   | vignette | `0.22→0.50` literal trong `drawBg` | `BG_DARK_TOP/BOTTOM` | |

   *(Dòng "vignette" **đã xác nhận là ❌ khi lập kế hoạch**: `renderer.ts:208` (`drawBg`) dùng literal `rgba(0,0,0,0.22)`/`rgba(0,0,0,0.50)` chứ KHÔNG import `BG_DARK_TOP`/`BG_DARK_BOTTOM` từ `@audiogram/contract` — giá trị hiện trùng nhau nên chưa lệch hình, nhưng sửa contract sẽ chỉ đổi phía Rust. Sửa luôn trong task này. Dòng "subtitle vị trí" là ô duy nhất tôi chưa kiểm — executor phải đối chiếu `ass.rs`'s `MarginV` với `zones.subtitle`/`subtitleYPct` của preview và báo kết quả.)*
5. Cập nhật comment parity đã lỗi thời: `crates/audiogram-subtitle/src/ass.rs:103` trỏ tới `WaveformCanvas.tsx` (file này giờ chỉ là adapter) → sửa thành `domain/preview/renderer.ts`.

**Nghiệm thu:**
- [ ] `grep -rn "wrap_text_2lines" crates apps` = 0 hit
- [ ] Bảng audit 10 dòng điền đủ, mọi ❌ đã fix hoặc có TODO + lý do
- [ ] Export video before/after T5 giống nhau (T5 không được đổi hình ảnh, chỉ đổi nguồn hằng số)
- [ ] Commit `p3-t5: unify text wrapping through contract, parity audit`

---

## T6 — Captions mode shell + cụm Transcribe/Model (1.5 ngày)

**Tham chiếu:** `UI_DESIGN_SPEC.md` §5.1 cụm 1–2, §8.5 (Model popover), §8.1 (confirm re-transcribe).

**Các bước:**
1. `features/captions/CaptionsPanel.tsx` — cột trái 280px cho mode Captions. `App.tsx`: `mode === 'captions'` giờ dùng **cùng bộ 3 pane** như Design (`leftPanel={<CaptionsPanel/>}`, giữa `<CanvasStage/>`, `inspector={<CaptionsInspector/>}` — inspector ở T8, tạm `undefined`), **thay cho** `StepTranscript` chiếm cả vùng. `StepTranscript` vẫn còn file (xoá ở T13) nhưng **không còn được render** sau task này.
   - ⚠️ Đây là lúc P-4 (`<audio>` thứ hai) biến mất khỏi luồng chạy — xác nhận bằng tay: vào Captions mode, bấm Space, chỉ có **một** nguồn phát.
2. **Cụm Transcribe** (§5.1 cụm 1): 
   - Model select 1 dòng: trigger `Model: Base · 142 MB ✓`, mở **Model popover** §8.5 (component riêng `features/captions/ModelPopover.tsx`): list từ `ipc.listModels()`, radio + size + note, badge `Recommended` cho `base` (**bỏ chữ "BUNDLED"** — UI_REBUILD_PLAN mục 15), nút `Get ↓` cho model chưa tải + progress bar trong row đọc `captions.modelDownload` (đã có sẵn từ P1-T8), row chưa tải không chọn được.
   - Nút Transcribe: 3 trạng thái theo spec (`🎙 Transcribe` / `↺ Re-transcribe` secondary / spinner + `Transcribing… 12s` + thanh indeterminate 2px). Re-transcribe → confirm dialog §8.1 (`Modal`, danger).
   - Lỗi: inline alert đỏ dưới nút + nút `Retry` (spec §5.1, thay cho toast).
   - **Mọi IPC qua `ipc.*`**, KHÔNG `invoke` trực tiếp (StepTranscript đang dùng `invoke` — port sang `ipc.transcribeAudio`/`ipc.writeSrt`/`ipc.listModels`/`ipc.downloadModel`). Logic transcribe (`splitSegments` + `write_srt` + set store) chuyển vào `features/captions/useTranscribe.ts`.
3. **Cụm Search** (§5.1 cụm 2): Input 32px + icon, filter client-side **case + dấu tiếng Việt insensitive** (dùng `String.normalize('NFD').replace(/\p{Diacritic}/gu,'')` — viết trong `domain/search.ts` + test), debounce 150ms (TECH_ARCHITECTURE §4.3), Esc = clear, count đổi "3 of 11 segments".

**Nghiệm thu:**
- [ ] Vào Captions mode thấy 3 pane (trái = panel mới, giữa = canvas, phải trống tạm), **không** còn UI cũ của StepTranscript
- [ ] Transcribe chạy thật end-to-end; Re-transcribe hỏi confirm; lỗi hiện inline + Retry chạy lại được
- [ ] Model popover: tải 1 model chưa có → thấy % trong row, xong tự refresh sang ✓
- [ ] Search lọc đúng cả khi gõ không dấu ("kinh thanh" khớp "Kinh thánh")
- [ ] Chỉ 1 nguồn audio phát (P-4 đã hết)
- [ ] Commit `p3-t6: captions mode shell + transcribe/model cluster`

---

## T7 — Segment list: virtualized, edit, keyboard, context menu (1.5 ngày)

**Tham chiếu:** `UI_DESIGN_SPEC.md` §5.1 cụm 3 + §8.6; `@audiogram/segments` ops (P2-T11 đã viết sẵn `splitAt`/`mergeWithNext`/`remove`).

**Các bước:**
1. `features/captions/SegmentList.tsx` — `react-virtuoso` (đã có dep, giữ pattern từ StepTranscript). Row anatomy đúng §5.1: hàng meta 10px mono (`0:00.0 → 0:01.9` + badge duration, `<1.2s` = amber) + text 12.5px.
2. **States** đúng bảng spec: default / hover / **active** (playhead trong range: bg accent-soft + border-left 2px + auto-scroll vào giữa — giữ `scrollToIndex` logic) / selected / editing (textarea auto-height, Enter commit, Esc cancel, ⌘Enter commit + chọn segment kế).
   - `selectedSegmentId` vào `ui.slice` (TECH_ARCHITECTURE §2.2 đã liệt kê field này) — T9 cần đọc để đồng bộ với transport.
3. **Tương tác:** click ▶/double-click = seek + play (qua `audioEngine`, KHÔNG tạo `<audio>` mới); click text = select; Enter/click lần 2 = edit; `↑/↓` di chuyển selection; `Space` **không bị nuốt** (shortcut toàn cục vẫn chạy — kiểm tra guard `notTyping` trong `shortcuts.ts` hoạt động đúng khi focus đang ở row chứ không phải textarea).
4. **Context menu** §8.6 (dùng `ui/ContextMenu` sẵn có): Play from here · Edit text `↵` · ─ · Split at playhead · Merge with next · ─ · Delete (danger).
   - Split/merge/delete gọi thẳng `@audiogram/segments` ops → `set({ segments })` → ghi lại SRT qua `ipc.writeSrt`.
   - Disabled đúng ngữ cảnh (spec): Merge disabled ở row cuối; Split disabled khi playhead ngoài segment **và** segment < 0.6s. Mọi item disabled **bắt buộc có `disabledReason`** (luật spec §9).
5. Commit sửa text vẫn ghi lại SRT như `updateSegment` hiện tại (debounce nhẹ để không ghi mỗi keystroke).

**Nghiệm thu:**
- [ ] List 200+ segment cuộn mượt (virtualized), active row tự cuộn theo playhead khi phát
- [ ] Sửa text → commit → `srtPath` cập nhật; đóng/mở lại app (session) thấy text đã sửa
- [ ] Chuột phải: split tại playhead ra 2 segment đúng thời điểm; merge với next đúng; delete đúng; **`segments` luôn re-id 0..n-1** (ops đã đảm bảo — verify bằng devtools)
- [ ] `↑/↓/Enter/Esc/Space` đúng bảng spec
- [ ] Commit `p3-t7: virtualized segment list with inline edit + context menu ops`

---

## T8 — Captions inspector + preview hiển thị caption thật (1 ngày)

**Tham chiếu:** `UI_DESIGN_SPEC.md` §5.2.

**Các bước:**
1. `features/captions/CaptionsInspector.tsx` — tĩnh (không phụ thuộc selection), đủ 5 cụm bảng §5.2: SHOW CAPTIONS (Toggle + disabled reason "Transcribe first") · TEXT COLOR (palette `subtitle` từ registry P2-T1, mờ khi toggle off) · KARAOKE (Toggle + sub-label + palette `karaoke`) · POSITION (Slider 0–100% + nút `Auto` = `subtitleYPct: null`) · FILES (`captions.srt ✓` + `Reveal` ghost, chỉ khi `srtPath`).
2. **Status line** cuối inspector (§5.2, fix finding F): `11 segments · ○ White` — **swatch tròn 10px + TÊN màu**, không hex. Tên lấy từ palette registry; màu custom (không có trong palette) → hiện "Custom".
3. **`PreviewCanvas` hiển thị caption thật:** hiện đang hard-code `karaokeEnabled: false, segments: [], activeSeg: undefined` (P2-T2, đúng cho Design mode). Thêm prop `showCaptions?: boolean`; khi bật, lấy `segments`/`karaokeEnabled`/`karaokeColor` từ store và tính `activeSeg`/`slotStart`/`slotDur`/`elapsed` từ `currentTime` của engine (logic đã có trong `WaveformCanvas.tsx` adapter — copy, đừng viết lại). `CanvasStage` truyền `showCaptions={mode === 'captions'}`.
   - Kéo zone `subtitle` trên canvas (đã chạy từ P2-T7) phải đồng bộ 2 chiều với slider POSITION.

**Nghiệm thu:**
- [ ] Đủ 5 cụm; toggle off → color row mờ; karaoke off → không hiện palette karaoke
- [ ] Captions mode: canvas hiện **text caption thật đang phát**, đổi màu/karaoke thấy ngay
- [ ] Kéo subtitle zone ⇄ slider POSITION đồng bộ; `Auto` trả về mặc định layout
- [ ] Status line hiện tên màu, không hex
- [ ] Commit `p3-t8: captions inspector + live captions in preview`

---

## T9 — Transport: segment blocks + now-playing chip (¾ ngày)

**Tham chiếu:** `UI_DESIGN_SPEC.md` §6 (2 dòng cuối bảng) — đóng nốt `TODO(p1-t12)` tại `features/transport/TransportBar.tsx:164`.

**Các bước:**
1. **Segment blocks:** dải 6px sát đáy seek strip, mỗi segment 1 block radius 2px, `--accent` 45%; segment active 100% + glow nhẹ. Vẽ vào **cùng canvas** của seek strip (không thêm DOM node cho mỗi segment — 500 segment sẽ giết layout). Chỉ hiện khi `mode === 'captions'` **và** `segments.length > 0`.
2. Hover block → tooltip text segment; click block → seek + `selectSegment(id)` (đọc/ghi `ui.selectedSegmentId` từ T7) → list cuộn tới row đó.
3. **Now-playing chip** (phải, max 280px, ellipsis): chỉ khi có segments & đang phát; click = scroll list đến segment hiện tại.
4. Giữ nguyên nguyên tắc hot-path của P1-T12: playhead + blocks vẽ trong `audioEngine.onFrame`, **không** qua store 10Hz.
5. Xoá comment `TODO(p1-t12)`.

**Nghiệm thu:**
- [ ] Design mode: **không** có blocks/chip (spec §6 dòng cuối). Captions mode: có đủ
- [ ] Click block = seek đúng + row tương ứng được select và cuộn vào tầm nhìn
- [ ] 300 segment: seek strip vẫn 60fps (DevTools Performance)
- [ ] `grep -rn "TODO(p1-t12)" src` = 0 hit
- [ ] Commit `p3-t9: transport segment blocks + now-playing chip`

---

## T10 — `domain/export/estimate.ts` + Export Sheet State A (1 ngày)

**Tham chiếu:** `UI_DESIGN_SPEC.md` §7.1; `TECH_ARCHITECTURE.md` §2.2 (`domain/export/estimate.ts`).

**Các bước:**
1. `domain/export/estimate.ts` (thuần, có test): `estimateSize(durationSec, canvasSize, fps): bytes` + `estimateTime(durationSec, fps, canvasSize): seconds`. Bitrate heuristic theo độ phân giải (ghi rõ nguồn số trong comment); test: 1080p/30fps/60s cho ra khoảng hợp lý, monotonic theo duration & fps.
2. `features/export/ExportSheet.tsx` — Modal 560px, mở bằng nút Export/⌘E (`actions.exportProject` đổi từ `goTo('export')` sang mở sheet), đóng bằng Esc.
   **State A** đúng §7.1: FORMAT (Select 3 `CANVAS_SIZES`, đổi = đổi `canvasSize` toàn app) · FRAME RATE (SegmentedControl 24/30/60 — **đây là nhà chính thức của `fps`**, thay chỗ tạm trong `StepExport` từ P2-T12) · CAPTIONS (radio burn-in/no + sub-toggle karaoke, disabled khi chưa có segments) · FILE NAME (input + hậu tố `.mp4` cố định ngoài input, prefill slug từ `title`) · dòng Estimated · nút Cancel/Export.
3. Export → native `save()` dialog (defaultPath = file name) → chuyển State B (T11).
4. `ui.slice` thêm `exportSheet: 'closed' | 'settings' | 'rendering' | 'success' | 'error'` (TECH_ARCHITECTURE §2.2 gọi là `exportSheetState`, không persist).

**Nghiệm thu:**
- [ ] ⌘E và nút Export đều mở sheet; Esc đóng
- [ ] Đổi Format trong sheet → preview phía sau đổi theo (nhìn qua overlay)
- [ ] Estimated đổi khi đổi fps/format/độ dài audio; test estimate xanh
- [ ] Commit `p3-t10: export size/time estimate + export sheet settings state`

---

## T11 — Export Sheet State B: checklist, progress, ETA, cancel, minimize (1.5 ngày)

**Tham chiếu:** `UI_DESIGN_SPEC.md` §7.2. **Toàn bộ dữ liệu cần đã có sẵn** trong `render.slice` từ P1-T9 + Đợt 0 (`stage`, `progressPct`, `frame`, `totalFrames`, `etaSeconds`, `logs`) và `ipc.cancelRender()` — task này là **UI thật cho hạ tầng đã trả tiền**.

**Các bước:**
1. Checklist 4 bước map từ `render.slice.stage`: Preparing audio → Writing captions (chỉ hiện khi có captions) → Rendering frames (`{frame} / {totalFrames}`) → Encoding video. Icon: done ✓ `--success` / active ◉ accent pulse / pending ○ `--text-3`; transition 200ms.
2. ProgressBar 6px + `%` + **ETA** format `~1:10 left`, chỉ hiện khi `progressPct ≥ 5` **và** đã chạy ≥ 5s (spec — tránh ETA nhảy loạn lúc đầu).
3. `▸ Show details` disclosure, **mặc định ĐÓNG**, mở ra khu log mono 11px cao 120px đọc `render.slice.logs`, auto-scroll đáy.
4. **Cancel:** confirm inline (không phải modal chồng modal) "Stop exporting? Partial file will be deleted. [Keep going] [Stop]" → `ipc.cancelRender()`. Kiểm chứng backend đã xoá temp file (P1-T9 đã làm) bằng `ls $TMPDIR/.audiogram-*.mp4` sau khi huỷ.
5. **Minimize:** click overlay ngoài = thu nhỏ (KHÔNG cancel) → toolbar Export button thành progress chip `◔ 42%` (đã có sẵn dạng thô trong `Toolbar.tsx` — nối vào `progressPct` thay cho `progress` cũ); click chip = mở lại sheet. Trong lúc render, Esc **không** đóng (`dismissable={false}`).

**Nghiệm thu:**
- [ ] Export thật: 4 bước checklist sáng đúng thứ tự, frame count chạy, ETA xuất hiện sau ~5%
- [ ] Cancel giữa chừng: ffmpeg chết (`ps aux | grep ffmpeg`), temp file bị xoá, sheet về trạng thái lỗi/đóng đúng
- [ ] Minimize → chip chạy % → click chip mở lại đúng tiến độ
- [ ] Show details hiện log thật
- [ ] Commit `p3-t11: export sheet rendering state — checklist, ETA, cancel, minimize`

---

## T12 — State C/D + tích hợp hệ điều hành (1 ngày)

**Tham chiếu:** `UI_DESIGN_SPEC.md` §7.3, §7.4, §8.3; `UI_REBUILD_PLAN.md` §4.4.

**Các bước:**
1. **State C — Success** (§7.3): icon ✓ 48px `--success` pop-in 200ms + `{file}.mp4 · 46.2 MB · 1:24` (đọc size thật của file xuất ra) + `[Reveal in Finder]` primary (`ipc.openFolder`) / `[Export Another]` (về State A giữ settings) / `[Done]` ghost.
2. **State D — Error** (§7.4): icon ⚠ `--danger` + message thân thiện từ `AppError.message` (**không bao giờ raw exception** — TECH_ARCHITECTURE §4.1) + `▸ Show details` auto-scroll tới dòng Error + `[Try Again]` / `[Close]`.
3. **Dock/taskbar progress** (UI_REBUILD_PLAN §4.4): Tauri `set_progress_bar` theo `progressPct`; reset khi xong/huỷ. (Cần API window — nếu phải thêm permission thì thêm vào `capabilities/default.json`, không viết logic Rust mới.)
4. **Native notification** khi export xong mà app **không** focus: thêm `@tauri-apps/plugin-notification` + permission; xin quyền lần đầu; nội dung "Export complete — my-episode.mp4".
5. **Confirm khi đóng cửa sổ lúc đang render** (§8.3): hook `onCloseRequested`, hiện dialog `[Keep Exporting]` primary / `[Quit Anyway]` danger; Quit Anyway → `cancelRender()` rồi mới đóng.

**Nghiệm thu:**
- [ ] Export xong: State C hiện đúng size/duration thật; Reveal mở đúng thư mục; Export Another quay lại State A giữ nguyên settings
- [ ] Ép lỗi (đổi `FFMPEG_PATH` sang đường dẫn rác) → State D, message người đọc được, details có log
- [ ] Dock icon hiện progress khi render (macOS)
- [ ] Export xong lúc app ở background → nhận notification
- [ ] Đóng cửa sổ lúc đang render → hỏi; Quit Anyway huỷ render sạch
- [ ] Commit `p3-t12: export success/error states + dock progress, notification, close guard`

---

## T13 — Xoá `StepTranscript`/`StepExport`, dọn `types.ts`, bật ESLint full (¾ ngày)

**Các bước:**
1. **Checklist tính năng trước khi xoá** (giống T12 Phase 2 — bắt buộc, đây là cách bắt lỗi mất tính năng như vụ `fps`): liệt kê mọi thứ 2 component còn làm được, chỉ ra "nhà mới" của từng cái. Chú ý các mục dễ sót: model download progress, elapsed timer khi transcribe, badge duration `<1.2s`, `write_srt` sau khi sửa text, preview trong StepExport, log panel, `lastOutput`.
2. **Xoá:** `src/components/StepTranscript.tsx`, `src/components/StepExport.tsx`, và `src/components/WaveformCanvas.tsx` (adapter P2-T2 chỉ tồn tại vì 3 component cũ — sau task này không còn ai import). Thư mục `src/components/` **trống** ⇒ xoá luôn.
3. `types.ts`: xoá `Step` type + field `step` khỏi `ui.slice` + `goTo/next/back` (không còn ai gọi). `AppState` interface (di sản pre-Phase-1) — xoá nếu không còn call site. Cập nhật `store/__tests__/compat.test.ts`: test này cố tình khoá shape store cũ; giờ hợp đồng đó hết hiệu lực → viết lại thành test khoá shape **mới** (hoặc xoá, ghi lý do trong commit).
4. **ESLint full** (TECH_ARCHITECTURE Phần V mục 12): `no-restricted-imports` cho `@tauri-apps/api/core` nâng lên `error` **toàn `src/**`** (bỏ override warn ở base rule). Sửa nốt hit còn lại nếu có.
5. `main.tsx`: cân nhắc xoá route `?gallery=1` + `ui/__gallery__.tsx` — **giữ**, nó vẫn hữu ích cho QA primitives; chỉ xoá 2 section tạm của P2-T3 nếu Design gallery đã thay thế (tuỳ executor, ghi lý do).

**Nghiệm thu:**
- [ ] `ls src/components` = không tồn tại; `grep -rn "StepTranscript\|StepExport\|WaveformCanvas" src` = 0 hit (trừ comment lịch sử)
- [ ] Bảng checklist tính năng điền đủ, mỗi dòng có nhà mới hoặc lý do bỏ
- [ ] `npm run lint` 0 error **và 0 warning** về `@tauri-apps/api/core`
- [ ] Flow đầy đủ chạy 100% không còn code cũ: START → Design → Captions → Export
- [ ] Commit `p3-t13: delete the last legacy Step components, enforce full import rules`

---

## T14 — ADR + tài liệu + đóng Phase 3 (¾ ngày)

**Tham chiếu:** `TECH_ARCHITECTURE.md` §4.5.

**Các bước:**
1. `docs/adr/` (chưa tồn tại) — mỗi file ~15 dòng (Context / Decision / Consequences):
   - `0001-studio-workspace-thay-wizard.md`
   - `0002-tauri-specta-cho-ipc.md`
   - `0003-contract-json-codegen-parity.md`
   - `0004-plugin-3-cap.md`
   - `0005-template-as-composition-data.md` — **ghi rõ đã HOÃN sang v1.1 và vì sao** (quyết định ở §A bảng trên)
   - `0006-rust-text-rasterization.md` — quyết định T3/T4: bỏ `drawtext`, bundle font, giữ libass cho subtitle + lý do
2. `CLAUDE.md`: cập nhật mục Parity (zones giờ là hợp đồng thật, title vẽ trong Rust, golden phủ 9 style + title), mục Encoding Pipeline (filter graph không còn drawtext), cây thư mục frontend (`features/captions`, `features/export`, `domain/export`).
3. **Audit parity cuối phase** (bắt buộc): export 1 video ở commit `e9ddc54` (đóng Phase 2) và 1 video sau T13 với **cùng** input/settings mặc định → so frame đầu/giữa/cuối.
   - Khác biệt **hợp lệ và mong đợi**: title (giờ đúng vị trí zone + đúng style), `fullbg` waveform dịch 2%, `brand` avatar nhỏ đi 1% — tất cả là **sửa lỗi** P-2/P-3.
   - Khác biệt ngoài danh sách đó ⇒ dừng, điều tra.
4. Append `## C. Input cho Phase 4` vào **file này**: tổng hợp mọi `TODO(p3-*)`, quyết định hoãn, và các mục Phase 4 đã biết (undo/redo, session auto-restore, first-run hint, extension Cấp 1, `@audiogram/renderer` split, F8 CLI, CompositionSpec).

**Nghiệm thu:**
- [ ] `npm run ci` xanh từ máy sạch
- [ ] 6 ADR tồn tại, mỗi cái đọc hiểu trong 1 phút
- [ ] Audit video before/after ghi rõ từng khác biệt và lý do
- [ ] Commit `p3-t14: ADRs, docs update, phase 3 close-out`

---

## B. Tổng ngân sách & cách giao việc

| Milestone | Tasks | Ước lượng |
|---|---|---|
| M1 parity (Đợt 2 + zones) | T1–T5 | 5.5–6.5 ngày |
| M2 Captions mode | T6–T9 | 4.5–5 ngày |
| M3 Export sheet | T10–T12 | 3.5 ngày |
| M4 dọn + đóng | T13, T14 | 1.5 ngày |
| **Tổng Phase 3** | 14 tasks | **~15–17 ngày Sonnet** |

**Prompt template giao từng task cho Sonnet:**

> Đọc `PHASE3_TASKS.md` mục §0 (phát hiện parity) + §A (luật chung) + task T\<n\>. Đọc thêm các mục được task trỏ tới trong `UI_DESIGN_SPEC.md` / `TECH_ARCHITECTURE.md` / `OPTIMIZATION_PLAN.md`, và code tại các file/dòng task chỉ đích danh. Thực hiện đúng phạm vi T\<n\>. **Nếu `cargo test` đỏ ở `golden_frames`, áp dụng luật §A.3 — xem ảnh diff trước, không regenerate mù.** Chạy đủ nghiệm thu chung (§A.2) + nghiệm thu riêng, báo cáo từng checkbox, liệt kê mọi TODO đã ghi. Kẹt theo luật §A.5 thì dừng và hỏi.

**Điều kiện đóng Phase 3 (review bởi model lớn hơn):**
- [ ] 14 task commit đủ, `npm run ci` xanh
- [ ] **P-1/P-2/P-3 đã hết**: kéo zone → export đổi theo; 2 drift số học đã khớp; title style tới được video
- [ ] Golden-frame phủ 9 wave style + title; mọi lần regenerate đều có ghi chú lý do trong commit
- [ ] Captions mode + Export sheet chạy 100% theo `UI_DESIGN_SPEC.md` §5, §7, §8
- [ ] `src/components/` không còn tồn tại; ESLint full rule `error` toàn repo
- [ ] Không còn `drawtext` trong filter graph; không còn `wrap_text_2lines`
- [ ] Danh sách TODO(p3-*) tổng hợp thành input cho Phase 4
