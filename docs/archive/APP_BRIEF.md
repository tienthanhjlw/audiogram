# Audiogram Studio — Brief for Designer

## Sản phẩm làm gì?

Người dùng có một file audio — có thể là podcast, bài giảng, bản ghi âm, bài hát. Họ muốn biến nó thành video đẹp để đăng lên mạng xã hội. App nhận audio đầu vào, tự động nhận dạng lời nói thành phụ đề, cho phép chỉnh sửa transcript, rồi render video với waveform động và subtitle chạy theo âm thanh.

Output là file `.mp4` — đăng thẳng lên Instagram, TikTok, YouTube Shorts, Facebook — hoặc export phụ đề ra `.srt`, `.vtt` để dùng riêng.

---

## Điều khác biệt

App chạy hoàn toàn trên máy người dùng. Không upload gì lên server, không cần internet khi dùng, không trả phí hàng tháng. Mọi thứ — AI nhận dạng giọng nói, render video — đều xảy ra locally.

Các tool tương tự như Headliner hay Wavve tính $16–$24/tháng và dữ liệu đi qua cloud của họ. Đây là thay thế mua một lần, privacy-first.

---

## Người dùng

Podcaster, content creator, nhà thờ, tổ chức phi lợi nhuận, cá nhân muốn chia sẻ bản ghi âm. Người không có kỹ năng thiết kế nhưng muốn output trông chuyên nghiệp.

---

## Khả năng và tính năng của app

**Quản lý dự án:** Người dùng có thể có nhiều project. Màn hình chính có thể là một dashboard — thấy các project gần đây, thống kê (số project, tổng thời lượng, số lần export), và tạo project mới.

**Về audio:** nhận MP3, WAV, M4A, FLAC, AAC. Tối đa vài GB.

**Về nhận dạng giọng nói:** dùng Whisper AI chạy local. Người dùng chọn model (nhỏ = nhanh, lớn = chính xác hơn). Kết quả hiển thị thành danh sách segment có timestamp. Người dùng có thể:
- Chỉnh sửa text từng segment
- Điều chỉnh thời gian bắt đầu/kết thúc
- Gán speaker (Host, Guest…)
- Split hoặc merge các segment
- Nghe lại từng đoạn

**Về visual:** người dùng có thể build khung hình video bằng cách đặt các thành phần:
- Avatar/ảnh
- Title, subtitle text
- Waveform visualizer (nhiều style: thanh đứng, đường cong, mirror, LED, neon, radial, pulse, spectrum, media player)
- Play controls (progress bar)
- Background (màu, gradient)
- Subtitles tự động theo transcript
- Watermark

Có thể chọn layout template định sẵn để bắt đầu nhanh, hoặc tùy chỉnh từ đầu.

**Về tỉ lệ khung hình:** 16:9 (YouTube), 1:1 (Instagram), 9:16 (TikTok/Reels), 4:5 (IG Feed).

**Về export:**
- Format: MP4 H.264, MP4 H.265 (HEVC), WebM, MOV, GIF, hoặc Audio Only
- Chất lượng: Draft / Standard / High (4K)
- Platform presets: tự động đặt đúng ratio + bitrate cho YouTube, TikTok, Instagram, Twitter, Spotify
- Subtitle: burn into video hoặc export file `.srt` / `.vtt` riêng
- Ước tính kích thước file trước khi export

**Về preview:** người dùng có thể xem preview video với waveform và subtitle chạy thật trước khi export.

---

## Tinh thần của sản phẩm

Mạnh mẽ nhưng không phức tạp. Người dùng không nên cảm thấy đang dùng phần mềm — họ chỉ đang tạo ra thứ họ muốn. Output phải trông đẹp mà không cần người dùng hiểu design.

Đây là desktop app (macOS trước, Windows sau), cửa sổ tối thiểu 960×640px, mặc định 1280×800px.

---

## References

Hai file tham khảo về hướng thiết kế:

- **Figma design** (đã chụp màn hình): dark theme, accent tím `#7C4DFF`, accent xanh `#00E676`, font Inter
- **HTML prototype `code.html`**: dark theme khác, accent vàng amber `#e8b931`, font Syne + DM Sans + DM Mono — thể hiện một version giàu tính năng hơn với dashboard, canvas editor đầy đủ (layer panel + properties + timeline), và preview screen riêng biệt

Designer có thể tham khảo cả hai nhưng không bị ràng buộc bởi màu sắc hay font của bất kỳ cái nào.
