# Audiogram — Review mã nguồn & kế hoạch tối ưu
*Ngày review: 27/07/2026 · Trạng thái repo: Phase 1 (T1–T18) đã xong + fix cover image*

> **Quan hệ với tài liệu đã có:** `UI_REBUILD_PLAN.md` §5 đã hoạch định Phase 2–4 (Start screen, Design mode, Captions mode, Export sheet, undo/redo, persistence, polish — ~10–13 ngày). Tài liệu này **không lặp lại** kế hoạch đó. Nó bù vào phần Phase 2–4 KHÔNG chạm tới: nền tảng parity render, test an toàn, hiệu năng, và nợ kỹ thuật — kèm khuyến nghị **thứ tự** chen vào giữa Phase 2–4.

---

## A. Tình trạng hiện tại (đo được)

| Chỉ số | Giá trị |
|---|---|
| Frontend | 6.838 LOC TS/TSX |
| Rust | 3.533 LOC, 5 crate (`core`/`spectrum`/`render`/`subtitle` + app) |
| Test | 75 JS (2 workspace) + 11 Rust |
| Component cũ còn lại | 5 file, 2.862 LOC = **42% frontend** |
| Code chết | 644 LOC (**9,4%** frontend) |

**Phase 1 đã giải quyết tốt:** workspace/crate split sạch, contract codegen khoá hằng số 2 phía, IPC typed, ProgressSink cắt Tauri khỏi render loop, CI. Nền kiến trúc Rust hiện đã vững — phần lớn rủi ro còn lại nằm ở **ranh giới preview↔export** và ở **frontend chưa port**.

---

## B. Phát hiện, theo mức độ

### 🔴 F1 — Ba engine render chữ khác nhau *(rủi ro kiến trúc lớn nhất)*

| Đường | Engine | Ngắt dòng |
|---|---|---|
| Preview | Canvas2D `fillText` | `wrapText()` — đo **pixel thật** |
| Export: title | ffmpeg `drawtext` (fontconfig) | `wrap_text_2lines(title, 30)` — đếm **ký tự cứng** |
| Export: subtitle | libass (ffmpeg `ass` filter) | libass tự xử lý |

`CLAUDE.md` tuyên bố *"preview và export phải giống hệt"* là invariant sống còn. T14 đã khoá được **hằng số** — nhưng **chữ**, thứ người dùng nhìn thấy rõ nhất, vẫn nằm hoàn toàn ngoài hợp đồng đó. Ba engine ⇒ ba bộ metric, ba kiểu ngắt dòng, ba kiểu canh vị trí.

Kèm theo: `drawtext:font='Arial'` phụ thuộc **fontconfig lúc chạy** — máy thiếu font thì fail hoặc âm thầm thay font khác. Đây đúng là dạng lỗi vừa gặp với ảnh EXIF: preview đúng, export sai, và không có gì bắt được.

**Hướng sửa:** rasterize chữ bằng Rust (`cosmic-text`, hoặc `ab_glyph` + `fontdue`) ngay trong `audiogram-render` → bỏ `drawtext`, giai đoạn sau bỏ luôn libass. Đổi lại: `frame.rs` tự chứa hoàn toàn, bỏ được 1 external dependency, và **golden test phủ được cả chữ**.
**Ước lượng:** 3–4 ngày.

---

### 🔴 F2 — Golden-frame test: đã thiết kế, chưa xây

`TECH_ARCHITECTURE.md` §2.4c mô tả đầy đủ (render t=0/25%/50% × template × style → so pixel-hash). Chưa có dòng nào.

Sau T16, `audiogram-render` là crate thuần — không Tauri, không ffmpeg, không webview — nên giờ việc này **rẻ hơn hẳn** so với lúc viết spec. Hiện tại parity chỉ được bảo vệ bằng **mắt người**.

**Ước lượng:** 1 ngày.

---

### 🔴 F3 — Backend đã xây xong nhưng UI không dùng *(đã trả tiền, chỉ cần nối dây)*

Kiểm chứng bằng grep — 0 UI consumer:

| Đã có sẵn | Người dùng đang mất gì |
|---|---|
| `ipc.cancelRender()` + `cancel_render` (T9) | **Không huỷ được render** đang chạy |
| `stage` (preparing/captions/frames/encoding) | Không biết đang ở giai đoạn nào |
| `etaSeconds` (T9 tính sẵn) | Không thấy còn bao lâu |
| `frame` / `totalFrames` | Không thấy tiến độ thật |

`StepExport` vẫn chỉ đọc mỗi `progress` (số 0–100 kênh cũ). Phase 3 §18 sẽ dùng — nhưng đây là thứ **rẻ nhất trong toàn bộ danh sách**, không nên đợi.

**Ước lượng:** 0,5 ngày (nối tạm vào StepExport), hoặc 0 ngày nếu gộp thẳng vào ExportSheet Phase 3.

---

### 🟡 F4 — Code chết: 644 LOC

`StepCustomize.tsx` (472) + `TranscriptPanel.tsx` (172) — **không file nào import**. Xoá thẳng.
**Ước lượng:** 10 phút.

---

### 🟡 F5 — `analyze_spectrum` không gate theo wave style

`WaveformCanvas.tsx:504` gọi mỗi lần đổi audio, **bất kể style**. Mỗi lần = decode FFmpeg toàn file + STFT. Với podcast 60 phút, đây là hàng chục giây CPU + RAM lãng phí cho 8/9 style không dùng tới FFT.

**Sửa:** chỉ gọi khi `waveStyle === 'eq'`, cache theo path. Gộp vào Phase 2 lúc port preview.
**Ước lượng:** 0,5 ngày.

---

### 🟡 F6 — Decode audio 2 lần

`WaveformCanvas` tự decode song song với `AudioEngine` (đã ghi `TODO(p1-t10)` — cố ý hoãn). Phase 2 port preview sẽ xử lý. *Không cần hành động riêng.*

---

### 🟡 F7 — Tải model bằng `curl` subprocess

`model_repo.rs:114` spawn `curl`. Không đảm bảo có trên Windows sạch. Đổi sang `reqwest` (đồng thời bỏ được luôn cái polling-thread đo tiến độ bằng kích thước file — `reqwest` cho stream progress trực tiếp).
**Ước lượng:** 0,5 ngày.

---

### 🟢 F8 — Cơ hội chiến lược: `audiogram-cli`

`PACKAGE_SPLIT_PLAN.md` §5 nêu đây là lý do chính tách `audiogram-render`. Sau T16, một CLI render headless **gần như miễn phí** — crate đã thuần, đã có `ProgressSink`/`NullSink`, chỉ cần một `main.rs` + arg parsing + phần spawn ffmpeg (hiện nằm ở app crate, cần tách nhẹ).

Giá trị: sản phẩm thứ 2 từ cùng lõi (batch render cho podcast network / CI), đồng thời **là môi trường test parity tốt nhất** — export thật không cần GUI.
**Ước lượng:** 1,5–2 ngày. **Không bắt buộc** — đề xuất để cân nhắc, không đưa vào đường găng.

---

## C. Kế hoạch — chen vào đâu giữa Phase 2–4

Điểm mấu chốt về **thứ tự**: Phase 2 sẽ viết lại renderer preview (`WaveformCanvas` → `CanvasStage` + `@audiogram/renderer`). **Nếu chưa có golden test trước lúc đó, không có cách nào biết bản port có làm lệch parity hay không** — và đó chính là invariant số 1 của dự án.

```
NGAY BÂY GIỜ  ─ Đợt 0: Quick wins (≈1 ngày)
                 F4 xoá code chết · F3 nối cancel/ETA/stage · F7 bỏ curl
                        │
                        ▼
TRƯỚC Phase 2 ─ Đợt 1: Lưới an toàn (≈1 ngày)     ◄── QUAN TRỌNG NHẤT
                 F2 golden-frame test
                        │
                        ▼
              ─ Phase 2 (UI_REBUILD_PLAN §5) + F5 gate spectrum, F6 bỏ decode kép
                        │
                        ▼
TRƯỚC Phase 3 ─ Đợt 2: Thống nhất render chữ (3–4 ngày)
                 F1 rasterize text trong Rust, bỏ drawtext
                 → mở rộng golden test phủ luôn chữ
                        │
                        ▼
              ─ Phase 3 + Phase 4 (như UI_REBUILD_PLAN)
                        │
                        ▼
TUỲ CHỌN      ─ F8 audiogram-cli
```

**Tổng thêm vào ngoài Phase 2–4: ~5–6 ngày** (chưa tính F8).

### Đợt 0 — làm ngay, tính bằng giờ

| # | Việc | Ước lượng |
|---|---|---|
| 0.1 | Xoá `StepCustomize.tsx` + `TranscriptPanel.tsx` | 10 phút |
| 0.2 | Nối `stage`/`progressPct`/`etaSeconds`/`frame` vào UI export hiện tại | 3 giờ |
| 0.3 | Thêm nút **Cancel** gọi `ipc.cancelRender()` | 1 giờ |
| 0.4 | `curl` → `reqwest` + stream progress | 3 giờ |

### Đợt 1 — lưới an toàn parity

| # | Việc |
|---|---|
| 1.1 | `cargo test golden_frames`: 6 template × 3 style tiêu biểu × t={0, 25%, 50%}, peaks cố định → PNG vào `crates/audiogram-render/tests/golden/` |
| 1.2 | So pixel-hash với bản đã commit; lệch thì ghi ảnh diff ra `target/` để xem bằng mắt |
| 1.3 | Nối vào CI job `rust` (đã có sẵn từ T18) |
| 1.4 | Ghi vào `CLAUDE.md`: đổi hằng số/geometry ⇒ phải regenerate golden + review ảnh diff |

### Đợt 2 — thống nhất render chữ (sau Phase 2, trước Phase 3)

| # | Việc |
|---|---|
| 2.1 | Thêm `cosmic-text` vào `audiogram-render`; API `draw_text(buf, rect, text, style)` |
| 2.2 | Bundle font (Inter — đã có sẵn cho UI) vào crate thay vì dựa fontconfig |
| 2.3 | Chuyển title từ ffmpeg `drawtext` → `frame.rs`; xoá phần drawtext khỏi `build_filter_complex` |
| 2.4 | Ngắt dòng: 1 thuật toán duy nhất, đo bằng font metric thật, đưa vào `contract/` như T14 đã làm với hằng số |
| 2.5 | Mở rộng golden test phủ title |
| 2.6 | *(Có thể hoãn)* Subtitle: libass → cùng đường rasterize; cần cân nhắc vì libass xử lý karaoke `\kf` khá phức tạp |

---

## D. Cố ý KHÔNG đưa vào

- **Phase 2–4 UI work** — đã có kế hoạch tốt trong `UI_REBUILD_PLAN.md`, không viết lại.
- **Mọi mục trong `UI_REBUILD_PLAN.md` §6 "Việc KHÔNG làm"** — timeline kéo-thả, multi-project dashboard, light theme, free-form canvas. Tôn trọng nguyên trạng.
- **Đổi kiến trúc Rust thêm nữa** — sau T15/T16 phần này đã đúng chỗ; tách tiếp là over-engineering (theo đúng `PACKAGE_SPLIT_PLAN.md` §3.3).
- **i18n framework** — app đang trộn Việt/Anh trong UI, nhưng `UI_REBUILD_PLAN` Phase 4 §24 đã nhận và chọn hướng "1 ngôn ngữ"; thêm i18n lib lúc này là scope creep.

---

## E. Nếu chỉ làm được 1 việc

**Đợt 1 (golden-frame test, 1 ngày).**

Lý do: Phase 2 sắp viết lại toàn bộ renderer preview. Đây là cửa sổ duy nhất để dựng lưới an toàn *trước khi* đụng vào thứ mà cả dự án tuyên bố là invariant sống còn — và chi phí lúc này đang ở mức thấp nhất nhờ T16 đã tách crate thuần.
