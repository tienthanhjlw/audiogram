# Audiogram — Phân tích & kế hoạch tách package
*Ngày lập: 25/07/2026 · Bổ sung cho `TECH_ARCHITECTURE.md` §2.2 · Căn cứ: audit import thực tế trên source*

**Câu hỏi:** tính năng nào tách được thành package riêng (npm workspace + cargo crate), tách để làm gì, và — quan trọng không kém — cái gì KHÔNG nên tách.

---

## 1. Tiêu chí đánh giá (khung chấm điểm)

Một vùng code chỉ đáng tách thành package khi đạt **cả 4**:

| Tiêu chí | Câu hỏi kiểm chứng |
|---|---|
| **Purity** — độ sạch dependency | Có import Tauri/React/store của app không? Gỡ được với chi phí bao nhiêu? |
| **API surface ổn định** | Interface có đổi mỗi tuần không? (đang churn = tách sớm sẽ trả giá bằng version dance) |
| **Giá trị độc lập** | Tách xong được gì: test không cần app runtime? dùng lại ở CLI/web? publish OSS? người khác đóng plugin? |
| **Nhịp thay đổi khác app** | Code này đổi cùng lúc với features/ hay theo chu kỳ riêng? Đổi cùng nhau = để cùng chỗ |

**Nguyên tắc chuyên nghiệp ngược đời nhưng quan trọng:** monorepo nhiều package *không* tự nó chuyên nghiệp. Package hoá thứ đổi-cùng-nhau tạo ra friction thuần túy (version bump, cross-package refactor, build orchestration). Chuyên nghiệp = **ranh giới đúng chỗ**, số lượng package tối thiểu đủ dùng.

---

## 2. Bản đồ coupling thực đo (audit 25/07/2026)

Kết quả grep `use`/`import` trên source hiện tại:

```
RUST                                        Phụ thuộc ngoài module
─────────────────────────────────────────────────────────────────
domain/entities        serde, shared::{AppError, hex_to_rgb}     ← GẦN SẠCH
shared/error           thiserror                                  ← SẠCH
shared/util (emit_log) tauri::{AppHandle, Emitter}                ← BẨN (1 hàm)
infra/spectrum         rustfft, serde                             ← SẠCH TUYỆT ĐỐI
infra/subtitle         shared::util (format time), domain         ← GẦN SẠCH
infra/ffmpeg/render    domain, spectrum::EQ_BANDS, rayon,
                       tauri::{AppHandle, Emitter} (progress)     ← 1 vết bẩn duy nhất
infra/ffmpeg/{resolver,audio}  tauri (path resolve, bundle)       ← GẮN TAURI (bản chất)
infra/whisper          tauri (app_data_dir, sidecar)              ← GẮN TAURI (bản chất)
application, presentation      tauri toàn phần                    ← GẮN TAURI (đúng vai)

TYPESCRIPT
─────────────────────────────────────────────────────────────────
src/waves/**           KHÔNG tauri, KHÔNG react — chỉ import
                       WaveStyle union từ ../types                ← SẠCH 99%
WaveformCanvas         2 import tauri (convertFileSrc,
                       invoke analyze_spectrum) + react           ← renderer lẫn I/O
types.ts (constants)   zero dep                                   ← SẠCH
splitSegments/ops      zero dep (đang kẹt trong StepTranscript)   ← SẠCH sau khi rời
```

**Kết luận audit:** phần lõi giá trị nhất của sản phẩm (render engine 2 phía, spectrum, subtitle, domain) đã *gần như sạch sẵn* — công tách chủ yếu là cắt 2 sợi dây: `tauri::Emitter` trong render/util (Rust) và union type `WaveStyle` (TS). Đây là tín hiệu tách RẺ.

---

## 3. Đánh giá từng ứng viên — verdict

### 3.1 Rust → cargo workspace crates

| Crate đề xuất | Nội dung | Purity | Giá trị độc lập | Verdict |
|---|---|---|---|---|
| **`audiogram-core`** | `domain/entities` + `shared/error` + phần thuần của util (hex_to_rgb, wrap_text, time fmt) | Gần sạch — chỉ cần chuyển `emit_log` ra khỏi util | Mọi crate khác đứng trên nó; test entities không cần Tauri | ✅ **TÁCH — đợt 1** |
| **`audiogram-spectrum`** | STFT/rustfft, EQ_BANDS | Sạch tuyệt đối (đo được) | Test FFT thuần; tái dùng cho visualizer khác | ✅ **TÁCH — đợt 1** (rẻ nhất, làm đầu tiên để dựng workspace) |
| **`audiogram-render`** | `infra/ffmpeg/render/{frame,wave,pixel}` — toàn bộ CPU rasterizer | 1 vết: progress emit qua `AppHandle` → thay bằng `trait ProgressSink { fn on(&self, ev: RenderEvent) }` | **CAO NHẤT**: (a) golden-frame test chạy `cargo test` không cần Tauri; (b) mở đường **`audiogram-cli`** — render headless/batch, sản phẩm thứ 2 từ cùng lõi; (c) chỗ ở tương lai của CompositionSpec interpreter | ✅ **TÁCH — đợt 1** |
| **`audiogram-subtitle`** | srt/ass builders | Gần sạch (format time từ util → chuyển vào crate này hoặc core) | Test ASS/karaoke tags thuần — vùng nhiều edge case nhất | ✅ **TÁCH — đợt 1** |
| `audiogram-media` | ffmpeg resolver/audio decode, whisper runner | Gắn Tauri bản chất (bundle path, sidecar, app_data_dir) | Thấp — trừu tượng hoá path resolution chỉ để tách là over-engineering | ❌ **Ở LẠI app crate** (xem lại nếu làm CLI thật — CLI cần resolver riêng kiểu env/PATH) |
| `application` + `presentation` | use-cases + commands | Tauri toàn phần | Đây LÀ app | ❌ **Ở LẠI** |

### 3.2 TypeScript → npm workspace packages

| Package đề xuất | Nội dung | Purity | Giá trị độc lập | Verdict |
|---|---|---|---|---|
| **`@audiogram/contract`** | Output codegen từ `contract/*.json` (constants, zones) + types sinh từ Rust | Sạch định nghĩa | Điểm neo parity; cả app lẫn mọi package khác import từ đây thay vì chép | ✅ **TÁCH — đợt 1** (đằng nào Phase 1 architecture cũng tạo codegen) |
| **`@audiogram/wave-effects`** | `src/waves/**` (9 effects + registry + support math) | Sạch 99% — đổi `id: WaveStyle` → `id: string` là xong | **Publish được** (OSS: "canvas audio visualizer effects", marketing tốt); plugin Cấp 0 có chỗ ở đúng; test vẽ bằng node-canvas | ✅ **TÁCH — đợt 1** |
| **`@audiogram/segments`** | splitSegments, findSilence, split/merge/remove ops | Sạch sau khi rời component (việc Phase 2 kiến trúc đã định) | Test thuật toán tách câu — vùng logic dày nhất frontend | ✅ **TÁCH — đợt 2** (gộp lúc di dời, không làm 2 lần) |
| **`@audiogram/renderer`** | Canvas compositor (phần thuần của WaveformCanvas: DC, layout draw, subtitle pill) — KHÔNG gồm React wrapper & I/O | Phải mổ: tách compositor thuần khỏi hook decode/tauri | Web demo/landing page render thật trong browser; golden-frame phía TS import từ đây | ⏳ **TÁCH — đợt 3**, đúng lúc refactor CompositionSpec (đằng nào cũng mổ file này — 1 lần dao) |
| **`@audiogram/ui`** | primitives + tokens.css | Sạch theo thiết kế (ui không import store) | Chuẩn enterprise design-system | ⏳ **TÁCH — đợt 3**: đợi API primitives ổn định qua 2 phase dùng thật. Tách lúc đang churn = trả giá version dance. Trong lúc chờ: giữ luật ESLint như đã là package |
| `@audiogram/ipc` | bindings.gen + client | Gắn app (bindings sinh từ app crate) | Không ai khác dùng | ❌ **Ở LẠI `core/`** |
| features/store/app | — | — | Đổi cùng nhau hằng ngày | ❌ **Ở LẠI** — tách là anti-pattern |

### 3.3 Những thứ cố tình KHÔNG tách (ghi để khỏi tranh luận lại)

- **`features/*` theo chiều dọc** ("package per feature") — nhịp đổi giống hệt nhau, chỉ đẻ boilerplate.
- **store slices** — state là chất keo của app, tách = circular dependency với features.
- **`AudioEngine`** — dùng Web Audio + Tauri asset protocol, 1 consumer duy nhất.
- **Whisper/FFmpeg wrappers thành crate "SDK"** — chưa có consumer thứ 2; YAGNI.

---

## 4. Cấu trúc workspace đích

```
audiogram/                          # repo root
├── package.json                    # "workspaces": ["apps/*", "packages/*"]
├── apps/
│   └── desktop/                    # Vite app hiện tại (src/ dọn vào đây)
│       ├── src/                    #   app, core, store, features, ui*
│       └── src-tauri/              # app crate (application, presentation,
│                                   #   infra/{ffmpeg-io,whisper}, main)
├── packages/
│   ├── contract/                   # @audiogram/contract  (gen + json nguồn)
│   ├── wave-effects/               # @audiogram/wave-effects
│   ├── segments/                   # @audiogram/segments        (đợt 2)
│   ├── renderer/                   # @audiogram/renderer        (đợt 3)
│   └── ui/                         # @audiogram/ui              (đợt 3)
└── crates/                         # cargo workspace members
    ├── audiogram-core/
    ├── audiogram-spectrum/
    ├── audiogram-render/
    └── audiogram-subtitle/

# Cargo.toml (root hoặc apps/desktop/src-tauri) — [workspace]
# members = ["crates/*", "apps/desktop/src-tauri"]
```

**Quy ước chuyên nghiệp cho mỗi package/crate:**
- README riêng (mục đích, API chính, ví dụ 10 dòng), CHANGELOG khi bắt đầu publish.
- Test sống cùng package; `npm test -w @audiogram/wave-effects` / `cargo test -p audiogram-render` chạy độc lập.
- Private packages: version cố định `0.0.0` + path/workspace deps — KHÔNG semver nội bộ (chỉ thêm changesets nếu publish `wave-effects` ra npm thật).
- Public API qua `exports` field / `pub` re-export tại `lib.rs` — không deep-import xuyên package (ESLint/clippy chặn).

**Tooling:** npm workspaces + cargo workspace là ĐỦ ở quy mô này. Chưa cần Turborepo/Nx — thêm khi tổng thời gian build vượt ~2 phút hoặc số package >8. Vite alias trỏ thẳng src của packages trong dev (không cần build-watch từng package).

---

## 5. Giá trị chiến lược của từng lát cắt (vì sao đáng công)

1. **`audiogram-render` là con át chủ bài.** Tách xong, cùng một lõi render phục vụ: app desktop (hiện tại) → `audiogram-cli` render headless/batch (sản phẩm bán thêm cho power user / CI của podcast network) → về sau server-side nếu muốn. Golden-frame tests (TECH_ARCHITECTURE §2.4c) cũng chạy trên crate này không cần Tauri — CI nhanh và ổn định.
2. **`@audiogram/wave-effects` là mặt tiền OSS.** Package canvas-visualizer sạch, zero-dep, publish npm được — vừa là kênh marketing tự nhiên cho app, vừa ép chính mình giữ interface effect sạch (điều kiện tiên quyết của plugin Cấp 2).
3. **`@audiogram/contract` + `audiogram-core` là hai đầu của cây cầu parity.** Khi cả 2 phía cùng import từ package sinh tự động, bảng "must stay in sync" trong CLAUDE.md từ lời dặn trở thành điều bất khả vi phạm.
4. **Ranh giới package = ranh giới plugin.** Extension kernel (TECH_ARCHITECTURE Phần III) trỏ vào `wave-effects`/`renderer` như host — plugin bên thứ ba lập trình đúng theo API package đã publish, không với vào ruột app.

---

## 6. Kế hoạch thực hiện

Khớp với lộ trình TECH_ARCHITECTURE Phần V — tách package KHÔNG phải dự án riêng, mà là *cách thực hiện* các phase đó:

### Đợt 1 — cùng Phase 1 kiến trúc (~2 ngày thêm)
1. Dựng npm workspaces + cargo workspace, di chuyển app vào `apps/desktop` (thuần cơ học — làm 1 commit riêng, không trộn logic).
2. `audiogram-spectrum` (rẻ nhất — proof workspace chạy), rồi `audiogram-core`:
   - Cắt `emit_log` khỏi `shared/util` → ở lại app crate; phần thuần vào core.
3. `audiogram-render`: thay `AppHandle`+`Emitter` bằng `trait ProgressSink`; app crate implement sink bắn Tauri event. `audiogram-subtitle` tương tự (không cần sink).
4. `@audiogram/contract`: codegen output thành package; `@audiogram/wave-effects`: đổi `id` sang string, thêm package.json + vitest smoke test.
5. CI: matrix `cargo test -p` từng crate + `npm test -ws`.

### Đợt 2 — cùng Phase 2 (nửa ngày)
6. `@audiogram/segments` — tạo package ngay lúc di dời splitSegments khỏi StepTranscript (một lần chuyển, đến thẳng đích).

### Đợt 3 — cùng Phase 3 (trong ngân sách CompositionSpec)
7. `@audiogram/renderer` — khi mổ WaveformCanvas cho CompositionSpec, phần compositor thuần rơi vào package luôn.
8. `@audiogram/ui` — sau khi primitives sống qua Design+Captions mode mà API đứng yên ≥2 tuần.

### Cột mốc kiểm chứng (definition of done cho toàn kế hoạch)
- [ ] `cargo test -p audiogram-render` chạy golden frames < 30s, không cần Tauri/webview
- [ ] `npm test -w @audiogram/wave-effects` vẽ 9 effects qua node-canvas không lỗi
- [ ] App crate không còn chứa code render/subtitle/spectrum — chỉ orchestration
- [ ] Không package nào import ngược về `apps/desktop` (ESLint + cargo-deny check)
- [ ] README từng package đủ để người mới hiểu API trong 5 phút

### Rủi ro & đối sách

| Rủi ro | Đối sách |
|---|---|
| Di chuyển file ồ ạt phá git blame/history | `git mv` thuần trong commit riêng biệt, không sửa nội dung cùng commit |
| Vite/Tauri config lệch sau khi vào `apps/desktop` (đường dẫn binaries/, models/, tauri.conf) | Làm bước 1 độc lập, chạy `npm run tauri dev` + `tauri build` xác nhận trước khi tách crate nào |
| `trait ProgressSink` làm chậm hot loop render | Sink nhận batch event theo % nguyên (như hiện tại đã throttle), generic static dispatch — chi phí ~0 |
| Tách `ui` quá sớm rồi API đổi liên tục | Đã chủ động lùi sang đợt 3 với điều kiện "đứng yên 2 tuần" |
| Cám dỗ tách tiếp (features, store...) | Mục §3.3 là danh sách đóng — mở lại phải có consumer thứ 2 bằng xương bằng thịt |
```
