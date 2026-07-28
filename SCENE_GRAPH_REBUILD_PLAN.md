# Audiogram — Scene Graph + GPU Rebuild Plan (v2)
*Cập nhật: 28/07/2026 · Thay v1 (cùng ngày) sau các quyết định: (1) giữ 1 nguồn audio, KHÔNG multi-clip/track, nhưng thêm group (Composite) + keyframe animation nâng cao; (2) đầu tư GPU render pipeline (wgpu) thay vì CPU rasterize; (3) xác nhận định vị sản phẩm là podcast editor, không phải video editor — xem §0. Thay thế mô hình render trong `TECH_ARCHITECTURE.md` (archived) · Tham khảo cấu trúc `aurora-editor` do người dùng cung cấp, đối chiếu ở §2 và §9. Bổ sung: intro/outro branding (visual-only) + video nền — §3, §4, §7-9.*

## 0. Định vị sản phẩm — đọc trước khi sửa bất cứ gì ở dưới

Xác nhận từ người dùng (28/07/2026): **đây không phải video editor** — vẫn là **podcast editor** (trọng tâm tuyệt đối là "audio → video"), chỉ cần **kiểm soát/hiệu ứng nhiều hơn** ở lớp trang trí: ảnh/sticker hiện từ giây X đến giây Y, chữ có hiệu ứng vào/ra. Câu này quyết định cách đọc toàn bộ phần còn lại của plan:

- Trọng tâm engineering vẫn là 1 audio nguồn + pipeline export ổn định (đã có, không đổi) — scene graph là lớp **trang trí thêm lên trên**, không phải lý do tồn tại của app.
- API cho trường hợp phổ biến nhất — "hiện từ giây X đến Y, vào/ra kiểu gì" — phải **đơn giản trực tiếp** (2 field thời gian + 1 dropdown hiệu ứng), không ép người dùng nghĩ bằng ngôn ngữ "nhiều keyframe" cho việc chỉ là 1 cửa sổ thời gian + 1 hiệu ứng vào/ra. Vì vậy §3 khôi phục `timing` + `animIn/animOut` làm cơ chế chính, `keyframes` chỉ là lớp nâng cao tuỳ chọn (bản đầu trong ngày đã lỡ gộp hết vào keyframe — quy giản sai, sửa lại ở đây).

## 1. Mục tiêu (giữ từ v1)

Hệ thống hiện tại là **named-zone template**: mỗi layout (`spotify/split/minimal/fullbg/karaoke/brand`) có tối đa đúng 1 waveform, 1 title, 1 subtitle, 1 avatar — cố định trong code (`contract/zones.json`, `LayoutZones`, 6 hàm `drawX` trong `domain/preview/renderer.ts`, 6 match-arm trong `frame.rs`). Mục tiêu rebuild:

1. Waveform là object độc lập, 0..N instance.
2. Text (title/subtitle/free text) là 1 loại node, nhiều instance, định dạng riêng.
3. Ảnh/sticker/video nền: danh sách, không phải 1 field duy nhất.
4. Mỗi object kiểm soát được: hiện từ giây nào đến giây nào, hiệu ứng vào/ra, animate nâng cao nếu cần, group nhiều object lại.
5. Preview ↔ export dùng chung 1 renderer — không còn "2 người viết 2 lần, golden-test bắt lỗi sau khi lệch".

## 2. Vì sao GPU kéo theo "1 renderer duy nhất" — không phải 2 lựa chọn độc lập

Một khi pipeline render là GPU (wgpu: device/queue/pipeline/shader), nó chỉ có thể sống ở Rust — không hợp lý để có "bản GPU thứ 2" viết bằng WebGL trong Canvas2D JS chỉ để preview. Cách tự nhiên nhất — và cũng là ý hay nhất trong cấu trúc `aurora-editor` bạn gửi (`state/app_state.rs` giữ `Project` làm nguồn sự thật ở Rust, `ipc/channel.ts` có "Frame streaming channel") — là: **preview trong Studio cũng gọi engine GPU này qua IPC, nhận frame về, không tự vẽ bằng JS nữa.**

Hệ quả: vấn đề "preview ↔ export parity" mà toàn bộ review trước đó xoay quanh (ADR 0002-0007, golden-frame test bắt lỗi sau khi lệch) **biến mất theo kiến trúc**, không phải được giảm thiểu — chỉ còn đúng 1 code path vẽ, không còn 2 implementation để mirror. Đây là thay đổi quan trọng nhất so với v1.

## 3. Schema

```ts
interface Project {
  introDuration?: number   // giây, 0/undefined = không có intro — xem §8
  outroDuration?: number   // đối xứng, gần như miễn phí khi đã có introDuration
  nodes: SceneNode[]
  // ...các field project khác giữ nguyên (audioPath, canvasSize, fps...)
}

interface SceneNode {
  id: string
  type: 'waveform' | 'text' | 'image' | 'sticker' | 'video' | 'group'
  parentId?: string             // Composite — id của group cha; undefined = root level
  transform: Transform          // fraction 0–1; con trong group là fraction của không gian cục bộ group
  z: number
  timing?: { start: number; end: number }   // CƠ CHẾ CHÍNH cho "hiện từ giây X-Y" — absent = suốt video
  animIn?: { preset: AnimationId; duration: number }   // hiệu ứng vào — áp trong [start, start+duration]
  animOut?: { preset: AnimationId; duration: number }  // hiệu ứng ra — áp trong [end-duration, end]
  keyframes?: KeyframeTrack[]   // NÂNG CAO, TUỲ CHỌN — animate liên tục 1 property theo thời gian (không phải cách làm show/hide đơn giản, xem §5)
  props?: WaveformProps | TextProps | ImageProps | StickerProps | VideoProps   // group không có props riêng, chỉ compose children
}

interface Transform { x: number; y: number; w: number; h: number; rotation?: number; opacity?: number }
type AnimationId = 'fade' | 'slide-up' | 'slide-down' | 'scale-in'   // registry giống wave-effects, xem §5

interface KeyframeTrack {
  property: 'x' | 'y' | 'w' | 'h' | 'rotation' | 'opacity' | 'color'
  keyframes: { t: number; value: number | string; easing: Easing }[]
}
type Easing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'hold'

interface TextProps {
  text: string
  role: 'title' | 'subtitle' | 'caption' | 'freeform'
  boundToTranscript?: boolean   // true = nội dung tự động lấy activeSeg thay vì `text` tĩnh
  color: string; font: string; size: number; align: 'left'|'center'|'right'; bold: boolean; italic: boolean
}
interface WaveformProps { style: WaveStyle; color: string }
interface ImageProps    { src: string; fit: 'cover'|'contain'; shape?: 'rect'|'circle'|'rounded' }
interface StickerProps  { assetId: string }  // v1: ảnh tĩnh có sẵn, không phải Lottie — xem §7
interface VideoProps    { src: string; fit: 'cover'|'contain'; loop: boolean; muted: true }  // muted cố định true — xem §7
```

`TextProps.role` là câu trả lời trực tiếp cho "tại sao chỉ add được 1 title": title/subtitle/free text đều là node `type: 'text'`, số lượng không giới hạn.

`children` của group **không** lưu trực tiếp (không có `group.children: string[]`) — suy ra bằng `nodes.filter(n => n.parentId === group.id)`, tránh 2 nguồn sự thật. Transform hiệu dụng của con lúc render = transform cha ⊗ transform con (nhân ma trận 2D chuẩn).

**Intro/outro không phải node, không phải scene riêng — là 1 offset trên timeline chung.** Tổng thời lượng video = `introDuration + audioDuration + outroDuration`. Audio chính bắt đầu phát tại `t = introDuration` (có thể fade-in bằng chính `animIn` của 1 node đại diện, hoặc field riêng — quyết định lúc Phase D). Node chỉ hiện lúc intro (logo, tên podcast) dùng đúng `timing: {start: 0, end: introDuration}` — cơ chế y hệt mọi node khác, **không cần type mới, không cần khái niệm "scene"**.

## 4. GPU render pipeline (Rust) — module mới

Tham khảo cấu trúc `aurora-editor`, scoped đúng cho nội dung audiogram thực tế (không cần multi-clip compositing):

```
crates/audiogram-render/src/
├── gpu.rs             # device/queue init — headless (offscreen render target), không cần swapchain/surface thật
├── pipeline.rs         # frame render flow: bind groups, draw call theo nodes đã lọc timing + sort z
├── compositor.rs       # blend layer theo z/opacity, compose transform group→con
├── texture_cache.rs    # LRU ảnh/sticker/frame-video đã upload GPU — tránh re-upload/re-decode mỗi frame
├── staging.rs          # GPU→CPU readback — dùng chung cho preview (stream về webview) VÀ export (ghi frame cho ffmpeg)
├── video_decode.rs     # decode video nền → frame cache, xem đoạn dưới
├── text/
│   ├── layout.rs        # cosmic-text layout — giữ nguyên logic đo/wrap đã có
│   ├── glyph_atlas.rs    # GPU glyph atlas (thay vì vẽ glyph thẳng vào CPU buffer như hiện tại)
│   ├── rasterizer.rs     # fontdue rasterize glyph vào atlas
│   └── text_renderer.rs  # sample atlas trong shader
└── shaders/*.wgsl        # core compositing + text-atlas sampling + shape cơ bản (rect/line cho waveform bar) + animIn/animOut (opacity/transform theo t tương đối)
```

Waveform hiện có (`packages/wave-effects`, 9 style) cần port sang GPU: (a) shader thuần cho style hình học đơn giản (bar/line/mirror), hoặc (b) CPU tính chiều cao bar mỗi frame rồi upload như texture nhỏ, GPU chỉ blit — bắt đầu bằng (b) cho toàn bộ 9 style (nhanh để port), chuyển style nào cần hiệu năng cao hơn sang (a) sau khi đo.

**Video nền — chiến lược decode.** Dùng lại triết lý "decode 1 lần, cache, không decode lại mỗi frame" đã có trong codebase (`AudioEngine` cache envelope theo path, `useFftSpectrum` cache theo path). `video_decode.rs` gọi ffmpeg (đã bundle sẵn, đối xứng với việc export dùng ffmpeg) giải mã thành chuỗi frame ở fps thấp hơn project fps nếu cần (12-15fps đủ cho nền bị waveform/text che một phần) và resolution thấp hơn cho preview — mỗi frame là 1 entry trong `texture_cache.rs`. Loop nếu video ngắn hơn audio: tái dùng đúng cơ chế `waveLoop` đã có (index frame modulo tổng số frame). `muted: true` cố định — không mix audio của video nền, không chạm `AudioEngine`/export audio pipeline.

## 5. Hiệu ứng vào/ra + keyframe nâng cao — quan hệ giữa 3 cơ chế

Ba tầng, dùng tầng thấp nhất đủ cho nhu cầu:

1. **`timing` một mình** — object hiện/ẩn cứng tại `start`/`end`, không hiệu ứng. Đủ cho phần lớn trường hợp đơn giản.
2. **`timing` + `animIn`/`animOut`** — cách làm mặc định cho "chữ vào/ra như thế nào": chọn 1 preset (`fade`/`slide-up`/`slide-down`/`scale-in`) từ registry giống hệt `wave-effects` (mỗi preset 1 hàm biến đổi opacity/transform theo `t` tương đối trong khung `duration`). UI: dropdown + field số giây — không cần mở khái niệm keyframe.
3. **`keyframes`** — lớp nâng cao, tuỳ chọn, cho ai cần animate liên tục 1 property theo đường cong tuỳ ý (ví dụ sticker di chuyển theo đường, hoặc pulsing scale liên tục) — không phải cách để làm show/hide đơn giản. `evaluator.rs`: tại `t`, tìm 2 keyframe kề nhau, nội suy theo `easing` của keyframe bên trái (quy ước After Effects/Premiere). Chỉ áp dụng trong `[timing.start, timing.end]` nếu node có `timing`; nếu không có `timing`, áp suốt video.

## 5b. Captions: text node hay libass? — QUYẾT ĐỊNH CHỐT

Đây là mâu thuẫn phát hiện lúc rà soát (28/07/2026) và **phải chốt trước khi viết dòng renderer đầu tiên**, vì 2 hướng đi khác nhau hoàn toàn về khối lượng.

**Hiện trạng:** preview vẽ caption bằng Canvas2D (`renderer.ts` `drawSubtitle`, kể cả karaoke sweep bằng clip-rect), còn export **burn caption bằng libass** qua ffmpeg filter `ass='...'` (`infrastructure/ffmpeg/render/mod.rs:380`). Hai đường hoàn toàn khác nhau — đây chính là gap parity còn sót mà P3 đã cố ý **không** đóng (`docs/archive/PHASE3_TASKS.md` §A: "Subtitle chuyển từ libass sang Rust rasterize: **KHÔNG** — chỉ title chuyển", vì karaoke `\kf` phức tạp).

**Quyết định: caption trở thành text node (`boundToTranscript: true`), bỏ libass khỏi pipeline export.**

Lý do:
1. **Không thể có ngoại lệ trong kiến trúc "1 renderer duy nhất".** libass là ffmpeg filter — chỉ chạy được lúc export, không thể dùng cho preview. Giữ nó = giữ vĩnh viễn đúng loại gap mà toàn bộ rebuild này sinh ra để xoá (§2). Càng để lâu càng đắt vì mọi tính năng text mới (animIn/animOut, keyframe, group) sẽ phải làm 2 lần cho 2 loại text.
2. **Công việc nhỏ hơn P3 tưởng, vì nền đã khác.** Lúc P3 quyết hoãn thì Rust chưa có text engine. Giờ đã có `text.rs` + cosmic-text + font bundle (P3-T3/T4, ADR-0004/0007). Karaoke sweep về bản chất là "vẽ text 2 lần, lần 2 bị cắt theo clip-rect chạy theo progress" — thuật toán này **đã tồn tại và đã chạy đúng** trong `renderer.ts:182-196`, chỉ cần port sang Rust (`pixel.rs` cần thêm hỗ trợ clip-rect, không có gì mới về mặt khái niệm).
3. Bỏ libass còn gỡ luôn 1 phụ thuộc ngoài khỏi filter graph — filter chỉ còn `format=yuv420p`.

**Hệ quả phải chấp nhận:**
- `.srt`/`.ass` **vẫn được ghi ra file** như hiện nay (tính năng export phụ đề riêng của sản phẩm) — chỉ khác là file `.ass` không còn được ffmpeg dùng để burn nữa. `crates/audiogram-subtitle` **không bị xoá**.
- Style caption hiện đi qua `write_ass` params (màu, `MarginV`, karaoke) chuyển sang `TextProps` của node — cần migration.
- Đây là task riêng có ngân sách riêng (T14 trong `PHASE5_TASKS.md`), không được coi là "một phần nhỏ của text node".

## 5c. Ngân sách hiệu năng (điều kiện pass/fail, không phải mong muốn)

`TECH_ARCHITECTURE.md` cũ có bảng budget rõ ràng và đó là lý do app hiện tại mượt. Bản rebuild này phải có tương đương, nếu không M2 (GPU/preview streaming) sẽ không có tiêu chí để biết là đạt hay không:

| Điểm nóng | Ngân sách | Đo lúc nào |
|---|---|---|
| Preview 1 frame (CPU renderer, M1) | ≤ 16 ms với scene 20 node ở 1080p | T3/T4 nghiệm thu |
| Preview round-trip IPC (M2, streaming) | ≤ 33 ms từ lúc gọi tới lúc blit xong (30fps cảm nhận) | M2, tiêu chí go/no-go của chính preview streaming |
| Kéo/resize node trên canvas | Phản hồi ≤ 1 frame; request coalesce theo rAF, không gọi renderer mỗi mousemove | T7 |
| Decode video nền | ≤ 10s cho video 60s ở fps/độ phân giải preview; cache theo hash path, không decode lại | T13 |
| Export | Không được chậm hơn baseline hiện tại quá 20% ở cùng input | T18 audit |
| Bộ nhớ scene 50 node + video nền | ≤ 1 GB RSS | T13 |

Vượt ngân sách ⇒ dừng, đo, báo lại — **không** đi tiếp rồi hẹn "tối ưu sau".

## 6. Grouping (Composite) — UI

- Panel **Layers**: multi-select (⇧+click) → `⌘G` Group tạo `GroupNode`, set `parentId` các node được chọn; `⇧⌘G` Ungroup xoá group, set lại `parentId` con.
- Canvas: click vào node trong group lần đầu = chọn cả group; double-click = "vào trong" group để chọn từng con riêng (pattern Figma/Illustrator quen thuộc).
- `timing`/`animIn`/`animOut` đặt trên group áp dụng cho cả nhóm cùng lúc — không cần đặt lặp lại trên từng con.

## 7. Preview: stream frame thay vì Canvas2D tự vẽ

- Command Tauri mới `render_preview_frame(nodes, t, quality) -> buffer` — gọi cùng `pipeline.rs`/`compositor.rs` với export, chỉ khác `quality` (resolution thấp hơn để đủ nhanh khi tương tác).
- `PreviewCanvas.tsx` đổi từ "tự vẽ bằng `domain/preview/renderer.ts`" sang "gọi IPC nhận buffer, blit vào canvas". **Xoá hẳn `domain/preview/renderer.ts` + 6 hàm `drawX`** sau khi renderer GPU đủ ổn.
- Throttle lúc kéo-thả: coalesce request theo rAF (~16-33ms/lần), không gọi IPC mỗi lần chuột di chuyển.

## 7b. Giữ "đường nhanh" cho người không rành thiết kế — ràng buộc sản phẩm, không phải nice-to-have

`APP_BRIEF` (archived) mô tả người dùng: podcaster, nhà thờ, tổ chức phi lợi nhuận, **"người không có kỹ năng thiết kế nhưng muốn output trông chuyên nghiệp"**. Hiện tại họ chọn 1 trong 6 template là xong — 0 quyết định, kết quả đẹp ngay.

Scene graph + Layers panel + inspector-theo-node là mô hình tư duy Photoshop. Nếu thay thẳng, sản phẩm biến từ công cụ 3 click thành After Effects mini và **mất đúng nhóm khách hàng mục tiêu**. Ràng buộc bắt buộc:

1. **Template vẫn phải là điểm vào mặc định**, cho kết quả hoàn chỉnh với 0 thao tác thêm — sau rebuild, template chỉ khác ở chỗ nó là `SceneNode[]` thay vì hàm vẽ cứng, còn trải nghiệm "chọn là xong" **không được đổi**.
2. **Layers panel là lớp mở ra khi cần**, không phải thứ đập vào mắt lần đầu mở app. Người không bao giờ bấm vào nó vẫn dùng được app đầy đủ như trước.
3. Mọi tính năng mới (thêm text/ảnh/sticker, timing, animation) là **cộng thêm**, không được biến việc đơn giản thành nhiều bước hơn hiện tại.
4. Nghiệm thu kiểu người dùng thật: đưa app cho người chưa từng dùng, yêu cầu "tạo 1 audiogram từ file audio này" — phải xong mà không cần mở Layers panel lần nào.

## 8. Không làm ở v1 (giữ tinh thần chống scope creep)

- Multi-clip/multi-track/transition — theo đúng lựa chọn phạm vi đã chốt, KHÔNG làm. **Intro/outro không phải ngoại lệ**: nó là 1 offset thời gian trên cùng 1 timeline (§3), không phải scene thứ 2 với nội dung/audio độc lập — nếu sau này muốn N scene tuỳ ý sắp xếp lại được, đó lại là câu hỏi multi-clip đã từ chối, cần bàn riêng.
- ⚠️ **Timeline 1 track để chỉnh `timing` của node thì CÓ LÀM** (sửa lại so với bản trước trong ngày, vốn hoãn nhầm). Lý do: use case trung tâm người dùng nêu là "sticker hiện từ giây X đến giây Y" — bắt gõ 2 ô số là cách tệ nhất để làm việc đó; thao tác đúng là kéo 1 thanh trên timeline và nhìn thấy nó. **Timeline 1 track hiển thị timing của các node KHÔNG PHẢI multi-clip NLE** — không có sắp xếp lại clip, không trim nguồn media, không transition. Nó nằm trong phạm vi đã chốt.
- Audio riêng cho intro/outro (jingle) — đã xác nhận: intro chỉ visual, audio chính fade-in hoặc bắt đầu thẳng tại `t=introDuration`. Không đụng `AudioEngine` (vẫn 1 nguồn audio) hay export audio pipeline.
- Video nền có audio riêng / mix nhiều audio track — `muted: true` cố định.
- Trim/chọn đoạn bắt đầu của video nền qua UI kéo-thả kiểu clip — v1 luôn phát từ frame 0, loop nếu ngắn hơn audio.
- Custom bezier easing curve editor — 4 preset animIn/animOut + 5 easing keyframe (§5) trước, custom bezier để sau nếu cần.
- Animated sticker (Lottie/GIF) — v1 chỉ ảnh tĩnh.
- WASM plugin cho node type bên thứ 3 — vẫn hoãn.
- Hiệu ứng chữ nâng cao (outline/shadow động per-glyph trong shader) — v1 chỉ fill màu đơn.
- Rebuild `ExportSheet`/`Toolbar`/`TransportBar` — không cần đổi, không phụ thuộc layout cố định.

## 9. Store, undo/redo, persistence — hệ quả cần lường trước

- `design.slice` đổi từ field phẳng (`waveColor`, `titleColor`, `zones`, `coverImagePath`...) sang `nodes: SceneNode[]` + `selectedNodeId`(s). Breaking change thật, không phải thêm field.
- **ADR-0008 (undo/redo scope) phải viết lại**: scope theo toàn bộ `nodes` array. Nguyên tắc debounce-burst (400ms) giữ nguyên.
- **Persistence cần migration `session.json`** (dùng `migrations.ts` đã có): field cũ → `nodes[]` tương đương (1 title node + 1 waveform node + optional avatar/subtitle node, `timing` mặc định = suốt video để giữ hành vi cũ).
- **Inspector đổi tư duy**: từ "sửa property của layout" (4 slot cố định) sang "sửa property của node đang chọn trong danh sách" + panel **Layers** mới (thêm/xoá/group/z-order) + tab **Animate** (timing/animIn/animOut, và keyframe nếu cần) — trong ràng buộc §7b.
- **Asset lifecycle là vấn đề mới, không phải chi tiết nhỏ.** Hiện app quản đúng 1 file audio + 1 cover, và đã phải xây "Locate File" khi audio mất (P4-T5). Sau scene graph: N ảnh + N sticker + video nền, mỗi cái là 1 tham chiếu file có thể bị đổi tên/xoá/nằm trên ổ ngoài đã rút. Cần: registry asset cấp project (Repository pattern, cùng khuôn `SessionRepository` đã có), trạng thái "missing" hiển thị được trên từng node, và luồng re-link hàng loạt. Sticker `assetId` trỏ tới bộ có sẵn — **bộ đó phải được tạo ra**, không tự có.
- **Undo/redo phải thiết kế lại, không phải "cập nhật ADR-0008 một dòng".** zundo hiện snapshot theo danh sách field phẳng; chuyển sang snapshot cả `nodes[]` với `limit: 100` là câu hỏi bộ nhớ thật khi scene lớn. Cân nhắc Command pattern (add/remove/move/group là các mutation nghịch đảo được, và cho phép nhãn "Undo: Add Text" trong menu Edit — thứ zundo không làm được). Quyết định lúc T16, có ngân sách riêng.

## 10. Lộ trình — GPU là nền móng bắt buộc trước khi làm scene features

**Phase 0 — GPU foundation & go/no-go spike** (rủi ro cao nhất, làm trước tiên, tách riêng khỏi mọi phase khác). Chọn `wgpu` (cross-platform Vulkan/Metal/DX12). Spike: 1 context GPU headless render đúng 1 frame hiện tại (1 layout, 1 wave style, không group/timing/keyframe) ra RGBA buffer, so với bản CPU cũ bằng SSIM (không phải hash tuyệt đối — lệch AA giữa GPU/CPU là dự kiến trước). Quyết định go/no-go thật sự nằm ở đây — xem §11 rủi ro CI trước khi cam kết các phase sau.

**Phase A — Scene graph schema** (`timing`/`animIn`/`animOut`/`keyframes`/group) qua `contract/` codegen, song song hoàn toàn với renderer CPU cũ đang chạy.

**Phase B — Port renderer sang GPU**, thứ tự dễ trước: waveform → text (glyph atlas) → image/group compositing → video nền (`video_decode.rs`). Vẫn giữ renderer CPU cũ chạy song song tới khi GPU renderer đạt SSIM đủ tốt trên toàn bộ tổ hợp golden-frame.

**Phase C — Preview chuyển sang stream từ GPU renderer** (§7); xoá `domain/preview/renderer.ts`.

**Phase D — UI:** Layers panel (group/ungroup), tab Animate (timing start/end, dropdown animIn/animOut, keyframe nâng cao nếu cần), multi-asset (ảnh/sticker/video nền), asset manager, control `introDuration`/`outroDuration` (số giây, 0 = tắt) — chưa cần UI timeline riêng.

**Phase E — Xoá đường cũ hoàn toàn** (CPU renderer, `LayoutZones` cứng, `zones.json`), cập nhật `CLAUDE.md` §Preview↔Export Parity, ghi ADR-0009 (schema scene graph) và ADR-0010 (quyết định GPU, kèm kết quả spike Phase 0).

Tách `PHASE5_TASKS.md` theo format các phase cũ (`docs/archive/`, dùng làm template) khi bắt đầu Phase 0.

## 11. Rủi ro

| Rủi ro | Ghi chú |
|---|---|
| **CI hiện chạy `macos-latest`** (`ci.yml`) — chưa xác nhận GPU headless (Metal) khả dụng ổn định cho golden-frame test mới | Xác nhận ngay ở Phase 0 spike; nếu không khả thi, cần backend software rasterizer riêng cho CI, hoặc đầu tư runner có GPU |
| **Cross-platform chưa test** (Windows DX12/Vulkan, Linux Vulkan) — CI hiện chỉ macOS | Cần ma trận CI riêng khi có ngân sách, phải làm trước khi ship Windows |
| **Golden-frame test phải đổi phương pháp**: từ pixel-hash tuyệt đối sang ngưỡng SSIM | GPU rasterize luôn có sai biệt nhỏ theo driver/hardware — đánh đổi độ nhạy test lấy hiệu năng |
| **Chi phí học + xây mới hoàn toàn** — wgpu/WGSL/glyph-atlas không có dòng code liên quan hiện tại | Tính như 1 dự án con độc lập (Phase 0-B), không phải "thêm tính năng lên nền có sẵn" |
| **Video nền: hiệu năng/bộ nhớ decode** | Video dài + độ phân giải cao decode hết thành frame cache có thể tốn RAM/disk lớn — cần giới hạn (fps thấp + resolution thấp cho preview) và đo trước khi cam kết UI cho phép video bất kỳ độ dài |
| Group transform-compose tính sai khi ungroup | Giữ 1 hệ quy chiếu nhất quán — viết unit test riêng cho compose/decompose trước khi làm UI group |
| `timing` mặc định khi migrate session cũ | Node cũ (title/waveform luôn hiện suốt) → `timing: undefined` (không phải `{start:0, end:duration}` — tránh phải biết trước `duration` lúc migrate) |

## 12. Việc kế tiếp

- **`PHASE5_TASKS.md`** (28/07/2026, đã sửa sau rà soát — xem §0.2 của file đó) chi tiết hoá M0+M1 của lộ trình §10 thành **18 task**: spike GPU (T1, độc lập) + toàn bộ scene graph chạy trên 2 renderer CPU hiện có, **trước khi** đụng GPU. 4 task quan trọng nhất được thêm sau rà soát: **T5** (nodes qua `RenderJob` → export path, tránh lặp lại bẫy P-1 lịch sử), **T9** (timeline 1 track — UI cho use case trung tâm), **T14** (caption → text node theo §5b), **T15/T16** (asset lifecycle, undo + phím tắt). `PHASE6_TASKS.md` (port GPU) viết sau khi T1 có kết luận go/no-go.
- ADR-0009 (schema scene graph) và ADR-0010 (quyết định GPU) — ghi theo tiến độ T1/T13 của `PHASE5_TASKS.md`, không ghi trước.
- `PACKAGE_SPLIT_PLAN.md` cần cập nhật: mô tả crate `audiogram-render` ("CPU rasterizer, rayon-parallel") sẽ không còn đúng sau khi port GPU (M2) — sửa khi đó, không sửa trước.
