//! Pure CPU rasterizer — background/vignette + layout + waveform into one RGBA
//! buffer per frame. No Tauri, no ffmpeg process, no I/O (PACKAGE_SPLIT_PLAN.md
//! §3.1). Spawning/managing the ffmpeg subprocess (`encode_blocking`, the
//! resolver) stays in the app crate, which calls [`frame::render_frame_into`]
//! per frame and reports progress through [`progress::ProgressSink`] instead
//! of an `AppHandle` directly.
pub mod frame;
pub mod pixel;
pub mod progress;
pub mod text;
pub mod wave;

pub use progress::{NullSink, ProgressSink};

#[cfg(test)]
mod tests {
    use super::frame::{compute_frame_luts, compute_title_pixels, render_frame_into, CoverImage, TitleSpec};
    use super::text::{new_font_system, new_swash_cache};
    use audiogram_core::contract_gen::default_zones;
    use audiogram_core::entities::{Layout, TitleAlign, WaveStyle};

    /// PACKAGE_SPLIT_PLAN.md §3.1 / PHASE1_TASKS.md T16's acceptance test for
    /// this crate: render exactly one frame with minimal params and check the
    /// buffer is the right size, doesn't panic, and actually drew something
    /// (a centre pixel differs from the plain background) — runnable with
    /// `cargo test -p audiogram-render`, no Tauri/ffmpeg/webview needed.
    #[test]
    fn renders_one_frame() {
        let (w, h) = (320usize, 180usize);
        let bg_color = [0x11, 0x18, 0x27];
        let wave_color = [0xFF, 0xFF, 0xFF];
        let peaks = vec![0.5f32; 1200];

        let luts = compute_frame_luts(w, h, bg_color, Layout::Minimal);
        let zones = default_zones("minimal").unwrap();
        let mut buf = vec![0u8; w * h * 4];

        render_frame_into(
            &mut buf, w, h,
            &peaks, wave_color, WaveStyle::Bar,
            0.0, 10.0,
            Layout::Minimal,
            &[], &[], 0,
            &luts,
            None,
            &zones,
            &[],
        );

        assert_eq!(buf.len(), w * h * 4);

        // Top-left corner is pure background (Minimal's waveform band sits at
        // y ∈ [0.30h, 0.66h], well below row 0).
        let bg_pixel = &buf[0..3];

        // Middle of the frame should land inside the waveform band and
        // actually have something drawn (bar effect fills opaque white/bg
        // gradient over the background there).
        let mid_x = w / 2;
        let mid_y = (h as f32 * 0.30 + (h as f32 * 0.36) / 2.0) as usize; // Minimal's waveform zone centre
        let mid_idx = (mid_y * w + mid_x) * 4;
        let mid_pixel = &buf[mid_idx..mid_idx + 3];

        assert_ne!(bg_pixel, mid_pixel, "expected the waveform to draw something distinct from the background");
    }

    /// Regression test for the cover-image-never-reaches-export bug: with a
    /// `CoverImage` passed in, the Spotify avatar circle should show that
    /// image's colour, not the placeholder gradient. A solid-red 4x4 "photo"
    /// cover-fit into the circle should be pure red at the avatar's centre.
    #[test]
    fn draws_cover_image_into_the_avatar_circle() {
        let (w, h) = (320usize, 180usize);
        let bg_color = [0x11, 0x18, 0x27];
        let wave_color = [0xFF, 0xFF, 0xFF];
        let peaks = vec![0.5f32; 1200];
        let luts = compute_frame_luts(w, h, bg_color, Layout::Spotify);
        let zones = default_zones("spotify").unwrap();

        let cover = CoverImage { pixels: [255u8, 0, 0, 255].repeat(16), width: 4, height: 4 };

        let mut buf = vec![0u8; w * h * 4];
        render_frame_into(
            &mut buf, w, h,
            &peaks, wave_color, WaveStyle::Bar,
            0.0, 10.0,
            Layout::Spotify,
            &[], &[], 0,
            &luts,
            Some(&cover),
            &zones,
            &[],
        );

        let av_cy = (h as f32 * 0.26) as usize;
        let av_cx = w / 2;
        let idx = (av_cy * w + av_cx) * 4;
        assert_eq!(
            &buf[idx..idx + 3], &[255, 0, 0],
            "expected the cover image (solid red) at the avatar centre",
        );
    }

    /// PHASE3_TASKS.md T2 — regression guard for the bug this task fixes:
    /// `zones` used to be accepted by RenderJob but never actually reach
    /// frame.rs (every layout hardcoded its own waveform/avatar fractions),
    /// so dragging a zone in the Design mode canvas stage changed the
    /// preview but not the exported video. This renders the same input
    /// twice, only moving `zones.waveform.y`, and checks the pixels
    /// actually move.
    #[test]
    fn zones_override_moves_the_waveform() {
        let (w, h) = (320usize, 180usize);
        let bg_color = [0x11, 0x18, 0x27];
        let wave_color = [0xFF, 0xFF, 0xFF];
        let peaks = vec![0.5f32; 1200];
        let luts = compute_frame_luts(w, h, bg_color, Layout::Minimal);

        let default_zones = default_zones("minimal").unwrap();
        let mut moved_zones = default_zones;
        moved_zones.waveform.y = 0.05; // default is 0.30 — move near the top instead

        let mut buf_default = vec![0u8; w * h * 4];
        render_frame_into(
            &mut buf_default, w, h,
            &peaks, wave_color, WaveStyle::Bar,
            0.0, 10.0,
            Layout::Minimal,
            &[], &[], 0,
            &luts,
            None,
            &default_zones,
            &[],
        );

        let mut buf_moved = vec![0u8; w * h * 4];
        render_frame_into(
            &mut buf_moved, w, h,
            &peaks, wave_color, WaveStyle::Bar,
            0.0, 10.0,
            Layout::Minimal,
            &[], &[], 0,
            &luts,
            None,
            &moved_zones,
            &[],
        );

        assert_ne!(buf_default, buf_moved, "moving zones.waveform.y should change the rendered frame");

        // Default band is y ∈ [0.30h, 0.66h]; moved band is y ∈ [0.05h, 0.41h].
        // A row at 0.55h sits inside the default band but outside the moved
        // one — it should have waveform content in `buf_default` and be back
        // to plain background in `buf_moved`.
        let sample_y = (h as f32 * 0.55) as usize;
        let mid_x = w / 2;
        let idx = (sample_y * w + mid_x) * 4;
        assert_ne!(
            &buf_default[idx..idx + 3], &buf_moved[idx..idx + 3],
            "a row inside the default waveform band should differ once the zone moved away from it",
        );
    }

    fn title_spec(text: &str) -> TitleSpec {
        TitleSpec {
            text: text.to_string(),
            color: [255, 0, 0],
            align: TitleAlign::Center,
            bold: false,
            italic: false,
            font_size_pct: 100,
        }
    }

    /// PHASE3_TASKS.md T4 — no text, no pixels; every layout should handle
    /// `spec: None` and empty text without panicking.
    #[test]
    fn compute_title_pixels_is_empty_without_text() {
        let mut fs = new_font_system();
        let mut cache = new_swash_cache();
        for layout_name in ["spotify", "split", "minimal", "fullbg", "karaoke", "brand"] {
            let layout: Layout = layout_name.try_into().unwrap();
            let zones = default_zones(layout_name).unwrap();
            assert!(compute_title_pixels(320, 180, layout, &zones, None, &mut fs, &mut cache).is_empty());
            let empty = title_spec("");
            assert!(compute_title_pixels(320, 180, layout, &zones, Some(&empty), &mut fs, &mut cache).is_empty());
        }
    }

    /// Every layout, including Karaoke — the actual bug this task fixes.
    /// Before T4, Karaoke's title was silently never drawn in export at all
    /// (build_filter_complex's old `center_y` match had `Karaoke => None`,
    /// skipping drawtext entirely for that layout), even though the preview
    /// always showed it via drawKaraoke's `else if (dc.title)` branch.
    #[test]
    fn compute_title_pixels_draws_something_for_every_layout() {
        let mut fs = new_font_system();
        let mut cache = new_swash_cache();
        let spec = title_spec("Episode One");
        for layout_name in ["spotify", "split", "minimal", "fullbg", "karaoke", "brand"] {
            let layout: Layout = layout_name.try_into().unwrap();
            let zones = default_zones(layout_name).unwrap();
            let pixels = compute_title_pixels(320, 180, layout, &zones, Some(&spec), &mut fs, &mut cache);
            assert!(!pixels.is_empty(), "expected title pixels for layout {layout_name}");
        }
    }

    /// render_frame_into actually blends the precomputed title pixels into
    /// the frame — the end-to-end path frame.rs's Stage C wires up.
    #[test]
    fn render_frame_into_draws_the_title() {
        let (w, h) = (320usize, 180usize);
        let bg_color = [0x11, 0x18, 0x27];
        let wave_color = [0xFF, 0xFF, 0xFF];
        let peaks = vec![0.5f32; 1200];
        let luts = compute_frame_luts(w, h, bg_color, Layout::Minimal);
        let zones = default_zones("minimal").unwrap();

        let mut fs = new_font_system();
        let mut cache = new_swash_cache();
        let spec = title_spec("Hello Title");
        let title_pixels = compute_title_pixels(w, h, Layout::Minimal, &zones, Some(&spec), &mut fs, &mut cache);
        assert!(!title_pixels.is_empty());

        let mut buf_no_title = vec![0u8; w * h * 4];
        render_frame_into(&mut buf_no_title, w, h, &peaks, wave_color, WaveStyle::Bar, 0.0, 10.0, Layout::Minimal, &[], &[], 0, &luts, None, &zones, &[]);

        let mut buf_with_title = vec![0u8; w * h * 4];
        render_frame_into(&mut buf_with_title, w, h, &peaks, wave_color, WaveStyle::Bar, 0.0, 10.0, Layout::Minimal, &[], &[], 0, &luts, None, &zones, &title_pixels);

        assert_ne!(buf_no_title, buf_with_title, "a frame rendered with title pixels should differ from one without");
    }
}
