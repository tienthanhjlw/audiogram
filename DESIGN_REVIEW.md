# Audiogram — Design Review & Improvement Report
*Ngày review: 25/06/2026 | Reviewer: Claude*

---

## Executive Summary

Audiogram có nền tảng kỹ thuật tốt nhưng UI/UX hiện tại chưa truyền đạt được giá trị sản phẩm. Vấn đề lớn nhất không phải là thẩm mỹ — mà là **kiến trúc thông tin sai**, khiến người dùng bị mất phương hướng ngay từ màn hình đầu tiên. Trước khi có thể bán được, app cần giải quyết 3 vấn đề cốt lõi:

1. **Xóa bỏ navigation kép** (sidebar + step pills làm cùng 1 việc)
2. **Tách Settings ra khỏi màn Import** (sai bước, sai context)
3. **Tăng kích thước cửa sổ** (800×600 quá nhỏ cho content-creation tool)

---

## 1. Những gì đang hoạt động tốt ✅

- **Brand color** `#6C4FF6` — purple nhất quán, professional
- **Drop zone** interaction — drag & drop rõ ràng, đúng convention
- **Step progress pills** trong top bar — visual hierarchy hợp lý
- **WaveformCanvas preview** ở Layout step — core value prop được thể hiện
- **Sidebar icon design** — clean, readable ở 16×16px
- **Inspector panel** (click element → edit) — powerful pattern đúng hướng

---

## 2. Vấn đề nghiêm trọng 🔴

### 2.1 Navigation kép — người dùng không biết dùng cái nào

```
HIỆN TẠI:
┌─────────────────────────────────────────────────────┐
│ [sidebar]  │  Create Audiogram                       │
│ ● Import   │  Step 1 of 4 · Import                   │
│   Customize│  [1 Import] [2 Customize] [3 Transcript] │
│   Transcript│                                        │
│   Export   │  ... content ...                        │
└─────────────────────────────────────────────────────┘
```

Sidebar nav **và** step pills đều điều hướng cùng 4 bước. Kết quả:
- Người dùng không biết click cái nào
- Sidebar chiếm 220px cho chức năng đã có ở top bar
- "Create Audiogram" + "Step 1 of 4" + "Import" = cùng 1 thông tin × 3 lần

**Fix:** Chọn 1 trong 2 navigation system. Xem đề xuất ở mục 5.

---

### 2.2 Settings (Canvas Size + Frame Rate) nằm sai màn hình

Màn Import hiện tại có layout 2 cột:
- **Trái**: Drop zone (đúng)
- **Phải**: Settings — Canvas Size + Frame Rate (SAI VỊ TRÍ)

**Tại sao sai?**
- User chưa chọn file → chưa biết họ sẽ tạo gì → không thể quyết định được Canvas Size
- Canvas Size liên quan đến visual layout, không liên quan đến bước import
- Frame Rate là kỹ thuật chi tiết — user không nên thấy nó ở bước đầu tiên
- "Next: Customize →" button bị disable nhưng nằm trong Settings panel → confused

**Fix:** Settings panel → chuyển sang Layout step. Import screen chỉ có: drop zone + episode title.

---

### 2.3 Cửa sổ 800×600 quá nhỏ

Một tool làm video content mà cửa sổ nhỏ hơn thumbnail YouTube. Khi Layout step cần hiển thị canvas preview + inspector panel, không gian 800×600 gần như không đủ.

**Fix:** `tauri.conf.json` → width: 1200, height: 760, minWidth: 900, minHeight: 600

---

### 2.4 Không có "moment of value" — người dùng không thấy output

Người dùng mở app, thấy upload screen trắng. Không có gì cho biết:
- Output trông như thế nào
- App làm được gì khác biệt so với tool khác
- Có ví dụ mẫu không

Đây là vấn đề sản phẩm — không phải UI. Nếu muốn bán được, phải có "wow moment" ngay khi mở app.

---

## 3. Vấn đề vừa 🟡

### 3.1 Typography scale quá nhỏ và đồng đều

| Element | Hiện tại | Đề xuất |
|---------|----------|---------|
| Section labels | 11px uppercase | 11px uppercase ✓ (giữ) |
| Body text | 12-13px | 13-14px |
| Headings per screen | 22px | 28-32px |
| Button text | 13-14px | 14px ✓ (giữ) |
| App title header | 16px bold | Bỏ — trùng lặp |

Mọi thứ đang ở cùng visual weight. User không biết đâu là primary action, đâu là secondary.

### 3.2 "Settings" label trên Import screen

Dùng từ "Settings" cho Canvas Size và Frame Rate không truyền đạt context. User nghĩ đây là app settings, không phải export settings.

### 3.3 Sidebar "Customize" → "Layout" naming không nhất quán

- Sidebar: **Customize**
- Step pill: **Customize** 
- Code: `StepLayout.tsx`, `layout` step key

Tên "Customize" không đủ đặc trưng. "Layout" hay "Design" rõ ràng hơn.

### 3.4 Disabled nav items không đủ rõ

Sidebar items bị disable (Customize, Transcript, Export) chỉ giảm opacity xuống 50%. Không có tooltip giải thích tại sao disabled hay cần làm gì để unlock.

### 3.5 "Free plan" ở sidebar — không có context

User thấy "Free plan" nhưng không biết Pro plan là gì, có gì hơn, hay cách upgrade. Nếu muốn monetize, cần có upsell path rõ ràng.

---

## 4. Vấn đề nhỏ 🟢

### 4.1 Header "Create Audiogram" không cần thiết

Mỗi màn hình đã có heading riêng ("Import audio", etc.). Header bar chỉ cần step indicator.

### 4.2 "Step 1 of 4 · Import" text dưới header

Text này bị ẩn sau "Create Audiogram" và step pills. Thừa — loại bỏ.

### 4.3 Browse files button trong drop zone không cần thiết

Click vào drop zone đã browse được. Có thêm button tạo ra 2 targets cho cùng 1 action.

### 4.4 Logo icon quá nhỏ để nhận ra

32×32px logo box ở sidebar — wave icon không đủ detail ở size này. Cần 40×40 tối thiểu.

### 4.5 Màu nền sidebar trùng với content area

Cả sidebar (#fff) và content background (#F8F9FA) gần giống nhau → ranh giới mờ nhạt.

---

## 5. Kiến trúc thông tin đề xuất

### Option A: Giữ Sidebar, bỏ Step Pills (recommended)

```
┌──────────┬────────────────────────────────────────┐
│  Logo    │  [top bar chỉ có title + actions]      │
│          ├────────────────────────────────────────┤
│ ①Import  │                                        │
│ ②Layout  │  [content area - step tương ứng]       │
│ ③Caption │                                        │
│ ④Export  │                                        │
│          │                                        │
│  ─────   │                                        │
│  User    │                                        │
└──────────┴────────────────────────────────────────┘
```

Sidebar trở thành navigation chính. Số thứ tự (①②③④) thể hiện flow. Bỏ step pills khỏi top bar. Top bar chỉ giữ: tên file đang làm + action buttons (Export nhanh, Settings).

### Option B: Bỏ Sidebar, giữ Step Pills (cleaner, smaller window)

```
┌────────────────────────────────────────────────────┐
│  [logo + app name]  [Import → Layout → Caption → Export]  │
├────────────────────────────────────────────────────┤
│                                                    │
│           [content area - full width]              │
│                                                    │
└────────────────────────────────────────────────────┘
```

Phù hợp hơn với pattern của Descript, CapCut Web. Tiết kiệm 220px horizontal space. Content area rộng hơn nhiều.

**Recommendation**: Chọn Option B nếu hướng tới một tool đơn giản, dễ bán. Option A nếu muốn thêm features sau (Projects, Templates, History).

---

## 6. Phân tích từng màn hình

### Screen 1: Import
**Hiện tại**: Upload zone + Settings (Canvas + FPS) side by side
**Vấn đề**: Settings không phù hợp context. Layout 2 cột tạo attention split.
**Đề xuất**:
```
┌──────────────────────────────────────────┐
│                                          │
│        [Drop zone — full width]          │
│        Drop audio file here              │
│                                          │
│    Episode title: [input field]          │
│                                          │
│         [Browse files button]            │
│                                          │
└──────────────────────────────────────────┘
```
Đơn giản, 1 action, 1 focus. Canvas Size chuyển sang Layout step.

---

### Screen 2: Layout / Customize
**Hiện tại**: Inspector panel context-switch (click element → panel changes) — đây là pattern tốt!
**Vấn đề nhỏ**: 
- Canvas Size và FPS nên được ADD vào đây (từ Import step chuyển sang)
- Template grid 2×2 tốt nhưng cần thumbnail preview thực sự thay vì text-only
- "Click a zone to inspect" hint text không đủ rõ cho new users

**Đề xuất**: Thêm onboarding tooltip lần đầu mở: "Click vào element trên canvas để chỉnh sửa".

---

### Screen 3: Transcript
**Hiện tại**: Chưa review kỹ UI nhưng từ code thấy:
- Model download UX tốt (progress per model)
- Segment editor (click to edit) đúng hướng

**Vấn đề tiềm ẩn**:
- Transcript là step 3 nhưng subtitle style (color, karaoke) nằm ở Layout step (step 2). User phải đi ngược lại để chỉnh subtitle sau khi transcribe.
- Fix: Subtitle styling nên ở Transcript step, sau khi đã có text.

---

### Screen 4: Export
**Từ code thấy**: Progress bar + log panel + waveform preview — OK về chức năng.

**Vấn đề**:
- Log panel (raw FFmpeg output) không phù hợp với end users. Chỉ developers cần xem này.
- Không có estimated time remaining.
- Không có "Share" / "Open in Finder" action sau khi xuất xong.

---

## 7. Visual Design System — Cần cải thiện

### Color
```
Hiện tại:
- Primary: #6C4FF6 ✓
- Background: #F8F9FA (quá nhạt, không cá tính)
- Sidebar bg: #FFFFFF (không phân biệt với content)
- Text: #111827 / #6B7280 / #9CA3AF ✓

Đề xuất:
- Sidebar bg: #F3F0FF (light purple tint) → phân biệt rõ với content
- Content bg: #FAFAFA (giữ gần trắng)
- Accent bg: #EDE9FF → #EAE5FF (đậm hơn 1 chút)
```

### Spacing
Hiện tại padding/gap rất inconsistent: 6, 8, 10, 12, 14, 16, 18, 20, 24 đều xuất hiện. Cần chuẩn hóa về 4-point grid: 4, 8, 12, 16, 24, 32, 48.

### Window sizing
```json
// tauri.conf.json — CẦN THAY ĐỔI
{
  "width": 1200,
  "height": 760,
  "minWidth": 960,
  "minHeight": 600,
  "resizable": true
}
```

---

## 8. Để bán được — Product Positioning

Đây là vấn đề lớn nhất. Audiogram cạnh tranh với:
- **Wavve** ($16/mo) — đơn giản, nhiều template
- **Headliner** ($19/mo) — AI transcript, auto-audiogram
- **Descript** ($24/mo) — full podcast suite

Audiogram có **lợi thế khác biệt**: **100% local, private, one-time purchase, no subscription**. Đây là thứ cần được nêu bật ngay từ màn hình đầu tiên.

### Thêm vào UI ngay:
1. **Splash/onboarding screen** (chỉ lần đầu mở): "Your audio stays on your Mac. No cloud. No subscription. No privacy risk." với CTA "Get started →"
2. **Template gallery** thay vì text list: Hiển thị thumbnail 4-6 style mẫu. User thấy output ngay trước khi upload.
3. **Recent projects** ở màn hình đầu: Lần 2+ mở app, user thấy ngay project cũ.

---

## 9. Priority Roadmap

### Phase 1 — Fix Critical (1-2 ngày) 🔴
1. **Tăng window size**: 1200×760
2. **Bỏ 1 trong 2 navigation**: Giữ sidebar, bỏ step pills (hoặc ngược lại)
3. **Chuyển Canvas Size + FPS** sang Layout step
4. **Import screen**: Single column, full width drop zone + title input only

### Phase 2 — UX Polish (3-5 ngày) 🟡
5. **Template thumbnails**: Thay text list bằng visual thumbnail grid
6. **Sidebar bg color**: #F3F0FF để phân biệt với content area
7. **Transcript step**: Di chuyển subtitle styling vào đây
8. **Export**: Ẩn FFmpeg log sau progress bar đẹp hơn
9. **Tooltip cho locked nav items**: "Upload audio first to unlock"

### Phase 3 — Product Value (1-2 tuần) 🟢
10. **Recent projects**: Lưu và hiển thị project history
11. **Template gallery screen**: Visual first-run experience
12. **"No subscription" badge**: Marketing copy trong app
13. **Export success screen**: Animation + Open in Finder + Share
14. **Keyboard shortcuts**: ⌘R = Render, ⌘Z = Undo layout changes

---

## 10. Quick Wins — Thay đổi nhỏ, impact lớn

Có thể làm trong < 1 giờ mỗi cái:

| Thay đổi | Effort | Impact |
|----------|--------|--------|
| Window size 800→1200 | 2 min | Rất cao |
| Import screen: bỏ Settings panel | 15 min | Cao |
| Sidebar bg: #fff → #F5F3FF | 2 min | Trung bình |
| "Create Audiogram" header → bỏ | 5 min | Trung bình |
| Button "Browse files" trong drop zone → bỏ | 2 min | Nhỏ |
| Disabled nav items: thêm tooltip | 10 min | Trung bình |
| App window title: "audiogram" → "Audiogram" | 1 min | Nhỏ |

---

*Report này dựa trên: screenshot UI thực tế + source code review đầy đủ (App.tsx, Sidebar.tsx, StepUpload.tsx, StepLayout.tsx, StepExport.tsx, types.ts)*

---

## 11. Live Review — Walkthrough thực tế (25/06/2026)

Đã mở app và đi qua cả 4 màn hình thực tế. Một số điểm report cũ nhận định sai, và có thêm nhiều vấn đề mới quan sát được.

### Điều chỉnh so với report cũ

**Import screen**: Clean hơn tưởng tượng. Không còn Settings panel ở đây. Chỉ có: drop zone + file info card + title input + "Next: Layout →". **Đây là màn hình tốt nhất trong 4 màn hình.**

**Canvas Size + Frame Rate**: Đã nằm đúng chỗ trong Layout step. Report cũ nhận định sai.

---

### Findings mới từ live walkthrough

#### A. Layout Step — Template và Wave Style không có thumbnail

Đây là vấn đề nghiêm trọng nhất trong toàn bộ app:

**Template cards (6 cards)**:
```
Podcast              Split
Avatar center · wave   Image left · wave right
below

[SELECTED] Minimal   Full Cover
Wave is the main      Full image bg ·
character             overlay on top

Karaoke              Brand
Large text center ·   Logo left · visualizer
wave below            right
```
Tất cả 6 template đều chỉ là text. User không có cách nào biết "Split" trông khác gì "Brand" mà không click từng cái.

**Wave Style cards (9 cards trong inspector)**:
```
Bars          Wave
Vertical bars   Smooth curve

Mirror        LED
Symmetric       Dot matrix

Neon          Orbit
Glow bars       Radial / circular

Pulse         EQ
Bell-curve bloom  Spectrum analyzer

Player
Media player
```
9 style không có preview. "Orbit" là gì? "Pulse" trông thế nào? User phải click và chờ để xem.

**Fix**: Thêm mini-preview SVG (static) vào mỗi card. Chỉ cần 40×30px illustration cho mỗi option là đủ để phân biệt.

---

#### B. Inspector Panel — Interaction hoàn toàn ẩn

Khi ở Global Panel, có text nhỏ ở góc phải: "Click a zone to inspect". Không có animation, không có highlight, không có tooltip. User không biết họ cần click vào canvas.

Khi click vào waveform zone:
- Toàn bộ left panel thay đổi ngay lập tức → không có transition, có cảm giác đột ngột
- Header panel chuyển từ "TEMPLATE" sang "← Waveform" với icon màu tím
- Top right của preview thay đổi thành "Editing Waveform · drag to move" + "Reset layout" button

Đây là **hidden interaction** — user không có cách khám phá ra nếu không được hướng dẫn.

**Fix**: Khi lần đầu vào Layout step, show một animated overlay: "Click vào bất kỳ vùng nào trên canvas để chỉnh sửa" với mũi tên chỉ vào canvas. Dismiss khi user click lần đầu.

---

#### C. Transcript Step — Ngôn ngữ không nhất quán

| Phần UI | Ngôn ngữ |
|---------|---------|
| Step pills: "Transcript" | Tiếng Anh |
| Section header: "Nhận dạng giọng nói" | Tiếng Việt |
| "CHỌN MODEL" | Tiếng Việt |
| "↓ Tải" button | Tiếng Việt |
| "BUNDLED" badge | Tiếng Anh |
| "Subtitle Style" heading | Tiếng Anh |
| "Hiển thị subtitle khi export" | Tiếng Việt |
| "MÀU CHỮ SUBTITLE" | Tiếng Việt |
| "Karaoke highlight" | Tiếng Anh |

Không nhất quán. Nếu app target người Việt → toàn tiếng Việt. Nếu global → toàn tiếng Anh.

---

#### D. Transcript Step — Playback controls nằm sai vị trí

```
LEFT PANEL:                    RIGHT PANEL:
┌──────────────────────┐       ┌───────────────────┐
│ Model selector       │       │ Subtitle Style    │
│ Transcribe button    │       │                   │
│                      │       │ [Preview canvas]  │
│ [▶ 0:00 / 0:24 ══] ← │──────►│                   │
│ ▶ Kinh thánh là nơi  │       │                   │
│                      │       │                   │
│ 11 SEGMENTS ──       │       │                   │
│ [segment list]       │       │                   │
└──────────────────────┘       └───────────────────┘
```

Playback controls (▶ button, seek bar, current segment text) nằm trong **left panel** nhưng control **preview canvas** ở **right panel**. User phải nhìn trái-phải để kết nối playback state với preview.

**Fix**: Đặt playback controls ngay bên dưới preview canvas, hoặc overlay trên preview.

---

#### E. Transcript Step — "Karaoke highlight" bị disabled không rõ lý do

Toggle "Karaoke highlight" luôn greyed out ngay cả khi đã transcribe xong. Description nói "Chữ sweep theo tiến trình audio" nhưng không giải thích tại sao disabled. User bị confused.

Từ code: Karaoke chỉ hoạt động với template `karaoke`. User đang dùng template `minimal` nên disabled. **Nhưng UI không nói điều này**.

**Fix**: Tooltip khi hover disabled toggle: "Chỉ khả dụng với template Karaoke. Quay lại Layout để đổi."

---

#### F. Transcript Step — Status bar hiển thị hex code

Dòng cuối trang: `11 segments · chữ #FFFFFF`

Người dùng thấy `#FFFFFF` nhưng họ không cần biết hex value này. Nên là: `11 segments · màu trắng` hoặc chỉ hiện màu swatch.

---

#### G. Export Step — LOGS panel hoàn toàn developer-facing

```
LOGS
Ready — click Export MP4 to start.
```

Dark terminal box với monospace font. Khi đang render: shows raw FFmpeg output (frame numbers, fps rates, bitrate, etc.). End user không cần thấy điều này. Thậm chí trông giống app bị lỗi.

**Fix**: Ẩn logs hoàn toàn. Thay bằng:
- Progress bar với phần trăm + estimated time remaining
- Sau khi xong: "✓ Xuất thành công! [Open in Finder]" button
- Nếu lỗi: "Có lỗi xảy ra. [Thử lại] [Xem chi tiết]"

---

#### H. Export Step — "audiogram" watermark trên mọi canvas

Ở góc dưới của canvas preview, text nhỏ "audiogram" xuất hiện. Nếu watermark này cũng có trong file export, user cần biết. Nếu chỉ là preview UI element thì OK nhưng có thể bỏ.

---

### Điều thực sự TỐT (phát hiện mới)

- **Preview subtitle rendering** trông RẤT ĐẸP — text "Kinh thánh là nơi" trong dark rounded pill, white text, clean và modern. Đây là **hero feature** cần được show off ngay từ đầu.
- **Model download UI** trong Transcript rất clear: BUNDLED badge, ✓ = downloaded, "↓ Tải" = not downloaded. User hiểu ngay.
- **Segment list** (0:00 → 0:01 [1.9s] + text) — functional và clean.
- **Export summary table** — simple, clear, easy to review.
- **"Subtitles enabled · 11 segments from Whisper"** badge trong Export — đẹp và reassuring.
- **Waveform preview animation** — ĐẸP. Bars gradient, smooth movement. Đây là core value của product và nó tốt.

---

### Updated Priority List

**Phase 1 — Ngay lập tức (mỗi item < 30 phút):**
1. Ẩn LOGS panel → thay bằng progress state + success screen
2. Sửa "chữ #FFFFFF" → tên màu hoặc color swatch
3. Thêm tooltip cho "Karaoke highlight" disabled: "Chỉ dùng với template Karaoke"
4. Đặt playback controls bên dưới preview, không phải trong left panel
5. Chọn 1 ngôn ngữ cho toàn app (Tiếng Anh recommended nếu muốn bán global)

**Phase 2 — Visual (1-3 ngày):**
6. Template cards: thêm mini SVG preview (40×30px)
7. Wave style cards: thêm mini animated/static preview
8. Layout step: onboarding overlay "Click vào canvas để chỉnh sửa"
9. Sidebar bg: `#F5F3FF` để phân biệt với content

**Phase 3 — Product (1 tuần):**
10. "Subtitle preview" ở màn Import — show sample output để user biết app làm gì
11. Export success screen với animation
12. Recent projects ở màn hình đầu khi tái mở app
