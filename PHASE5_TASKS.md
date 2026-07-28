# Phase 5 — Task plan chi tiết (giao cho Sonnet thực thi)
*Ngày lập: 28/07/2026 · Sửa đổi lớn cùng ngày sau rà soát (xem §0.2) · Nguồn: `SCENE_GRAPH_REBUILD_PLAN.md` v2 (toàn bộ) + `PACKAGE_SPLIT_PLAN.md` §3.1*
*Điều kiện vào: Phase 4 đã đóng (commit `dde11b2`, xem `docs/archive/PHASE4_TASKS.md`).*

---

## 0.1 Phạm vi thật của tài liệu này (ĐỌC TRƯỚC)

`SCENE_GRAPH_REBUILD_PLAN.md` §10 mô tả 2 khối lớn: scene graph (mô hình dữ liệu + renderer node-based) và GPU/preview-streaming. Tài liệu này chi tiết hoá **M0 + M1 — scene graph chạy đầy đủ trên 2 renderer CPU hiện có, chưa đụng GPU** — vì đây là phần không có ẩn số kỹ thuật. M2 (port GPU thật, preview streaming) phụ thuộc kết quả spike T1 và sẽ có `PHASE6_TASKS.md` riêng.

**Quyết định trình tự:** xây node-based renderer trên cả 2 renderer CPU hiện có trước (TS Canvas2D + Rust CPU), chứng minh mô hình `SceneNode`/`timing`/`animIn-animOut`/`group` chạy đúng — **rồi mới** port GPU ở M2. Lý do: 2 rủi ro độc lập (mô hình dữ liệu đúng không; GPU pipeline chạy được không) — tách ra để lỗi ở đâu biết ngay ở đó.

**Cái giá của quyết định này, nói thẳng:** M1 bắt buộc port mọi node type sang **cả TS lẫn Rust** (T3, T4, và port đôi ở T8 anim presets, T11 evaluator). Khi M2 chuyển preview sang stream frame từ Rust, **toàn bộ nhánh TS đó thành rác — khoảng 4–5 ngày công cố ý vứt đi.** Đổi lại: M1 giao được giá trị cho người dùng ngay cả khi T1 cho kết quả no-go, và không bao giờ có giai đoạn app không chạy được. Nếu T1 xong sớm và cho go rõ ràng, **được phép đề xuất đảo thứ tự** (làm preview streaming trước, chỉ viết node renderer 1 lần bằng Rust) — đây là quyết định sản phẩm, báo lại chứ không tự đổi.

## 0.2 Những gì đã sửa sau rà soát (bản đầu tiên trong ngày có 4 lỗ hổng)

| Lỗ hổng của bản đầu | Sửa thành |
|---|---|
| 🔴 Không task nào đưa `nodes` vào `RenderJob`/export path — **lặp lại đúng bẫy P-1 cũ** ("zones không bao giờ được gửi sang Rust, kéo thả không ảnh hưởng video export", `docs/archive/PHASE3_TASKS.md` §0) | **T5 mới**, đặt ngay sau T4 |
| 🔴 Mâu thuẫn caption chưa giải quyết: `boundToTranscript` hàm ý node renderer, nhưng export vẫn burn libass | Chốt ở `SCENE_GRAPH_REBUILD_PLAN.md` §5b + **T14 mới** có ngân sách riêng |
| 🔴 Use case trung tâm ("sticker hiện từ giây X-Y") bị đưa vào UI tệ nhất (2 ô nhập số) | **T9 mới** — timeline 1 track, đã sửa phạm vi ở plan §8 |
| 🔴 Layers panel mâu thuẫn định vị "người không rành thiết kế" | Ràng buộc `SCENE_GRAPH_REBUILD_PLAN.md` §7b + nghiệm thu bắt buộc ở T7, T18 |
| 🟡 Asset lifecycle bỏ trống; sticker `assetId` trỏ tới bộ chưa ai tạo | **T15 mới** |
| 🟡 Undo/redo bị nhét 1 dòng vào task dọn dẹp | **T16 mới** |
| 🟡 Không có ngân sách hiệu năng | `SCENE_GRAPH_REBUILD_PLAN.md` §5c + luật §A.9 |
| 🟡 Thiếu phím tắt, empty/error state | Gộp vào T16 (phím tắt) và từng task tương ứng (state) |

**Về ước lượng — cảnh báo dựa trên chính lịch sử repo này:** `docs/archive/PHASE3_TASKS.md` tự ghi "Phase 1 ước 2–3 ngày → thực 14–16; Phase 2 ước 3–4 → thực 12 task". Con số dưới đây lập theo cùng kiểu suy đoán, **nên coi là sàn chứ không phải trần**. Task rủi ro nhất về ước lượng: T13 (video decode), T14 (bỏ libass), T16 (undo).

---

## A. LUẬT CHUNG cho mọi task (executor PHẢI đọc trước khi làm bất kỳ task nào)

1. **Một task = một commit.** Message: `p5-t<số>: <mô tả ngắn>`.
2. **Sau MỖI task chạy đủ 6 lệnh nghiệm thu chung:**
   ```bash
   # từ apps/desktop
   npm run typecheck
   npm run lint                        # 0 error
   npm run test
   # từ repo root
   npm test
   cargo check --workspace
   cargo test --workspace              # BAO GỒM golden_frames
   ```
3. **Golden-frame test là cổng chặn.** Khác đổi ⇒ xoá PNG bị ảnh hưởng → regenerate → **xem ảnh diff bằng mắt** → commit kèm, ghi rõ vì sao frame đổi. Cấm regenerate mù.
4. **CẤM sửa hằng số render đang có** (`WAVE_BARS`, `BAR_FILL`, `GAP_FILL`, `EQ_BANDS`...) — chỉ **thêm** hằng số mới qua `contract/`.
5. **Song song, không big-bang:** đường render cũ (6 hàm `drawX` / 6 match-arm) **giữ nguyên, tiếp tục chạy** tới T18. Cấm xoá sớm.
6. **Mỗi task đụng renderer PHẢI kiểm chứng cả 2 đầu: preview VÀ file video xuất ra thật.** Không được nghiệm thu chỉ bằng preview — đây chính là loại lỗi P-1 lịch sử (tính năng chỉ đổi preview, không đổi video). Từ T5 trở đi, mọi task có phần "Nghiệm thu" đều phải export 1 video thật để xác nhận.
7. **Ràng buộc sản phẩm (`SCENE_GRAPH_REBUILD_PLAN.md` §7b):** không task nào được làm luồng "chọn template → xong" trở nên nhiều bước hơn hiện tại. Tính năng mới là **cộng thêm**, không thay thế đường nhanh.
8. **Khi kẹt >30 phút** ở quyết định không có trong spec: dừng, ghi `// TODO(p5-tX): <câu hỏi>`, báo lại, KHÔNG tự phát minh hướng khác.
9. **Ngân sách hiệu năng (`SCENE_GRAPH_REBUILD_PLAN.md` §5c) là điều kiện pass/fail.** Task nào có dòng budget tương ứng thì phải **đo và ghi số thật** vào báo cáo, không ước lượng. Vượt budget ⇒ dừng, báo lại.
10. Code + comment tiếng Anh. UI string tiếng Anh.
11. Đường dẫn viết tắt tính từ `apps/desktop/` trừ khi ghi `packages/`, `crates/`, `contract/`.

**Thứ tự bắt buộc & phụ thuộc:**

```
T1 (GPU spike — độc lập, song song, KHÔNG chặn gì)

T2 (schema) ──► T3 (TS node renderer) ──► T4 (Rust node renderer) ──► T5 (nodes qua RenderJob + EXPORT) 🔴
            └──► T6 (store + session migration)
T5,T6 ──► T7 (Layers panel + inspector + GIỮ ĐƯỜNG NHANH)
T4,T5 ──► T8 (timing + animIn/animOut, 2 renderer) ──► T9 (timeline 1 track UI) 🔴
T7,T8 ──► T10 (group/Composite)
T8    ──► T11 (keyframes nâng cao)
T8    ──► T12 (intro/outro)
T5    ──► T13 (video nền)
T5,T8 ──► T14 (captions → text node, bỏ libass) 🔴
T7    ──► T15 (asset lifecycle + bộ sticker)
T7,T10 ──► T16 (undo/redo cho nodes + phím tắt)
T4..T14 ──► T17 (golden-frame rewrite theo node)
T17   ──► T18 (xoá đường cũ, ADR-0009, đóng M1)
```

Milestones: **M0** = T1 (song song, ngoài critical path) · **M1a** = T2–T7 (schema + renderer + export path + UI tối thiểu) · **M1b** = T8–T16 (timing/timeline/group/keyframe/intro-outro/video/caption/asset/undo) · **M1c** = T17–T18 (golden rewrite + dọn + đóng).

**Quyết định đã chốt trước khi bắt tay (KHÔNG mở lại):**

| Câu hỏi | Quyết định | Lý do |
|---|---|---|
| GPU port làm cùng lúc với node model? | **KHÔNG** — tách 2 milestone (§0.1) | 2 rủi ro khác nhau, trộn lại thì lỗi không quy được về đâu |
| `timing`+`animIn/animOut` hay `keyframes` là cơ chế chính cho show/hide? | **`timing`+`animIn/animOut`** | Plan §5; `keyframes` chỉ là lớp nâng cao |
| **Caption: text node hay giữ libass?** | **Text node, BỎ libass khỏi burn-in** (T14) | Plan §5b — không thể có ngoại lệ trong kiến trúc "1 renderer"; nền Rust text đã có sẵn từ P3 |
| `.srt`/`.ass` còn ghi ra file không? | **CÓ, giữ nguyên** — `crates/audiogram-subtitle` không bị xoá | Đó là tính năng sản phẩm (export phụ đề riêng), độc lập với việc burn-in |
| **Timeline 1 track cho timing?** | **CÓ LÀM** (T9) — sửa so với bản đầu | Plan §8 — timeline 1 track ≠ multi-clip NLE; use case trung tâm cần nó |
| Video nền cần GPU mới làm được? | **KHÔNG** — pre-decode thành chuỗi ảnh, renderer hiện tại vẽ như ảnh đổi theo frame index | Tách khỏi rủi ro GPU; texture cache thật để dành M2 |
| Multi-clip/track/transition | **KHÔNG** | Plan §8 — vẫn là podcast editor (plan §0) |
| Layers panel thay thế template flow? | **KHÔNG** — Layers là lớp mở ra khi cần, template vẫn là điểm vào mặc định | Plan §7b — ràng buộc sản phẩm |

---

## T1 — GPU foundation spike (go/no-go, không chặn task khác) (2–3 ngày)

**Tham chiếu:** `SCENE_GRAPH_REBUILD_PLAN.md` §10 Phase 0, §11.
**Mục tiêu:** trả lời dứt điểm 3 câu hỏi trước khi cam kết dòng code GPU nào ở M2: (a) wgpu headless render ra buffer đúng nội dung; (b) chạy được trên CI `macos-latest`; (c) sai biệt so với CPU rasterize ở mức chấp nhận được.

**Các bước:**
1. Crate thử nghiệm **tách biệt hoàn toàn** (`crates/gpu-spike/`, không thêm vào `[workspace] members` chính thức). **Cấm sửa `audiogram-render`** ở task này.
2. Dựng context `wgpu` headless (`request_adapter` + `request_device`, render target = texture offscreen, không `Surface`/swapchain).
3. Render **đúng 1 frame tĩnh hiện có**: layout `minimal`, wave style `bar`, không title/subtitle/avatar — dùng input y hệt 1 golden PNG đã commit (`crates/audiogram-render/tests/golden/`) để có baseline thật, không tự bịa input.
4. Readback GPU→CPU (staging buffer) → ghi PNG.
5. So với golden CPU bằng SSIM (crate `image-compare` hoặc tương đương) — ghi **số thật** + ngưỡng đề xuất kèm lý do.
6. Chạy spike trong 1 GitHub Actions job tạm (branch riêng, **không merge** vào `ci.yml`) trên `macos-latest` — xác nhận build + chạy headless không lỗi driver/Metal.
7. Đo thời gian render 1 frame GPU vs CPU ở 1080p — ghi số (dữ liệu đầu vào cho quyết định M2, budget plan §5c).
8. Ghi `docs/adr/0010-gpu-decision.md` (draft, chưa Accepted): Context = 3 câu hỏi, Decision = go/no-go + lý do, Consequences = M2 cần làm khác gì so với dự kiến.

**Nghiệm thu:**
- [ ] SSIM GPU-vs-CPU đo được, ghi **số thật**
- [ ] Xác nhận chạy được (hoặc KHÔNG, ghi rõ lỗi) trên CI job tạm macos-latest
- [ ] Thời gian render/frame GPU vs CPU ghi số thật
- [ ] `docs/adr/0010-gpu-decision.md` có kết luận go/no-go rõ ràng kèm số liệu
- [ ] Nếu **no-go**: ghi phương án thay thế (ở lại CPU vĩnh viễn / giảm phạm vi GPU) — **báo lại, không tự chốt** (quyết định sản phẩm)
- [ ] Xoá crate/branch spike sau khi có kết luận
- [ ] Commit `p5-t1: GPU foundation spike — go/no-go decision (see ADR-0010 draft)`

---

## T2 — Scene graph schema qua `contract/` codegen (1.5 ngày)

**Tham chiếu:** `SCENE_GRAPH_REBUILD_PLAN.md` §3.

**Các bước:**
1. `contract/scene_schema.json` mô tả `SceneNode`, `Transform`, `KeyframeTrack`, `Easing`, `AnimationId`, `Project.introDuration`/`outroDuration`, và toàn bộ `*Props` (bao gồm `VideoProps`). Copy nguyên literal từ plan §3, **không tự đổi tên field**.
2. Mở rộng `contract/codegen.mjs` sinh:
   - TS: `packages/contract/src/index.ts` — interface + union type.
   - Rust: `crates/audiogram-core/src/contract_gen.rs` — struct + enum, derive `Serialize/Deserialize/specta::Type` như các struct đã sinh.
3. `apps/desktop/src/types.ts`: re-export `SceneNode` v.v. từ `@audiogram/contract`; **giữ nguyên** `LayoutZones`/`LAYOUT_TEMPLATES` cũ (đường cũ sống tới T18).
4. `crates/audiogram-core/src/entities/scene_node.rs`: `impl SceneNode { fn effective_transform(&self, parent: Option<&Transform>) -> Transform }` — compose cha⊗con. Viết ở đây, **KHÔNG** trong `frame.rs` (giữ ranh giới domain/infra).
5. Test:
   - TS: round-trip serialize/deserialize 1 node mẫu **mỗi type** (kể cả `group`, `video`).
   - Rust: `effective_transform` compose đúng cho group + con — tính tay giá trị kỳ vọng để so (ví dụ con `{x:.1,y:.1,w:.5,h:.5}` trong group `{x:.2,y:.2,w:.4,h:.4}`).
   - Rust: **decompose round-trip** — compose rồi decompose trả về đúng transform gốc (đây là bảo hiểm cho T10 ungroup).

**Nghiệm thu:**
- [ ] `npm run contract:gen` sinh 2 phía không lỗi; `cargo check --workspace` sạch
- [ ] Test round-trip TS (mọi type) + compose/decompose Rust xanh
- [ ] `LayoutZones`/6 template cũ nguyên vẹn
- [ ] Commit `p5-t2: scene graph schema (SceneNode/Transform/KeyframeTrack) via contract codegen`

---

## T3 — TS node renderer (Canvas2D), song song `drawX` cũ (2 ngày)

**Tham chiếu:** plan §4; `domain/preview/renderer.ts` hiện có.

**Các bước:**
1. `domain/preview/nodeRenderer.ts` (file mới, **KHÔNG sửa** `renderer.ts`): `drawSceneFrame(ctx, W, H, nodes: SceneNode[], t: number, shared)`.
   - Lọc node hiển thị tại `t` (T8 mới thêm điều kiện `timing` thật; task này filter luôn true).
   - Sort theo `z`.
   - Dispatch theo `type`.
2. `domain/preview/nodeRenderers/{waveform,text,image}.ts` — registry `NODE_RENDERERS` (khuôn `WAVE_EFFECTS`):
   - waveform: gọi thẳng `WAVE_EFFECTS[style].draw(...)` đã có, **không viết lại**.
   - text: tổng quát hoá logic đo/wrap của `drawTitle` hiện có, nhận `TextProps` trực tiếp (bỏ phần cứng theo layout).
   - image: như `coverImg` hiện tại nhưng theo `transform` của node.
3. `renderer.ts` **không đổi**. Thêm cờ tạm `useNodeRenderer` (field store tạm hoặc `import.meta.env`), mặc định `false`, để `PreviewCanvas`/`thumbnailer` gọi đường mới có điều kiện — phục vụ so sánh 2 đường trên cùng máy trong T3–T10. **Cờ này bị xoá ở T18** (không được ship).
4. **Test parity nội bộ (quan trọng nhất của task):** `domain/preview/__tests__/nodeRenderer.test.ts` — dựng danh sách node tương đương **chính xác** template `minimal` (1 waveform + 1 title, transform y hệt zone cũ), render qua cả `drawFrame` cũ và `drawSceneFrame` mới vào 2 canvas → so pixel, **phải khớp**.
5. **Đo hiệu năng (budget plan §5c):** scene 20 node ở 1080p, ghi ms/frame vào báo cáo. Budget ≤ 16 ms.

**Nghiệm thu:**
- [ ] Test parity cũ-vs-mới cho `minimal` khớp pixel
- [ ] Bật cờ thủ công → preview hiện đúng như trước (không lệch mắt thường)
- [ ] Đường cũ không đổi hành vi
- [ ] **Số ms/frame với 20 node ghi vào báo cáo, ≤ 16 ms**
- [ ] Commit `p5-t3: TS node renderer (Canvas2D) alongside legacy drawX, behind flag`

---

## T4 — Rust node renderer (CPU), song song 6 match-arm cũ (2 ngày)

**Tham chiếu:** T3 (làm sau, port logic đã proven ở TS); `crates/audiogram-render/src/frame.rs`.

**Các bước:**
1. `crates/audiogram-render/src/scene_frame.rs` (mới): `render_scene_frame_into(buf, w, h, nodes: &[SceneNode], t: f32, ...)` — cùng cấu trúc lọc/sort/dispatch như T3. **KHÔNG sửa** `render_frame_into` cũ.
2. Tái dùng: waveform → `wave::render_wave`; text → `text::draw_text` (cosmic-text) tổng quát hoá theo `TextProps` thay vì `TitleSpec`; image → `pixel::draw_image_cover_*`.
3. Test parity Rust cũ-vs-mới cho input tương đương `minimal`: **byte-identical, hoặc SSIM ≥ 0.99 kèm giải thích rõ vì sao không byte-identical**.
4. **Đo hiệu năng:** ms/frame với 20 node ở 1080p, ghi số.

**Nghiệm thu:**
- [ ] Test parity Rust cũ-vs-mới khớp (byte-identical hoặc SSIM có số + lý do)
- [ ] `render_frame_into` cũ không đổi; **mọi golden hiện có vẫn xanh nguyên** (T4 không được làm đổi golden nào)
- [ ] Số ms/frame ghi vào báo cáo
- [ ] Commit `p5-t4: Rust node renderer (CPU) alongside legacy frame.rs match arms`

---

## T5 🔴 — `nodes` đi qua `RenderJob`; export dùng node renderer (1.5 ngày)

**Tham chiếu:** bài học lịch sử P-1 (`docs/archive/PHASE3_TASKS.md` §0 — "zones không bao giờ được gửi sang Rust ⇒ editor chỉ đổi preview, không đổi video"). **Task này tồn tại để không lặp lại đúng lỗi đó.** Luật §A.6.

**Các bước:**
1. `RenderJobDto` (`crates/audiogram-core/src/entities/render_job.rs`) thêm `pub nodes: Option<Vec<SceneNode>>`; `RenderJob` thêm `pub nodes: Option<Vec<SceneNode>>`, resolve trong `TryFrom`. `None` = dùng đường cũ (tương thích ngược, bắt buộc tới T18).
2. `infrastructure/ffmpeg/render/mod.rs`: nếu `job.nodes.is_some()` → gọi `render_scene_frame_into` (T4); ngược lại giữ `render_frame_into` cũ. Đây là **công tắc thật của toàn bộ Phase 5** — mọi task sau đó tự động tới được video xuất ra.
3. Frontend: `useRenderExport`/`ExportSheet` gửi `nodes` khi cờ `useNodeRenderer` bật. Type tự cập nhật qua `bindings.gen.ts` sau `cargo run`.
4. Nếu `nodes` có node tham chiếu file (image/video) — resolve path + decode ở **Stage 1** của pipeline (cùng chỗ FFT precompute + cover image hiện tại), **không** decode trong vòng lặp frame.
5. Test Rust: `render_job_accepts_nodes` — DTO có `nodes` → `RenderJob.nodes` đúng; DTO không có → `None`.
6. **Kiểm chứng end-to-end thật (không thể thay bằng unit test):** bật cờ, thêm 1 text node lệch hẳn vị trí so với template, **export video thật**, mở file, xác nhận text nằm đúng chỗ đã đặt.

**Nghiệm thu:**
- [ ] `grep -n "nodes" crates/audiogram-core/src/entities/render_job.rs` có field mới
- [ ] **Export video thật với node tuỳ chỉnh → video khớp preview** (chụp preview + frame video so cạnh nhau, đính vào báo cáo)
- [ ] `nodes: None` → video xuất ra **byte-identical** với trước task này (đường cũ không đổi)
- [ ] Golden hiện có vẫn xanh
- [ ] Commit `p5-t5: send nodes through RenderJob, wire scene renderer into the export path`

---

## T6 — Store + session migration sang `nodes[]` (1.5 ngày)

**Tham chiếu:** plan §9.

**Các bước:**
1. `store/design.slice.ts`: thêm `nodes: SceneNode[]` + `selectedNodeIds: string[]` (mảng — chuẩn bị multi-select T10). **Giữ nguyên** field cũ tới T18.
2. `domain/scene/fromLegacy.ts`: hàm thuần `buildNodesFromLegacy(state): SceneNode[]` — dựng node tương đương từ field cũ (waveform theo `zones.waveform`/`waveStyle`/`waveColor`; title theo `zones.title`/`title`/`titleColor`/...; optional avatar/subtitle). Test với input mẫu thật từ 1 session hiện có.
3. `core/persistence/migrations.ts`: bước migration mới — session cũ (không có `nodes`) → gọi `buildNodesFromLegacy`. **Field cũ giữ nguyên trong session**, cả 2 cùng tồn tại tới T18.
4. **Migration phải idempotent** — chạy 2 lần không sinh node trùng (test riêng).
5. Test: load session `v(n-1)` mẫu → `nodes` đúng, field cũ không đổi.

**Nghiệm thu:**
- [ ] Mở project tạo trước Phase 5 → `store.nodes` sinh đúng; UI cũ chạy y hệt trước
- [ ] Test migration + test idempotent xanh
- [ ] Commit `p5-t6: design.slice nodes[] + session migration from legacy fields`

---

## T7 — Layers panel + node inspector + GIỮ ĐƯỜNG NHANH (2.5 ngày)

**Tham chiếu:** plan §9 **và §7b (ràng buộc sản phẩm — phần quan trọng nhất của task này)**.

**Các bước:**
1. `features/design/LayersPanel.tsx` — danh sách `nodes`: icon theo `type`, tên (role/label), toggle ẩn/hiện, đổi `z` (nút up/down trước; drag-reorder nếu còn thời gian).
2. Nút `+ Text` / `+ Image` / `+ Sticker` — tạo node mới, transform mặc định giữa canvas, `z` = max+1, mở Inspector cho node đó. (`+ Video Background` ở T13.)
3. `features/design/NodeInspector.tsx` — property theo `node.type`: text (nội dung/màu/font/size/align/bold/italic); image (chọn file/fit/shape). Bản thu gọn của `DesignInspector` cũ, áp cho node.
4. `CanvasStage.tsx`: overlay mới hiện `nodes` (dùng `drawSceneFrame` T3), click chọn node → `selectedNodeIds`. **Không xoá** overlay/zone Rnd cũ — 2 hệ song song, vào tính năng mới qua 1 cửa riêng ("Try new layers (beta)" trong toolbar). **Cửa beta này bị xoá ở T18, không được ship.**
5. **🔴 GIỮ ĐƯỜNG NHANH (plan §7b, luật §A.7):**
   - Template gallery vẫn là điểm vào mặc định, chọn template = ra kết quả hoàn chỉnh, **0 thao tác thêm**.
   - Layers panel **mặc định đóng/thu gọn**, không đập vào mắt lần đầu mở app.
   - Không thêm bước nào vào luồng hiện tại: mở file → chọn template → export.
6. **Empty state:** Layers panel khi chưa có node tuỳ chỉnh → hiện gợi ý ngắn ("Add text, images or stickers on top of your template"), không phải panel trống trơn.

**Nghiệm thu:**
- [ ] Thêm/xoá/chọn/đổi z-order node hoạt động; sửa property cập nhật ngay trên canvas
- [ ] **🔴 Test người dùng thật (plan §7b mục 4): đưa app cho người chưa từng dùng, yêu cầu "tạo audiogram từ file audio này" — xong mà KHÔNG mở Layers panel lần nào.** Ghi lại số bước họ đi và so với số bước trước Phase 5 (không được nhiều hơn).
- [ ] Luồng Design mode hiện tại (field cũ, 6 template) không bị ảnh hưởng
- [ ] Commit `p5-t7: Layers panel + node inspector, template fast-path preserved`

---

## T8 — `timing` + `animIn`/`animOut` (2 renderer) (1.5 ngày)

**Tham chiếu:** plan §5.

**Các bước:**
1. Cả `nodeRenderer.ts` (T3) và `scene_frame.rs` (T4): lọc node theo `timing` thật (`t < start || t > end` ⇒ bỏ qua; absent = luôn hiện).
2. Registry `ANIM_PRESETS` (khuôn `WAVE_EFFECTS`) — 4 preset (`fade`, `slide-up`, `slide-down`, `scale-in`), mỗi preset là hàm `(tRelative: 0..1) => Partial<Transform>` áp lên transform gốc trước khi vẽ.
   - Đây LÀ chỗ buộc phải port tay 2 lần (TS + Rust) — chỉ 4 hàm toán đơn giản. **Test parity số học** so giá trị tại `tRelative` ∈ {0, 0.25, 0.5, 0.75, 1} giữa 2 bản, sai số < 1e-6.
3. Inspector (T7) thêm section "Timing": 2 field số (start/end giây) + 2 dropdown preset + field duration hiệu ứng. *(UI kéo thả thật ở T9 — task này chỉ cần đủ để test.)*
4. **Edge case bắt buộc xử lý:** `end < start` (chặn ở UI + clamp ở renderer); `timing` vượt quá độ dài video (clamp); `animIn.duration` dài hơn cả khoảng `[start,end]` (clamp về nửa khoảng).

**Nghiệm thu:**
- [ ] Đặt `timing` → node biến mất/xuất hiện đúng giây khi tua preview
- [ ] `animIn: fade` → fade-in mượt
- [ ] Test parity số học TS-vs-Rust ở 5 mốc xanh
- [ ] 3 edge case trên xử lý đúng, có test
- [ ] **Export video thật (luật §A.6): node có `timing` xuất hiện/biến mất đúng giây trong file mp4**
- [ ] Commit `p5-t8: timing window + animIn/animOut presets (both renderers)`

---

## T9 🔴 — Timeline 1 track cho `timing` (2 ngày)

**Tham chiếu:** plan §8 (đã sửa phạm vi: timeline 1 track ≠ multi-clip NLE) — **đây là UI cho use case trung tâm người dùng nêu ("sticker hiện từ giây X đến giây Y"), không phải nice-to-have.**

**Các bước:**
1. `features/design/TimingTimeline.tsx` — dải ngang **dưới canvas** (hoặc mở rộng transport bar hiện có; quyết định lúc thực thi, ghi lý do), dùng chung trục thời gian với transport (`0 → introDuration + audioDuration + outroDuration`).
2. Mỗi node có `timing` = 1 thanh ngang; node không có `timing` = thanh full-width mờ (nghĩa là "luôn hiện"). Node đang chọn được highlight.
3. **Tương tác cốt lõi:** kéo thân thanh = dịch cả khoảng; kéo 2 mép = đổi `start`/`end`; **snap** vào playhead + đầu/cuối video + mép các thanh khác (±8px, đúng convention snap đã có ở zone editor P2-T7).
4. Hiển thị `animIn`/`animOut` như 2 vùng gradient nhỏ ở 2 đầu thanh — nhìn thấy được độ dài hiệu ứng, kéo mép vùng đó = đổi `duration`.
5. Đồng bộ 2 chiều với field số trong Inspector (T8) — kéo thanh cập nhật field và ngược lại.
6. Số node nhiều: **virtualize hoặc gộp theo nhóm** nếu > 20 thanh (đo trước, chỉ làm nếu cần — ghi kết quả đo).
7. Playhead dùng chung, click vào timeline = seek (đúng hành vi transport hiện có, không phát minh mới).

**Nghiệm thu:**
- [ ] Kéo thanh đổi `timing` thấy ngay trên canvas + preview khi phát
- [ ] Snap hoạt động; kéo 2 mép đổi start/end độc lập
- [ ] Đồng bộ 2 chiều với Inspector
- [ ] **Làm được use case gốc mà không cần gõ số nào:** thêm sticker → kéo thanh để nó hiện từ giây 5 đến giây 12 → export → đúng trong video
- [ ] 20 node: timeline vẫn mượt (đo, ghi số)
- [ ] Commit `p5-t9: single-track timing timeline (drag to set when nodes appear)`

---

## T10 — Group (Composite) (2 ngày)

**Tham chiếu:** plan §6, §11 (rủi ro compose/decompose).

**Các bước:**
1. Multi-select trong Layers panel (⇧+click) + canvas (⇧+click chọn thêm).
2. `⌘G` Group: tạo node `type:'group'`, `parentId` các node chọn = id group mới, `transform` group = bounding-box hiện tại (tính 1 lần lúc tạo). `⇧⌘G` Ungroup: xoá group, `parentId` con = `parentId` cũ của group.
3. Cả 2 renderer: compose transform con = cha ⊗ con — **dùng hàm đã test ở T2**, không viết lại.
4. Canvas: double-click "vào trong" group chọn con riêng (convention Figma/Illustrator).
5. **Test round-trip (quan trọng nhất):** group 3 node → di chuyển group → ungroup → vị trí tuyệt đối 3 node con **không đổi** so với trước khi group.
6. `timing`/`animIn`/`animOut` đặt trên group áp cho cả nhóm — test 1 case: group có `timing`, con không có → cả nhóm ẩn/hiện theo group.
7. **Edge case:** group lồng group (giới hạn độ sâu 3 cấp ở v1, chặn ở UI kèm lý do); xoá group có con (hỏi: xoá cả con hay chỉ ungroup — chọn ungroup rồi xoá group, ghi rõ).

**Nghiệm thu:**
- [ ] Test round-trip group/ungroup không lệch vị trí (test tự động + xác nhận mắt)
- [ ] Di chuyển/animate group áp cho toàn bộ con
- [ ] Double-click chọn được con riêng; group lồng ≤3 cấp
- [ ] **Export video thật: group có timing hoạt động đúng trong mp4**
- [ ] Commit `p5-t10: group/composite nodes (both renderers + Layers UI)`

---

## T11 — `keyframes` nâng cao (tuỳ chọn) (1.5 ngày)

**Tham chiếu:** plan §5 mục 3.

**Các bước:**
1. `evaluator.ts` / `evaluator.rs` (port tay 2 lần + test parity số học như T8): tại `t`, tìm 2 keyframe kề nhau, nội suy theo `easing` của keyframe **bên trái** (quy ước After Effects/Premiere); `hold` = giữ nguyên tới keyframe sau.
2. Inspector: tab "Animate" nâng cao — **chỉ hiện khi user bấm "Add keyframe track"** cho 1 property cụ thể (đúng tinh thần "nâng cao, tuỳ chọn" plan §5, và ràng buộc §7b: không lộ ra mặc định). Mini timeline: dot cho mỗi keyframe, kéo đổi `t`, "+" tại playhead.
3. Giới hạn v1: property `opacity`, `x`, `y` (không `rotation`/`color` — mở rộng sau, không phải rủi ro).
4. Keyframe chỉ áp trong `[timing.start, timing.end]` nếu node có `timing`; không có `timing` → áp suốt video.
5. **Edge case:** 0 keyframe (bỏ qua track); 1 keyframe (giá trị hằng); keyframe trùng `t` (giữ cái sau, cảnh báo dev-mode).

**Nghiệm thu:**
- [ ] 2+ keyframe `opacity` → preview animate đúng easing
- [ ] Test parity evaluator TS-vs-Rust xanh; 3 edge case có test
- [ ] Tab Animate nâng cao **không hiện mặc định**
- [ ] **Export video thật khớp preview**
- [ ] Commit `p5-t11: keyframe evaluator + Animate tab (opacity/x/y)`

---

## T12 — `introDuration`/`outroDuration` (1 ngày)

**Tham chiếu:** plan §3 (đoạn intro/outro), §8.

**Các bước:**
1. `introDuration`/`outroDuration` trong `project.slice` (giây, mặc định `undefined`/0).
2. Tổng thời lượng render = `introDuration + audioDuration + outroDuration`; audio chính bắt đầu tại `t = introDuration`.
   - **⚠️ Đây là chỗ dễ sót nhất của cả Phase:** grep **mọi** chỗ dùng `duration`/`currentTime` liên quan audio gốc — `AudioEngine`, `TransportBar`, `SegmentList` (timestamp caption!), `write_srt`/`write_ass`, export pipeline, `estimate.ts`. Caption timestamp phải cộng offset, nếu không phụ đề lệch đúng bằng `introDuration`.
3. Export: ffmpeg cần audio delay tương ứng (`adelay` filter hoặc offset input) — audio không được bắt đầu từ giây 0 nữa.
4. UI: field số đơn giản trong Inspector Canvas (chưa cần UI timeline riêng — đúng plan §8, không phải "scene"). Timeline T9 tự nhiên hiện vùng intro/outro vì trục thời gian đã bao gồm.
5. Node chỉ hiện lúc intro dùng `timing: {start:0, end: introDuration}` — cơ chế y hệt T8, không code thêm ở renderer.

**Nghiệm thu:**
- [ ] `introDuration = 3` → audio bắt đầu ở giây 3 trong **cả preview lẫn file mp4**
- [ ] **Caption timestamp không lệch** (kiểm tra segment đầu tiên xuất hiện đúng giây trong video xuất ra) — đây là bug dễ xảy ra nhất của task này
- [ ] `introDuration = 0`/`undefined` → hành vi y hệt trước (không breaking), video byte-identical
- [ ] Commit `p5-t12: introDuration/outroDuration project-level timeline offset`

---

## T13 — Node `type: 'video'` (video nền) (2.5 ngày)

**Tham chiếu:** plan §4 (chiến lược decode), §8 (không làm: audio riêng, trim UI), §5c (budget).

**Các bước:**
1. Rust `video_decode.rs`: ffmpeg (bundle sẵn) decode video nền thành chuỗi ảnh ở fps thấp (12–15) + resolution thấp cho preview, cache thư mục temp theo **hash đường dẫn + mtime** (mtime để file đổi thì cache tự vô hiệu). Trả `{ frameDir, totalFrames, fps }`.
2. Renderer (T3+T4): node `type:'video'` vẽ như `image` nhưng chọn ảnh theo `frameIndex = floor(t * fps) % totalFrames` — tái dùng công thức loop của `waveLoop`. Về bản chất là "ảnh, nguồn đổi theo t", không đổi kiến trúc renderer.
3. Command `decode_background_video(path)` — gọi **1 lần** khi chọn video, không mỗi lần render. Có progress event (tái dùng khuôn `render_event` đã có).
4. Export dùng frame ở **resolution đầy đủ** (decode lại ở chất lượng cao lúc export, hoặc decode 1 lần ở chất lượng export và downscale cho preview — chọn phương án, ghi lý do + số đo).
5. UI: `+ Video Background` trong Layers panel (T7) → chọn file → decode (hiện progress) → tạo node.
6. **Dọn cache:** giới hạn dung lượng cache (ví dụ 2 GB, LRU theo mtime), xoá khi project đóng nếu vượt — nếu không sẽ phình vô hạn qua nhiều project.
7. **Error state bắt buộc:** codec không hỗ trợ / file hỏng / decode fail → thông báo người đọc được + nút chọn file khác (không raw ffmpeg error — luật `AppError` đã có). Video quá dài (>10 phút) → cảnh báo dung lượng cache trước khi decode.
8. Test: video ngắn mẫu (thêm vào `test/` cùng `song.m4a`) → decode đúng số frame kỳ vọng.

**Nghiệm thu:**
- [ ] Chọn video nền → preview chạy hình động đúng theo thời gian audio
- [ ] Video ngắn hơn audio → loop mượt, không giật ở điểm nối
- [ ] `muted: true` — không audio nào từ video nền phát ra (kiểm tra cả preview lẫn mp4)
- [ ] **Budget (plan §5c): decode video 60s ≤ 10s; RAM scene 50 node + video ≤ 1 GB — ghi số thật**
- [ ] Error state: thử file .txt đổi đuôi .mp4 → thông báo tử tế, không crash
- [ ] Cache có giới hạn, xoá được
- [ ] **Export video thật có video nền đúng**
- [ ] Commit `p5-t13: background video node type (decode + frame cache, loop, muted)`

---

## T14 🔴 — Captions thành text node, bỏ libass khỏi burn-in (2.5 ngày)

**Tham chiếu:** `SCENE_GRAPH_REBUILD_PLAN.md` §5b (quyết định + lý do đầy đủ). Đảo lại quyết định P3 ("subtitle giữ libass") — đọc §5b hiểu vì sao trước khi làm.

**Các bước:**
1. **Rust: hỗ trợ clip-rect trong `text.rs`/`pixel.rs`** — cần cho karaoke sweep. Thuật toán **đã tồn tại và đã chạy đúng** ở `domain/preview/renderer.ts:182-196` (vẽ text màu mờ, rồi vẽ lại màu karaoke bị cắt theo rect rộng `lw * progress`); port nguyên, không thiết kế lại.
2. Node `type:'text'` với `boundToTranscript: true`: nội dung lấy `activeSeg` theo `t` (logic chọn segment đã có ở adapter `WaveformCanvas`/`PreviewCanvas` — copy, đừng viết lại). Style pill nền (`rgba(0,0,0,0.65)` + roundRect) port từ `drawSubtitle`.
3. Migration: `subtitleColor`/`karaokeColor`/`karaokeEnabled`/`subtitleYPct`/`showSubtitles` → `TextProps` + `transform` của caption node. Mở rộng `buildNodesFromLegacy` (T6).
4. **Bỏ `ass='...'` khỏi filter graph** (`infrastructure/ffmpeg/render/mod.rs:380`) — chỉ khi `job.nodes.is_some()` (đường cũ giữ libass tới T18). Filter còn `format=yuv420p`.
5. **`write_ass`/`write_srt` GIỮ NGUYÊN** — vẫn ghi file phụ đề ra đĩa (tính năng sản phẩm). `crates/audiogram-subtitle` **không xoá**. Chỉ khác: file `.ass` không còn được ffmpeg dùng để burn.
6. **So sánh chất lượng bắt buộc:** export cùng 1 project 2 lần (đường cũ libass vs đường mới node), chụp frame có caption của cả 2, so cạnh nhau — chữ mới **không được xấu hơn rõ rệt** (anti-alias, spacing, vị trí). Nếu xấu hơn → dừng, báo lại (đây là lý do P3 từng hoãn; nếu chất lượng không đạt thì phải bàn lại quyết định §5b).
7. Karaoke: so sweep timing giữa 2 đường ở vài mốc thời gian.

**Nghiệm thu:**
- [ ] Caption hiện đúng trong preview **và** trong mp4 qua node renderer, không qua libass
- [ ] Karaoke sweep đúng tiến độ, so với bản libass ở ≥3 mốc thời gian
- [ ] **Ảnh so sánh chất lượng chữ (libass vs node) đính vào báo cáo, kết luận rõ đạt/không đạt**
- [ ] `.srt`/`.ass` vẫn ghi ra file bình thường
- [ ] `grep -n "ass=" infrastructure/ffmpeg/render/mod.rs` chỉ còn ở nhánh đường cũ
- [ ] Commit `p5-t14: render captions as text nodes, drop libass burn-in (keep .srt/.ass export)`

---

## T15 — Asset lifecycle + bộ sticker (1.5 ngày)

**Tham chiếu:** plan §9 (đoạn asset lifecycle). App hiện chỉ quản 1 audio + 1 cover, đã phải xây "Locate File" (P4-T5) cho 1 file; giờ là N file.

**Các bước:**
1. `core/assets/AssetRepository.ts` — khuôn `SessionRepository` đã có (Repository pattern): danh sách asset cấp project `{ id, kind: 'image'|'sticker'|'video', path, addedAt, missing: boolean }`, lưu trong session.
2. Kiểm tra tồn tại lúc load project (song song, không chặn UI) → đánh dấu `missing`.
3. UI: node có asset missing → hiện placeholder rõ ràng trên canvas + badge trong Layers panel; dialog re-link **hàng loạt** ("3 files missing — Locate…"), tái dùng `LocateFileDialog` đã có thay vì viết mới.
4. **Bộ sticker có sẵn** (`StickerProps.assetId` trỏ vào đây — hiện chưa ai tạo): 12–20 sticker SVG/PNG bundle trong `apps/desktop/src/assets/stickers/`, kèm registry qua `extensions/kernel.ts` (`palettePoint` khuôn có sẵn, hoặc thêm `stickerPoint`). Chủ đề phù hợp podcast: mũi tên, badge "NEW", khung trích dẫn, biểu tượng mic/tai nghe, hình khối trang trí. **Tự thiết kế, không copy tác phẩm có bản quyền.**
5. Export: asset missing → chặn export kèm thông báo rõ (không render ra video thiếu ảnh mà không báo).

**Nghiệm thu:**
- [ ] Xoá 1 file ảnh đang dùng → mở lại project → node hiện placeholder + badge, không crash
- [ ] Re-link hàng loạt hoạt động, giữ nguyên mọi transform/timing
- [ ] Bộ sticker hiện trong `+ Sticker`, chèn được, render đúng cả preview lẫn mp4
- [ ] Export với asset missing bị chặn kèm thông báo tử tế
- [ ] Commit `p5-t15: asset repository, missing-file handling, built-in sticker set`

---

## T16 — Undo/redo cho `nodes[]` + phím tắt (2 ngày)

**Tham chiếu:** plan §9 (đoạn undo); ADR-0008 hiện có (`docs/adr/0008-undo-redo-scope.md`) — task này **viết lại phạm vi** của nó.

**Các bước:**
1. **Quyết định cơ chế (làm trước, ghi vào ADR-0009):** giữ zundo snapshot `nodes[]` hay chuyển Command pattern?
   - Đo trước: scene 50 node, `limit: 100` → RAM tăng bao nhiêu? Ghi **số thật**.
   - Nếu snapshot chấp nhận được (< ~50 MB) → giữ zundo, đơn giản hơn.
   - Nếu không → Command pattern (add/remove/move/group là mutation nghịch đảo được), đổi lại được nhãn "Undo: Add Text" trong menu Edit — thứ zundo không làm được.
2. Cập nhật `partializeTemporal()`: `nodes` vào history; `selectedNodeIds` **không** (chọn không phải edit — nhất quán với quyết định cũ về `selectedEl`).
3. Debounce burst 400ms giữ nguyên (kéo node = 1 undo step, không phải 50).
4. **Phím tắt còn thiếu** — thêm vào `app/shortcuts.ts` (bảng khai báo đã có) + `app/menu.ts`:

   | Phím | Hành động |
   |---|---|
   | `Delete`/`Backspace` | Xoá node đang chọn |
   | `⌘D` | Nhân bản node |
   | `←→↑↓` | Nudge 1px (⇧ = 10px) |
   | `Esc` | Bỏ chọn node / thoát group |
   | `⌘G` / `⇧⌘G` | Group / Ungroup (T10) |
   | `⌘]` / `⌘[` | Đưa lên trước / ra sau (z-order) |
   | `⌘A` | Chọn tất cả node |

   Tất cả theo luật `when: 'notTyping'` đã có. Cập nhật `ShortcutsHelpModal`.
5. Test: undo sau mỗi loại thao tác (add/remove/move/group/ungroup/đổi timing/đổi property) trả về đúng trạng thái trước.

**Nghiệm thu:**
- [ ] **Số RAM đo được ghi vào báo cáo + quyết định cơ chế có lý do**
- [ ] Undo/redo đúng cho cả 7 loại thao tác; kéo node = 1 step
- [ ] 7 phím tắt hoạt động, có trong ShortcutsHelpModal
- [ ] ADR-0008 cập nhật hoặc thay bằng phần trong ADR-0009 (ghi rõ chọn cách nào)
- [ ] Commit `p5-t16: undo/redo for scene nodes + node editing shortcuts`

---

## T17 — Golden-frame test viết lại theo tổ hợp node (1.5 ngày)

**Tham chiếu:** plan §10, §11.

**Các bước:**
1. Giữ nguyên bộ test cũ (6 layout × 9 style × 3 mốc + title) tới T18. **Thêm** `crates/audiogram-render/tests/golden_scene_frames.rs` test `render_scene_frame_into` theo tổ hợp:
   - mỗi `node.type` (waveform / text / image / video / group)
   - × có/không `timing` + `animIn/animOut` (chụp ở giữa hiệu ứng, ví dụ `tRelative = 0.5`)
   - × 1 tổ hợp group lồng nhau
   - × 1 case caption node (T14) có karaoke ở 3 mốc progress
   Nhỏ hơn nhiều bộ 6×9 cũ vì không nhân với layout (đúng dự đoán plan §11 "rẻ hơn về lâu dài").
2. Regenerate + **xem mắt toàn bộ** ảnh mới, commit kèm.
3. Nối vào `ci.yml` (job `rust` hiện có, không cần job riêng).
4. Ghi thời gian chạy — nếu > 30s (mốc `PACKAGE_SPLIT_PLAN` "cột mốc kiểm chứng") thì giảm tổ hợp, ghi lý do.

**Nghiệm thu:**
- [ ] `cargo test -p audiogram-render --test golden_scene_frames` xanh, < 30s
- [ ] Số ảnh hợp lý (ít hơn bộ cũ), **đã xem mắt toàn bộ**
- [ ] CI xanh
- [ ] Commit `p5-t17: golden-frame tests for node-based renderer`

---

## T18 — Xoá đường cũ, ADR-0009, đóng M1 (2 ngày)

**Các bước:**
1. **Checklist tính năng trước khi xoá** (bắt buộc, như P3-T13/P2-T12 — đây là cách bắt lỗi mất tính năng kiểu vụ `fps`): liệt kê **mọi** field cũ (`waveColor`, `zones`, `coverImagePath`, `subtitleColor`, `karaokeEnabled`, `subtitleYPct`, `showSubtitles`, `titleColor/Align/Bold/Italic`, `fontSize`, `fontName`...) và chỉ ra "nhà mới" trong `nodes[]` cho từng cái.
2. TS: xoá 6 hàm `drawX` + `drawFrame` cũ khỏi `renderer.ts`; mọi call site → `drawSceneFrame`. **Xoá cờ `useNodeRenderer` và cửa "Try new layers (beta)"** (T3/T7) — không được ship.
3. Rust: xoá 6 match-arm + `render_frame_into` cũ; `render_scene_frame_into` đổi tên thành chính thức. Xoá nhánh libass trong filter graph (T14 để lại cho đường cũ).
4. Xoá field cũ khỏi `design.slice`/`types.ts`/`contract/zones.json` sau khi `grep` xác nhận 0 call site. `LAYOUT_TEMPLATES` chuyển hẳn thành `SceneNode[]` mặc định.
5. `LayersPanel`/`NodeInspector`/`TimingTimeline` thành Design mode chính thức — **vẫn giữ ràng buộc §7b: template là điểm vào mặc định, Layers thu gọn.**
6. Xoá bộ golden cũ (6×9) sau khi `golden_scene_frames` đã phủ tương đương — ghi rõ trong commit cái gì mất phủ (nếu có).
7. **ADR-0009** (đầy đủ Context/Decision/Consequences): schema scene graph + group + timing + quyết định caption (§5b) + quyết định undo (T16). Cập nhật ADR-0008 hoặc đánh dấu superseded.
8. Cập nhật `CLAUDE.md`: §Preview↔Export Parity mô tả theo node renderer; §Encoding Pipeline (không còn libass); cây thư mục.
9. **Audit cuối milestone:** export 1 video ở commit trước T2 và 1 video sau T18 với input tương đương → so frame đầu/giữa/cuối. Khác biệt phải giải thích được từng cái.
10. **Nghiệm thu sản phẩm (§7b):** lại đưa app cho người chưa dùng — "tạo audiogram từ file này" — so số bước với lần đo ở T7 và với trước Phase 5.
11. Append `## C. Input cho Phase 6` vào file này: tổng hợp `TODO(p5-*)`, kết quả T1 (ADR-0010), và những gì M2 cần.

**Nghiệm thu:**
- [ ] `grep -rn "drawSpotify\|drawSplit\|drawMinimal\|drawFullBg\|drawKaraoke\|drawBrand" src` = 0 hit
- [ ] `grep -rn "useNodeRenderer\|Try new layers" src` = 0 hit
- [ ] `npm run ci` xanh từ máy sạch
- [ ] Checklist tính năng điền đủ, mỗi dòng có nhà mới
- [ ] Audit video before/after ghi rõ từng khác biệt + lý do
- [ ] **Nghiệm thu sản phẩm §7b đạt: số bước không nhiều hơn trước Phase 5**
- [ ] ADR-0009 tồn tại; ADR-0008 cập nhật/superseded
- [ ] Commit `p5-t18: remove legacy 6-layout renderer, scene graph is the only renderer, close M1`

---

## B. Tổng ngân sách & cách giao việc

| Milestone | Tasks | Ước lượng |
|---|---|---|
| M0 (spike, song song) | T1 | 2–3 ngày |
| M1a (schema → export path → UI tối thiểu) | T2–T7 | 11 ngày |
| M1b (timing/timeline/group/keyframe/intro/video/caption/asset/undo) | T8–T16 | 17 ngày |
| M1c (golden rewrite + đóng) | T17–T18 | 3.5 ngày |
| **Tổng Phase 5 (M0+M1)** | 18 task | **~33–35 ngày Sonnet** |

⚠️ **Đây là sàn, không phải trần** (§0.2). Task rủi ro ước lượng cao nhất: T13, T14, T16. M2 (GPU) chưa ước lượng — `PHASE6_TASKS.md` viết sau khi ADR-0010 (T1) có kết luận.

**Prompt template giao từng task cho Sonnet:**

> Đọc `PHASE5_TASKS.md` §0.1–0.2 (phạm vi + lỗ hổng đã sửa) + §A (luật chung) + task T\<n\>. Đọc thêm mục được trỏ tới trong `SCENE_GRAPH_REBUILD_PLAN.md`, và code tại file/dòng task chỉ đích danh. Thực hiện đúng phạm vi T\<n\>. **Không xoá đường render cũ trước T18 (luật §A.5). Từ T5 trở đi phải export video thật để nghiệm thu, không chỉ xem preview (luật §A.6). Task có dòng budget phải đo và ghi số thật (luật §A.9).** Nếu golden-frame đỏ, áp dụng luật §A.3. Chạy đủ nghiệm thu chung (§A.2) + riêng, báo cáo từng checkbox. Kẹt theo luật §A.8 thì dừng và hỏi.

**Điều kiện đóng M1 (review bởi model lớn hơn):**
- [ ] 18 task commit đủ (T1 có thể xong sớm/độc lập), `npm run ci` xanh
- [ ] Scene graph đầy đủ (node/timing/animIn-animOut/timeline/group/keyframe/video/caption/intro-outro) chạy trên renderer CPU cả 2 phía; đường cũ xoá sạch
- [ ] **Mọi tính năng đã kiểm chứng trên file video xuất ra thật, không chỉ preview** (không lặp lại P-1)
- [ ] **Ràng buộc §7b đạt: người không rành thiết kế vẫn tạo được audiogram không cần mở Layers panel, số bước không tăng**
- [ ] Golden-frame mới phủ node combinatorics; mọi regenerate có ghi chú lý do
- [ ] Mọi budget §5c đã đo, có số thật, không vượt
- [ ] ADR-0009 + ADR-0010 tồn tại
- [ ] `## C. Input cho Phase 6` đã append
