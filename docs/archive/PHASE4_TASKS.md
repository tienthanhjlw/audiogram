# Phase 4 — Task plan chi tiết (giao cho Sonnet thực thi)
*Ngày lập: 28/07/2026 · Nguồn: `UI_REBUILD_PLAN.md` §5 mục 21–25 + `TECH_ARCHITECTURE.md` Phần V P4 + `PHASE3_TASKS.md` T14 bước 4 (input cho Phase 4) + `UI_DESIGN_SPEC.md` §8.4/§10 + `PACKAGE_SPLIT_PLAN.md` §3.2/§6 đợt 3 + audit code trực tiếp lúc soạn kế hoạch này.*

**⚠️ Điều kiện vào — CHƯA đạt:** `PHASE3_TASKS.md`'s T14 (ADR + docs + đóng Phase 3) **chưa chạy**. Task đó tồn tại chính xác để tạo "input cho Phase 4" (danh sách `TODO(p3-*)`, audit video before/after, ADR ghi lại các quyết định hoãn). Kế hoạch này soạn trước khi có T14 chính thức, dựa trên audit thủ công tương đương — **khuyến nghị chạy `p3-t14` trước hoặc làm task đầu tiên của Phase 4** (đặt tên `p4-t0` bên dưới) thay vì bỏ qua.

---

## 0. Phát hiện khi khảo sát để lập kế hoạch (ĐỌC TRƯỚC)

Khác với Phase 3 (4 lỗi parity nghiêm trọng), Phase 4 không có lỗi "chết tính năng" nhưng có **6 khoảng trống thật** tìm thấy qua grep/đọc code trực tiếp, không phải suy đoán từ tài liệu cũ:

### 🟡 F-1. Font picker nói dối — chọn Arial/Georgia/Impact/Verdana đều ra Inter

`crates/audiogram-render/src/text.rs:49` (`TODO(p3-t3)`, tự tôi ghi lúc P3-T3): `new_font_system()` chỉ bundle 4 face Inter. `DesignInspector.tsx`'s `FONT_OPTIONS` vẫn liệt kê 4 font khác — chọn bất kỳ font nào trong Inspector, export **luôn ra Inter**, preview (canvas `ctx.font`) thì vẫn dùng font hệ điều hành thật nếu máy có cài Arial/Georgia. ⇒ **preview và export lệch nhau theo font**, và đây chính là loại lỗi P-2/P-3 Phase 3 đã sửa cho zones/title — chưa sửa cho font. Cần **quyết định sản phẩm** (bundle thêm font hay rút gọn UI xuống chỉ Inter) trước khi code.

### 🟡 F-2. Kéo zone `subtitle` không tới export — lỗ hổng cùng họ P-1 (Phase 3), chưa vá hết

Ghi nhận từ `p3-t5`'s audit: `crates/audiogram-subtitle/src/ass.rs`'s `ass_style()` chỉ đọc `subtitle_y_pct` (override rời rạc) + tỉ lệ mặc định hard-code theo layout (`0.85`/`0.83`/`0.74`) — **không bao giờ đọc `zones.subtitle`**. `WriteAssParams` (`bindings.gen.ts`) không có field `zones`. Vậy: nếu Design mode có UI kéo subtitle zone (`CanvasStage.tsx` đã có Rnd handle cho `subtitle` từ P2-T7) và Captions inspector's POSITION slider (P3-T8) cũng chỉnh cùng field — cả hai chỉ đổi **preview**, video xuất ra dùng tỉ lệ hard-code riêng của nó trừ khi `subtitleYPct` được set thủ công. `split` layout còn tệ hơn: preview vẽ caption bằng code riêng (`drawSplit`'s literal `H*0.80`), export dùng công thức `ml/mr/mv` hoàn toàn khác — hai con số trùng nhau **tình cờ**, không phải cùng nguồn.

### 🟡 F-3. Golden-frame test không phủ chữ — lỗ hổng an toàn thật, không phải giả định

`crates/audiogram-render/tests/golden_frames.rs:124`: `&[]` cho title, ghi rõ "goldens intentionally don't cover text yet (T5)". Từ P3-T4 (title vẽ trong Rust qua cosmic-text) tới giờ, **không ảnh nào trong `tests/golden/` chứa một pixel chữ**. Bất kỳ thay đổi nào ở `frame.rs`'s `compute_title_pixels` hay `text.rs` có thể phá hình chữ mà cả bộ test 168+ vẫn xanh.

### 🟢 F-4. `Locate File…` dialog (§8.4) và toast lỗi chưa tồn tại

`ui/Toast.tsx` export `toast()` nhưng **0 call site** trong toàn bộ `src/features/`. `UI_DESIGN_SPEC.md` §8.4 tả dialog "Audio file not found — `[Locate File…]` / `[Remove from Recents]` / `[Cancel]`" khi mở Recent trỏ tới file đã bị xoá/di chuyển — `RecentGrid.tsx` hiện chỉ có `Remove from Recents`, không kiểm tra file có tồn tại trước khi mở.

### 🟢 F-5. Session tự khôi phục (§4.4) — dữ liệu đã lưu đủ, chưa có ai đọc lại

`core/persistence/attach.ts` ghi đủ `design`/`captions` vào `session.json` (P2-T4) — comment trong chính file đó: *"Auto-restore on launch is Phase 4"*. `app/actions.ts`'s `openRecentEntry()` (click 1 card trong Recents) chỉ khôi phục `{audioPath, audioName, title}`, bỏ qua toàn bộ `design`/`captions` đã lưu — mở lại một project cũ **luôn về template/màu/segments mặc định**, mất hết chỉnh sửa trước đó dù file đã lưu sẵn.

### 🟢 F-6. `WaveStyle`/registry.ts từng bị chèn một effect "flame" phá parity (đã revert) — ghi lại làm bài học

Trong lúc làm P3-T13, phát hiện + revert một bộ thay đổi ngoài luồng thêm style "flame" với comment tự nhận *"canvas-only; export falls back to bar"* — vi phạm trực tiếp bất biến preview↔export của `CLAUDE.md`. Không phải việc phải làm ở Phase 4, nhưng **mọi task Phase 4 chạm `packages/wave-effects/` phải tự hỏi câu hỏi parity trước khi thêm bất kỳ effect/biến thể nào** (luật đã có ở `TECH_ARCHITECTURE.md` §3.1, nhắc lại ở đây vì đã suýt bị phá).

> **Hệ quả cho kế hoạch:** Block A dưới đây xử lý 3 phát hiện 🟡 (F-1, F-2, F-3) vì chúng là lỗi/lỗ hổng thật, không phải tính năng mới — làm trước để không xây polish (Block B/C) trên nền còn lệch. F-4/F-5 là tính năng thật sự chưa có (Block B/C). F-6 chỉ là luật, không phải task.

---

## A. LUẬT CHUNG cho mọi task (executor PHẢI đọc trước khi làm bất kỳ task nào)

1. **Một task = một commit.** Message: `p4-t<số>: <mô tả ngắn>`.
2. **Sau MỖI task chạy đủ 6 lệnh nghiệm thu chung** (như Phase 3 §A.2):
   ```bash
   # từ apps/desktop
   npm run typecheck
   npm run lint                        # 0 error, 0 warning
   npm run test
   # từ repo root
   npm test                            # cả 3 package
   cargo check --workspace
   cargo test --workspace              # BAO GỒM golden_frames
   ```
3. **Golden-frame vẫn là cổng chặn** — luật y hệt Phase 3 §A.3 (xem ảnh diff trước khi regenerate, không bao giờ xoá-để-xanh mà không xem mắt). T3 (Block A) sẽ **mở rộng** bộ ảnh để phủ luôn title — từ đó trở đi, mọi lần đổi `text.rs`/`frame.rs`'s title path cũng phải qua cổng này.
4. **Hằng số & hình học vẫn một nguồn duy nhất** (`contract/`) — luật Phase 3 §A.4 không đổi, mở rộng thêm: T2 (Block A) thêm `zones.subtitle` vào đường dẫn export thật (`WriteAssParams`/`ass_style`) — sau đó **cấm** bất kỳ hard-code tỉ lệ subtitle mới nào ở Rust, phải đọc qua zone.
5. **Kẹt >30 phút ở quyết định không có trong spec:** dừng, ghi `// TODO(p4-tX): <câu hỏi>`, báo lại — đặc biệt áp dụng cho T1 (font) và T10–T12 (CompositionSpec/extension), là những chỗ nhiều khả năng phát sinh quyết định sản phẩm chưa ai chốt.
6. Code + comment tiếng Anh. UI string tiếng Anh.
7. **CẤM thêm effect/wave-style mới hoặc biến thể trang trí mà không có counterpart Rust cùng commit** (F-6). Nếu chỉ muốn thử preview-only, làm ở nhánh riêng, không merge.
8. Đường dẫn viết tắt tính từ `apps/desktop/` trừ khi ghi `packages/`, `crates/`, `contract/`, `docs/`.

**Thứ tự bắt buộc & phụ thuộc:**

```
p4-t0 (đóng Phase 3 chính thức — ADR + docs, = p3-t14 nếu chưa chạy)
        │
        ▼
BLOCK A (nợ kỹ thuật thật — làm trước Block B/C/D)
T1 (quyết định font) ──► không chặn T2/T3, chạy song song được
T2 (zones.subtitle → export)
T3 (golden phủ title text) ──► phải xong trước khi Block D chạm frame.rs/text.rs
T4 (FullBg title box: zone hay 0.84W)
        │
        ▼
BLOCK B (empty/error states + polish nhỏ — độc lập, chạy song song Block C)
T5 (Toast + Locate File dialog) ──► T6 (first-run hint) ──► T7 (audit UI: ngôn ngữ/tabular-nums/tooltip/focus/màu)
        │
        ▼
BLOCK C (session + undo — chạm store/slices rộng, làm sau khi Block A ổn định state shape)
T8 (session auto-restore) ──► T9 (undo/redo ⌘Z)
        │
        ▼
BLOCK D (kiến trúc chiến lược — LỚN, TÙY CHỌN cho "v1.0 polish", chuẩn bị cho v1.1)
T10 (CompositionSpec 2 phía) ──► T11 (@audiogram/renderer split, cùng nhát dao)
                               └─► T12 (extension Cấp 1 + Settings panel, phụ thuộc template-as-data của T10)
T13 (audiogram-cli, F8 — KHÔNG bắt buộc, ngoài đường găng, làm bất cứ lúc nào sau T11)
        │
        ▼
T14 (đóng Phase 4 — ADR bổ sung, cập nhật CLAUDE.md, audit parity cuối)
```

**Quyết định đã chốt trước khi bắt tay (không mở lại):**

| Câu hỏi | Quyết định | Lý do |
|---|---|---|
| Block D có bắt buộc cho "xong Phase 4" không? | **KHÔNG** — Block A/B/C là lõi ("v1.0 polish"), Block D là chuẩn bị v1.1, làm nếu còn ngân sách | `PHASE3_TASKS.md`'s quyết định gốc đã hoãn CompositionSpec sang v1.1 vì "refactor lớn, rủi ro cao, không cần cho mục tiêu Phase 3" — lý do đó chưa hết hiệu lực chỉ vì sang Phase 4; CompositionSpec vẫn chỉ đáng làm khi có nhu cầu thật (extension Cấp 1 từ người dùng thật, hoặc `@audiogram/renderer` có consumer thứ 2) |
| `@audiogram/ui` package split (đợt 3, PACKAGE_SPLIT_PLAN §3.2) | **KHÔNG đưa vào Phase 4** | Điều kiện chính "API primitives đứng yên ≥ 2 tuần" là mốc lịch, không phải mốc code — không nhét vào một kế hoạch chạy liên tục được; theo dõi ngoài kế hoạch này |
| Light theme / theme switcher | **KHÔNG** | `UI_REBUILD_PLAN.md` §6 đã liệt kê "chống scope creep", chưa có gì đổi hướng đó |
| Timeline kéo-thả đầy đủ (không phải "timeline lite" transport blocks đã có) | **KHÔNG** | Cùng lý do — `UI_REBUILD_PLAN.md` §6 |

---

## BLOCK A — Nợ kỹ thuật thật (parity/an toàn, ưu tiên cao)

## T1 — Quyết định + sửa font mapping (½ ngày)

**Tham chiếu:** F-1 ở §0; `crates/audiogram-render/src/text.rs:49` (TODO gốc); `apps/desktop/src/features/design/DesignInspector.tsx`'s `FONT_OPTIONS`.

**Các bước:**
1. **Quyết định trước khi code** (nếu kẹt >30 phút, dừng và hỏi — luật §A.5): chọn 1 trong 2 hướng, ghi vào ADR (T14):
   - **(a) Bundle thêm 3 font** (Arial/Georgia/Impact/Verdana hoặc face tương đương license cho phép — vd. Liberation Sans thay Arial) theo đúng cách đã làm với Inter ở P3-T3 (fonttools instancer nếu cần static weight, `include_bytes!`, seed vào `fontdb`).
   - **(b) Rút gọn UI xuống 1 font** (Inter) — xoá `FONT_OPTIONS` khỏi Inspector hoặc thay bằng "Inter" cố định, cập nhật `UI_DESIGN_SPEC.md` nếu cần.
2. Nếu (a): thêm font vào `crates/audiogram-render/assets/fonts/`, `new_font_system()` seed thêm, `text.rs`'s `TextStyle`/`draw_text` cần biết chọn face theo tên (hiện chỉ có 1 family "Inter" hard-code trong `fontdb::Query` — kiểm tra `cosmic_text::Attrs::family` cách chọn theo tên động).
3. Nếu (b): xoá phần chọn font khỏi `DesignInspector.tsx`, giữ `fontName` trong store nhưng luôn `'Inter'` (đơn giản hơn xoá field, tránh phá `session.json` schema hiện có).
4. Regenerate golden frames nếu (a) đổi bytes font nhúng (khó xảy ra vì golden chưa phủ text — xem T3; nếu T3 làm trước, chạy lại T3's golden sau khi xong T1).

**Nghiệm thu:**
- [ ] Preview và export cho cùng 1 `fontName` ra chữ giống nhau (chụp cạnh nhau nếu build được app thật)
- [ ] Không còn `TODO(p3-t3)` trong `text.rs`
- [ ] Commit `p4-t1: resolve the font-mapping gap (decision: <a hoặc b>)`

---

## T2 — `zones.subtitle` tới được export (¾ ngày)

**Tham chiếu:** F-2 ở §0; `crates/audiogram-subtitle/src/ass.rs`'s `ass_style()`; `WriteAssParams` (`bindings.gen.ts`).

**Các bước:**
1. Thêm field `zones: Option<LayoutZonesDto>` vào `WriteAssParams` (Rust struct nguồn + TS type sinh lại qua tauri-specta — nhớ bài học P3-T4: chạy binary **từ đúng thư mục `apps/desktop/src-tauri`**, không phải repo root, nếu không bindings sẽ bị cắt cụt).
2. `ass_style()`: khi có `zones.subtitle`, tính `MarginV` từ `zone.y` giống công thức preview (`H * zone.y`) thay vì tỉ lệ hard-code theo layout; giữ tỉ lệ hard-code hiện tại làm **fallback** khi `zones` là `None` (layout không có subtitle zone, hoặc override rỗng) — không xoá nhánh cũ, chỉ thêm nhánh ưu tiên.
3. `split` layout: đối chiếu công thức `ml/mr/mv` hiện tại với `zones.split.subtitle` thật — sửa để đọc zone thay vì 2 literal độc lập (đây là chỗ đang "trùng nhau tình cờ", theo F-2).
4. `apps/desktop/src/components`... không còn tồn tại (P3-T13) — nơi gọi `ipc.writeAss` giờ là `useTranscribe.ts`/`ExportSheet` gọi gián tiếp qua `useRenderExport.ts`; truyền `zones` vào `WriteAssParams` giống cách `toZonesDto()` đã làm cho `renderAudiogram`.

**Nghiệm thu:**
- [ ] Kéo subtitle zone trong Design mode → export video → caption box đúng vị trí đã kéo (so khung hình xuất với preview)
- [ ] Layout không có subtitle zone (karaoke, brand) không đổi hành vi (fallback nguyên vẹn)
- [ ] `split` layout hết "2 con số trùng ngẫu nhiên" — cả 2 phía cùng đọc `zones.split.subtitle`
- [ ] Commit `p4-t2: thread zones.subtitle through write_ass, closing the last zone→export gap`

---

## T3 — Golden-frame phủ title/caption text (½ ngày)

**Tham chiếu:** F-3 ở §0; `crates/audiogram-render/tests/golden_frames.rs:124`.

**Các bước:**
1. Thêm 1 chiều `title: Option<&str>` vào `render_case()` — mỗi layout render thêm **1 ảnh** với title cố định "The Quick Brown Fox Jumps" (đủ dài ép ngắt dòng, đúng như OPTIMIZATION_PLAN 2.5 đã dự tính từ Phase 3) + style non-default (`bold: true, align: Right`, màu accent) để bắt được cả 4 field style.
2. Vì font đã bundle (T1 xong trước hoặc đã có Inter từ P3-T3) và không dùng fontconfig hệ thống → kỳ vọng byte-identical trên mọi máy. Nếu CI (macos-latest) ra khác máy local: **không hạ chuẩn xuống SSIM ngay**, điều tra trước (rất có thể subpixel/hinting setting) — đúng luật đã ghi trong `PHASE3_TASKS.md` T2 bước 4.
3. Goldens cũ (không title) phải **giữ nguyên byte-identical** — nếu đổi nghĩa là T1/T2 vô tình sửa phần không liên quan chữ, dừng điều tra trước khi tiếp tục.
4. Cập nhật comment đầu file (`golden_frames.rs`) — bỏ dòng "goldens intentionally don't cover text yet".

**Nghiệm thu:**
- [ ] `cargo test -p audiogram-render --test golden_frames` xanh, đã xem mắt toàn bộ ảnh title mới sinh
- [ ] Chạy lần 2 vẫn xanh (deterministic)
- [ ] Comment đầu file không còn nói "chưa phủ chữ"
- [ ] Commit `p4-t3: extend golden-frame coverage to title/caption text`

---

## T4 — FullBg title box: zone hay `0.84·W`? (¼ ngày)

**Tham chiếu:** `frame.rs`'s `Layout::FullBg` arm trong `compute_title_pixels` (P3-T4, comment tự ghi "flagged for T5's parity audit"); `domain/preview/renderer.ts`'s `drawFullBg`.

**Các bước:**
1. Đọc lại lý do hiện tại: preview's `drawTitle(dc, yCenter)` không truyền `maxW` cho layout này → rơi vào fallback `W*0.84` canvas-centered, KHÔNG dùng `tz.w`/`tz.x` của zone. Rust đã port đúng hành vi này (cố tình, không phải bug).
2. Quyết định: **(a)** sửa preview để `drawFullBg` cũng dùng zone width như 3 layout kia (Spotify/Split/Minimal) — nhất quán hơn, nhưng đổi hành vi hiển thị hiện tại; hoặc **(b)** giữ nguyên, chỉ xoá TODO/comment "flagged" vì đã xác nhận đây là hành vi đúng, không phải nợ.
3. Nếu (a): sửa cả 2 phía cùng lúc, chạy lại T3's golden cho riêng layout `fullbg` (ảnh sẽ đổi — đây là thay đổi cố ý, ghi rõ trong commit).

**Nghiệm thu:**
- [ ] Quyết định ghi rõ trong commit message (a hoặc b) kèm lý do
- [ ] Nếu (a): golden `fullbg_*` mới đã xem mắt; nếu (b): comment "TODO/flagged" trong `frame.rs` đã xoá vì không còn là nợ
- [ ] Commit `p4-t4: resolve the FullBg title-box zone-vs-0.84W discrepancy`

---

## BLOCK B — Empty/error states & polish (độc lập, chạy song song Block C)

## T5 — Toast wiring + "Locate File…" dialog (¾ ngày)

**Tham chiếu:** F-4 ở §0; `UI_DESIGN_SPEC.md` §8.4, §8.7; `ui/Toast.tsx` (đã có, chưa dùng).

**Các bước:**
1. **Toast**: rà mọi `catch` trong `features/**` hiện đang chỉ log ra `logs`/console mà không có phản hồi UI nào (vd. lỗi `ipc.openFolder`, lỗi decode audio không qua render pipeline) — thay bằng `toast()` cho các lỗi *ngoài* luồng transcribe/render đã có UI riêng (đừng toast trùng với error đã hiện trong CaptionsPanel/ExportSheet).
2. **Locate File… dialog** (§8.4): khi `openRecentEntry()` (hoặc mở lại session lúc khởi động — xem T8) trỏ tới `audioPath` không còn tồn tại — dùng `@tauri-apps/plugin-fs`'s `exists()` (đã là dependency, dùng trong `SessionRepository.ts`) kiểm tra trước khi set store. Nếu không tồn tại: `Modal` "Audio file not found — `{filename}` was moved or deleted." + 3 nút: `Locate File…` (mở `open()` dialog, giữ nguyên mọi setting khác của entry, chỉ thay `audioPath`), `Remove from Recents` (gọi hàm `remove()` đã có trong `RecentGrid.tsx`), `Cancel`.
3. Đặt component này ở đâu: nếu T8 (session auto-restore) chạy sau, dialog này cần dùng lại cho cả 2 luồng (click Recent card VÀ khôi phục lúc khởi động) — viết thành 1 hook/component dùng chung (`features/start/useLocateMissingFile.ts` hoặc tương tự), không viết 2 lần.

**Nghiệm thu:**
- [ ] Đổi tên/xoá file audio của 1 Recent entry rồi click vào → hiện đúng dialog, không crash
- [ ] `Locate File…` chọn file mới → project mở bình thường với setting cũ
- [ ] Ít nhất 2–3 lỗi thật (không phải transcribe/render, đã có UI riêng) giờ hiện toast thay vì im lặng
- [ ] Commit `p4-t5: wire toast for real errors + Locate File dialog for missing audio`

---

## T6 — First-run hint (½ ngày)

**Tham chiếu:** `UI_DESIGN_SPEC.md` dòng cuối bảng "Thứ tự build spec" (P4 Polish: "first-run hint").

**Các bước:**
1. Xác định "first run" bằng 1 cờ boolean nhỏ trong `session.json` hoặc 1 file riêng (`app_data_dir/audiogram/first-run-done` hoặc field `hasSeenOnboarding` trong `SessionFile`) — **không** thêm dependency mới cho việc này.
2. Nội dung hint: tối thiểu — chỉ ra ⌘E (Export), mode switcher (Design/Captions), và Recents. Ưu tiên 1 tooltip/popover xuất hiện lần đầu ở START screen hoặc lần đầu vào Studio, tự đóng khi user tương tác hoặc click "Got it" — **không làm tour nhiều bước** (scope creep, không có trong spec).
3. Tôn trọng luật "1 ngôn ngữ" (T7) — viết tiếng Anh từ đầu.

**Nghiệm thu:**
- [ ] Xoá `session.json` (hoặc field cờ) → mở app → thấy hint; đóng app mở lại → không thấy nữa
- [ ] Không chặn luồng chính (drop file vẫn hoạt động dù hint đang hiện)
- [ ] Commit `p4-t6: first-run onboarding hint`

---

## T7 — Audit UI: 1 ngôn ngữ, tabular-nums, tooltip, focus ring, màu hard-code (½ ngày)

**Tham chiếu:** `UI_REBUILD_PLAN.md` §5 mục 24; `OPTIMIZATION_PLAN.md`'s note về i18n (đã chốt "1 ngôn ngữ", không thêm i18n lib).

**Các bước:**
1. **1 ngôn ngữ**: `grep -rn` chuỗi tiếng Việt còn sót trong `src/features/**/*.tsx` (chuỗi hiển thị UI, không phải comment) — sau P3-T13 hầu hết component tiếng Việt đã bị xoá cùng Step components, nhưng rà lại `Toolbar.tsx`, `RecentGrid.tsx`, mọi confirm dialog cũ (P1/P2) để chắc chắn.
2. **`tabular-nums`**: mọi chỗ hiện số thay đổi liên tục (timecode, %, frame count, file size ước tính) phải có class `.tabular` (đã định nghĩa ở `App.css`) — rà `TransportBar.tsx`, `ExportSheet.tsx`'s progress/ETA, `CaptionsPanel`'s elapsed timer.
3. **Tooltip cho icon-only button**: mọi nút chỉ có icon/ký tự không có label text đi kèm (vd. minimize `─`, close `✕` trong `ExportSheet.tsx`, play/pause icon trong `TransportBar.tsx`) phải có `Tooltip` hoặc `title`/`aria-label`.
4. **Focus ring nhất quán**: kiểm tra mọi `<button>` tự viết (không qua `ui/Button.tsx`) có `focus-visible` style giống hệ thống — rà các nút inline trong `CaptionsPanel.tsx`, `ExportSheet.tsx`.
5. **Không còn inline-style màu hard-code**: `grep -rn "style={{.*#[0-9A-Fa-f]\{3,6\}"` trong `features/**` — mọi màu phải qua token (`--color-*`) hoặc palette registry, trừ những chỗ đã ghi chú lý do kỹ thuật (vd. `TransportBar.tsx`'s `COLOR_PLAYED` — canvas `fillStyle` không đọc CSS var được, đã có comment giải thích, giữ nguyên).

**Nghiệm thu:**
- [ ] `grep` xác nhận 0 hit tiếng Việt trong UI string
- [ ] Danh sách chỗ đã sửa tabular-nums/tooltip/focus/màu liệt kê trong commit message
- [ ] Commit `p4-t7: language/tabular-nums/tooltip/focus-ring/hardcoded-color audit`

---

## BLOCK C — Session & Undo (chạm store rộng — làm sau khi Block A ổn định)

## T8 — Session tự khôi phục (1 ngày)

**Tham chiếu:** F-5 ở §0; `core/persistence/attach.ts`'s comment "Auto-restore on launch is Phase 4"; `TECH_ARCHITECTURE.md` §2.5.

**Các bước:**
1. **Khởi động app**: nếu `session.json` tồn tại và trỏ tới 1 `audioPath` còn tồn tại (dùng lại T5's file-exists check) → tự động khôi phục `screen: 'studio'` + toàn bộ `design`/`captions` đã lưu, thay vì luôn vào `StartScreen`. Nếu không tồn tại → dùng T5's Locate File dialog thay vì âm thầm rơi về START.
2. **Mở lại 1 Recent card** (`openRecentEntry()`): hiện chỉ khôi phục `{audioPath, audioName, title}` — mở rộng để đọc **toàn bộ** `session.json` tương ứng entry đó (không phải session.json hiện tại — cần biết `recents.json` entry nào map tới session nào; kiểm tra `SessionRepository.ts`'s schema hiện tại có đủ thông tin liên kết hay cần thêm field `sessionPath` vào `RecentEntry`).
3. Quyết định rõ: mở 1 Recent ≠ session hiện tại (session.json chỉ lưu **1** project gần nhất, không phải lưu riêng từng Recent) — cần làm rõ kiến trúc: hoặc (a) mỗi Recent tự có file session riêng (`app_data_dir/audiogram/sessions/<hash>.json`), hoặc (b) chấp nhận Recents chỉ khôi phục audio+title như hiện tại, và "auto-restore" (mục 1) chỉ áp dụng cho *session gần nhất lúc khởi động app*, không áp dụng khi click 1 Recent card cũ hơn. **(b) rẻ hơn nhiều và khớp với những gì spec thực sự đòi hỏi** (§4.4 nói "session persistence", không nói "mỗi recent có full state riêng") — chọn (b) trừ khi có lý do rõ ràng cần (a).

**Nghiệm thu:**
- [ ] Đóng app giữa lúc đang chỉnh Design mode → mở lại app → vào thẳng Studio với đúng template/màu/segments đã chỉnh (không phải START screen)
- [ ] File audio bị xoá lúc app đóng → mở lại → Locate File dialog thay vì crash hoặc màn hình trống
- [ ] Quyết định (a)/(b) ở bước 3 ghi rõ trong commit
- [ ] Commit `p4-t8: session auto-restore on launch`

---

## T9 — Undo/redo (⌘Z / ⇧⌘Z) (1.5 ngày)

**Tham chiếu:** `UI_REBUILD_PLAN.md` §5 mục 21; `TECH_ARCHITECTURE.md` §2.5 (temporal middleware).

**Các bước:**
1. Phạm vi: **Design mode edits + segment text edits** (đúng như spec liệt kê "layout + transcript edits") — **không** áp dụng cho playback state (`currentTime`/`playing`), render state (`isRendering`/`logs`/`stage`), hay UI-only state (`selectedEl`/`exportSheet`). Đây là lý do "2 scope" `TECH_ARCHITECTURE.md` §2.5 nhắc tới.
2. Cân nhắc `zundo` (zustand temporal middleware có sẵn) trước khi tự viết history stack — kiểm tra tương thích zustand v5 (repo đang dùng `"zustand": "^5.0.14"`) trước khi thêm dependency.
3. Partialize giống `attach.ts`'s `PERSISTED_FIELDS` nhưng **không phải cùng danh sách** — undo/redo không cần `srtPath`/`whisperModel` (không phải "edit" theo nghĩa người dùng thao tác trực tiếp), cần `zones`, `titleColor/Align/Bold/Italic`, `waveStyle/waveColor/bgColor/layoutTemplate/coverImagePath`, `segments` (text edits), `karaokeEnabled/karaokeColor/subtitleColor/subtitleYPct/showSubtitles`.
4. Debounce lịch sử giống `SegmentList.tsx`'s edit-commit (không lưu 1 entry mỗi keystroke) — mỗi "commit" (Enter trong SegmentList, mỗi lần buông chuột kéo zone) = 1 entry history.
5. ⌘Z/⇧⌘Z qua `app/shortcuts.ts` (bảng khai báo có sẵn) — guard `notTyping` giống các phím khác, nhưng cân nhắc: undo trong khi đang gõ text trong SegmentList's textarea nên undo **nội dung textarea** (hành vi trình duyệt mặc định), không phải store history — kiểm tra `isTypingTarget` guard đã đủ chưa.

**Nghiệm thu:**
- [ ] Kéo 1 zone → ⌘Z → về đúng vị trí cũ; ⇧⌘Z → redo đúng
- [ ] Sửa text 1 segment, commit → ⌘Z → text cũ quay lại, `write_srt` được gọi lại đúng
- [ ] ⌘Z khi đang gõ trong ô input/textarea không đụng vào store history (browser undo bình thường)
- [ ] Playback/render/UI-only state (đang phát nhạc, đang export) không bị undo can thiệp
- [ ] Commit `p4-t9: undo/redo for design + caption text edits`

---

## BLOCK D — Kiến trúc chiến lược (LỚN, TÙY CHỌN — chuẩn bị v1.1, không bắt buộc để đóng Phase 4)

## T10 — `CompositionSpec` — refactor 2 phía (2–2.5 ngày)

**Tham chiếu:** `TECH_ARCHITECTURE.md` §3.3; quyết định hoãn gốc trong `PHASE3_TASKS.md`'s bảng quyết định.

**Nhắc lại vì sao việc này từng bị hoãn:** "refactor lớn, rủi ro cao, và KHÔNG cần cho mục tiêu Phase 3". Lý do đó **vẫn đúng cho Phase 4** trừ khi T12 (extension Cấp 1) thực sự cần nó ngay — cân nhắc kỹ trước khi bắt đầu, đây là task duy nhất trong toàn kế hoạch có rủi ro đủ lớn để cân nhắc bỏ hẳn nếu không có nhu cầu người dùng thật.

**Các bước (nếu quyết định làm):**
1. Định nghĩa `CompositionSpec` đúng shape trong `TECH_ARCHITECTURE.md` §3.3 (`background`/`avatar`/`title`/`subtitle` variants) cho **cả 2 phía** — TS interface + Rust struct qua `contract_gen.rs` (mở rộng `codegen.mjs` giống cách `contract/text.json` đã làm ở P3-T5).
2. Viết 1 "compositor" TS đọc spec + zones → thay thế 6 hàm `drawSpotify/drawSplit/.../drawBrand` hiện tại; song song viết 1 hàm Rust tương đương thay 6 match arm trong `frame.rs`.
3. **Golden-frame là lưới an toàn bắt buộc ở đây** — chạy trước/sau mỗi bước nhỏ, không đổi nhiều thứ cùng lúc. Layout hiện có (6 template) phải render **byte-identical** sau refactor (đây không phải đổi hình, chỉ đổi cách sinh ra hình).
4. `LAYOUT_TEMPLATES`/`TemplateExtension` (đã có từ P2-T1 kernel) thêm field `composition: CompositionSpec`.

**Nghiệm thu:**
- [ ] `drawSpotify`...`drawBrand` (TS) và 6 match arm tương ứng (Rust) đã bị xoá, thay bằng 1 compositor mỗi phía
- [ ] Toàn bộ golden-frame (bao gồm title từ T3) byte-identical trước/sau
- [ ] Thêm 1 template mới **không cần sửa code**, chỉ cần 1 `CompositionSpec` mới — chứng minh bằng cách thực sự thêm 1 template thử nghiệm rồi xoá lại
- [ ] Commit `p4-t10: composition spec — data-driven layout compositor, 2-sided`

---

## T11 — `@audiogram/renderer` package split (½ ngày, làm ngay sau T10)

**Tham chiếu:** `PACKAGE_SPLIT_PLAN.md` §3.2, §6 đợt 3 ("cùng nhát dao" với CompositionSpec).

**Các bước:**
1. Tách phần compositor thuần (từ T10) + phần vẽ waveform/DC thuần khỏi `domain/preview/renderer.ts` thành `packages/renderer/` — không gồm React wrapper (`PreviewCanvas.tsx` giữ nguyên, chỉ đổi import) hay bất kỳ I/O nào (AudioEngine, Tauri).
2. `apps/desktop` + package mới đều phải qua `@audiogram/contract` cho hằng số — không chép lại.
3. Theo `PACKAGE_SPLIT_PLAN.md`'s cột mốc: `npm test -w @audiogram/renderer` (hoặc tên tương đương) chạy độc lập không cần Tauri/webview.

**Nghiệm thu:**
- [ ] `apps/desktop/src/domain/preview/renderer.ts` không còn tồn tại, logic đã chuyển hết vào package mới, `PreviewCanvas.tsx` chỉ import
- [ ] ESLint/ cargo-deny xác nhận không package nào import ngược `apps/desktop`
- [ ] Commit `p4-t11: extract @audiogram/renderer (compositor + waveform draw, no React/IO)`

---

## T12 — Extension Cấp 1: load JSON động + Settings panel (1.5 ngày, phụ thuộc T10)

**Tham chiếu:** `TECH_ARCHITECTURE.md` §3.4.

**Các bước:**
1. Backend: 1 command Rust nhỏ đọc `app_data_dir/extensions/*.audiogram-ext.json` (hoặc dùng `plugin-fs` scope hẹp thẳng từ frontend nếu đủ quyền — kiểm tra permission cần thêm vào `capabilities/default.json` giống P3-T12 đã làm cho notification).
2. Frontend: `zod` (dependency mới — kiểm tra chưa có trong `package.json`) validate từng file khớp `TemplateExtension`/`PaletteExtension` shape; lỗi → toast (dùng lại T5) + bỏ qua file đó, không crash.
3. **Settings UI hoàn toàn chưa tồn tại** (không có menu item, không có route) — đây là phần việc thật sự mới, không phải "thêm vào chỗ có sẵn": cần 1 entry point (menu native `Audiogram > Settings…` hoặc `⌘,`), 1 `Modal`/màn hình riêng liệt kê extension đã load + nút "Reveal folder" (`ipc.openFolder`, đã có).
4. `wavePoint`/`templatePoint`/`palettePoint` (kernel đã có từ P2-T1) — extension động register vào cùng registry, `onChange()` callback đã có sẵn để gallery re-render.

**Nghiệm thu:**
- [ ] Thả 1 file `.audiogram-ext.json` hợp lệ vào thư mục → mở Settings → thấy trong danh sách → template/palette xuất hiện trong gallery tương ứng
- [ ] File JSON sai schema → toast lỗi, app không crash, extension khác vẫn load bình thường
- [ ] Commit `p4-t12: load Cấp 1 extensions from app_data_dir + Settings panel`

---

## T13 — `audiogram-cli` (F8, KHÔNG bắt buộc) (1.5–2 ngày)

**Tham chiếu:** `OPTIMIZATION_PLAN.md`'s F8; `PACKAGE_SPLIT_PLAN.md` §5.

**Ghi chú:** Task này nằm ngoài đường găng — chỉ làm nếu còn ngân sách sau T1–T12, hoặc nếu có nhu cầu thật (batch render / CI headless). Không chặn việc đóng Phase 4.

**Các bước:**
1. `crates/audiogram-render` đã thuần (không Tauri) từ Phase 1 — thêm 1 `main.rs` mới (crate riêng `apps/cli/` hoặc `crates/audiogram-cli/`) với arg parsing (`clap`) + phần spawn ffmpeg (hiện nằm trong `apps/desktop/src-tauri/src/infrastructure/ffmpeg/render/mod.rs` — cần tách phần không phụ thuộc Tauri `AppHandle`/`ProgressSink` cụ thể ra chỗ dùng chung được).
2. Input: audio path + JSON config (canvasSize/fps/layout/wave style/title/zones) hoặc flags tương ứng.
3. Dùng `NullSink`/`ProgressSink` đã có sẵn từ `audiogram-render`.

**Nghiệm thu:**
- [ ] `cargo run -p audiogram-cli -- --audio foo.mp3 --layout minimal --out foo.mp4` render ra video đúng, không cần mở GUI/webview
- [ ] Commit `p4-t13: audiogram-cli — headless render entry point (F8)`

---

## T14 — Đóng Phase 4 (½ ngày)

**Các bước:**
1. ADR bổ sung trong `docs/adr/` (tiếp số từ 6 ADR của `p3-t14`):
   - `0007-font-mapping-decision.md` (kết quả T1)
   - `0008-composition-spec.md` **nếu Block D được làm** — ghi rõ đã làm hay tiếp tục hoãn, và vì sao
   - `0009-undo-redo-scope.md` (2 scope nào được cover, vì sao playback/render không nằm trong đó)
2. Cập nhật `CLAUDE.md`: mục Parity (subtitle zones giờ cũng là hợp đồng thật — T2), cây thư mục nếu có package mới (`packages/renderer/`, `apps/cli/` — chỉ nếu Block D chạy).
3. Audit parity cuối kỳ giống `p3-t14` bước 3: export 1 video ở commit đóng Phase 3 và 1 video sau `p4-t4` (đóng Block A) với cùng input — khác biệt **hợp lệ**: font (nếu T1 chọn (a)), subtitle box theo zone (T2), fullbg title (nếu T4 chọn (a)). Khác biệt ngoài danh sách ⇒ dừng điều tra.
4. Cập nhật 2 memory file đã lỗi thời phát hiện trong lúc soạn kế hoạch này — `known_issues_techdebt.md` (hầu hết mục đã fix qua Phase 1–3, chỉ còn "download model curl" — đã fix — và vài mục khác cần verify lại) và `project_roadmap.md` (react-rnd + rustfft đã xong, chỉ còn "whisper-rs native bindings" còn đúng).

**Nghiệm thu:**
- [ ] `npm run ci` xanh từ máy sạch
- [ ] ADR mới đọc hiểu trong 1 phút mỗi cái
- [ ] Audit video before/after ghi rõ từng khác biệt và lý do
- [ ] 2 memory file đã cập nhật hoặc xác nhận vẫn đúng
- [ ] Commit `p4-t14: ADRs, docs update, phase 4 close-out`

---

## B. Tổng ngân sách & cách giao việc

| Milestone | Tasks | Ước lượng | Bắt buộc? |
|---|---|---|---|
| M0 đóng Phase 3 | `p3-t14` (nếu chưa chạy) | ¾ ngày | **Có** |
| M1 nợ kỹ thuật (Block A) | T1–T4 | 2–2.25 ngày | **Có** |
| M2 empty/error + polish (Block B) | T5–T7 | 1.75 ngày | **Có** |
| M3 session + undo (Block C) | T8–T9 | 2.5 ngày | **Có** |
| M4 kiến trúc chiến lược (Block D) | T10–T13 | 5.5–6.25 ngày | Tùy chọn (khuyến nghị chỉ T10+T11 nếu làm) |
| M5 đóng Phase 4 | T14 | ½ ngày | **Có** |
| **Tổng lõi (M0–M3, M5, không Block D)** | 10 task | **~7.5–8.25 ngày** | |
| **Tổng đầy đủ (kèm Block D)** | 14 task | **~13–14.5 ngày** | |

**Prompt template giao từng task cho Sonnet:**

> Đọc `PHASE4_TASKS.md` mục §0 (phát hiện) + §A (luật chung) + task T\<n\>. Đọc thêm các mục được task trỏ tới trong `UI_DESIGN_SPEC.md` / `TECH_ARCHITECTURE.md` / `UI_REBUILD_PLAN.md` / `PACKAGE_SPLIT_PLAN.md`, và code tại file/dòng task chỉ đích danh. Thực hiện đúng phạm vi T\<n\>. Golden-frame đỏ → xem ảnh diff trước (luật §A.3), không regenerate mù. Chạy đủ nghiệm thu chung (§A.2) + nghiệm thu riêng, báo cáo từng checkbox. Kẹt theo luật §A.5 thì dừng và hỏi — đặc biệt T1 (quyết định font) và toàn bộ Block D (quyết định có làm hay không) là những chỗ cần người quyết định trước khi code.

**Điều kiện đóng Phase 4 (lõi, không tính Block D):**
- [ ] `p3-t14` đã chạy (hoặc gộp làm `p4-t0`)
- [ ] 9 task Block A/B/C/T14 commit đủ, `npm run ci` xanh
- [ ] F-1 đến F-5 ở §0 đã giải quyết hoặc có ADR ghi rõ lý do hoãn tiếp
- [ ] Golden-frame phủ cả title/caption text, không chỉ hình học
- [ ] Session tự khôi phục lúc mở app; undo/redo hoạt động cho design + caption text edits
- [ ] Không còn effect/style nào phá bất biến preview↔export (F-6's luật vẫn còn hiệu lực)
