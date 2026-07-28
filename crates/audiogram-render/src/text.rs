//! Text rasterizer — OPTIMIZATION_PLAN.md F1 / PHASE3_TASKS.md T3. Renders
//! text directly into the RGBA frame buffer via `cosmic-text` + bundled
//! Inter, instead of the app crate shelling out to ffmpeg's `drawtext`
//! filter (which depends on fontconfig finding a system font by name at
//! export time — a real source of preview↔export drift when the requested
//! font isn't installed on the machine doing the export).
//!
//! **Not wired into the render pipeline yet** (PHASE3_TASKS.md T3 step 0) —
//! `frame.rs`/`render/mod.rs` still use the old ffmpeg `drawtext` path.
//! T4 does that wiring. One design note for whoever does T4: every frame in
//! a render shares the exact same title (it's a per-job constant, not a
//! function of `t_sec`), so the efficient way to wire this in is to
//! rasterize it ONCE before the parallel per-frame render loop (the same
//! pattern `compute_frame_luts` already uses for the vignette/background),
//! not call `draw_text` again inside the hot per-frame rayon closure —
//! `FontSystem`/`SwashCache` hold internal caches behind plain fields, not
//! `Sync`, so sharing one across rayon threads would need a `Mutex` that
//! serializes every frame's text draw for no benefit when the pixels never
//! change frame to frame.
//!
//! Font bundling: `@fontsource-variable/inter`'s npm package only ships
//! variable-font `.woff2` (fontdb/cosmic-text's font parser wants raw
//! SFNT — TTF/OTF — it doesn't decompress WOFF2 containers). The 4 TTFs
//! under `assets/fonts/` are static Regular/Bold/Italic/BoldItalic
//! instances sliced out of that variable font with `fonttools`'
//! `varLib.instancer` (a build-time, one-off conversion — not a runtime
//! dependency), with the `name`/`OS/2` tables corrected so fontdb reports
//! the right family/weight/style for each. Same SIL OFL-1.1 license as the
//! npm package (`assets/fonts/Inter-OFL.txt`).
use std::sync::Arc;

use cosmic_text::{
    Attrs, Buffer, Color as CosmicColor, Family, Metrics, Shaping, Style as FontStyle, Weight,
};
// Re-exported so callers outside this crate (e.g. the app crate's per-thread
// scene-render cache, P5-T5) can name these types without a direct
// `cosmic-text` dependency.
pub use cosmic_text::{FontSystem, SwashCache};

use crate::pixel::blend;

const INTER_REGULAR: &[u8] = include_bytes!("../assets/fonts/Inter-Regular.ttf");
const INTER_BOLD: &[u8] = include_bytes!("../assets/fonts/Inter-Bold.ttf");
const INTER_ITALIC: &[u8] = include_bytes!("../assets/fonts/Inter-Italic.ttf");
const INTER_BOLD_ITALIC: &[u8] = include_bytes!("../assets/fonts/Inter-BoldItalic.ttf");

const LIBERATION_SANS_REGULAR: &[u8] = include_bytes!("../assets/fonts/LiberationSans-Regular.ttf");
const LIBERATION_SANS_BOLD: &[u8] = include_bytes!("../assets/fonts/LiberationSans-Bold.ttf");
const LIBERATION_SANS_ITALIC: &[u8] = include_bytes!("../assets/fonts/LiberationSans-Italic.ttf");
const LIBERATION_SERIF_REGULAR: &[u8] = include_bytes!("../assets/fonts/LiberationSerif-Regular.ttf");
const LIBERATION_SERIF_BOLD: &[u8] = include_bytes!("../assets/fonts/LiberationSerif-Bold.ttf");
const LIBERATION_SERIF_ITALIC: &[u8] = include_bytes!("../assets/fonts/LiberationSerif-Italic.ttf");

/// A `FontSystem` seeded with bundled font families:
/// - Inter: 4 faces (Regular, Bold, Italic, BoldItalic) — default fallback
/// - Liberation Sans: 3 faces (Regular, Bold, Italic) — maps to Arial/Verdana
/// - Liberation Serif: 3 faces (Regular, Bold, Italic) — maps to Georgia
///
/// No system font directory scan — deterministic across machines. See Phase 4 T1
/// decision: bundling Liberation fonts (OFL) for Arial/Georgia/Verdana support.
pub fn new_font_system() -> FontSystem {
    // Collect all font bytes as binary sources. cosmic-text's FontSystem::new_with_fonts
    // auto-discovers family/weight/style from the font metadata in each TTF.
    let sources = [
        INTER_REGULAR, INTER_BOLD, INTER_ITALIC, INTER_BOLD_ITALIC,
        LIBERATION_SANS_REGULAR, LIBERATION_SANS_BOLD, LIBERATION_SANS_ITALIC,
        LIBERATION_SERIF_REGULAR, LIBERATION_SERIF_BOLD, LIBERATION_SERIF_ITALIC,
    ]
        .into_iter()
        .map(|bytes| cosmic_text::fontdb::Source::Binary(Arc::new(bytes.to_vec())));
    FontSystem::new_with_fonts(sources)
}

/// Map user-facing font names to bundled family names.
/// Fallback is "Inter" for any unknown name.
pub fn resolve_font_family(font_name: &str) -> &'static str {
    match font_name {
        "Arial" | "arial" => "Liberation Sans",
        "Georgia" | "georgia" => "Liberation Serif",
        "Verdana" | "verdana" => "Liberation Sans",
        "Impact" | "impact" => "Liberation Sans", // Liberation Sans is the closest substitute
        _ => "Inter",
    }
}

pub fn new_swash_cache() -> SwashCache {
    SwashCache::new()
}

/// Shapes `text` at `width_px` (no rendering) and returns how many lines it
/// wraps to. Used to vertically center a text block *before* choosing its
/// final rect — cosmic-text lays text out top-down inside its box, so
/// centering a block of known height around a target y requires knowing the
/// line count first (frame.rs's title placement, PHASE3_TASKS.md T4).
pub fn measure_lines(text: &str, style: &TextStyle, width_px: f32, font_system: &mut FontSystem) -> usize {
    if text.is_empty() {
        return 0;
    }
    let metrics = Metrics::new(style.size_px, style.size_px * style.line_height_ratio);
    let mut buffer = Buffer::new(font_system, metrics);
    buffer.set_size(Some(width_px), None); // unbounded height — count every wrapped line
    let weight = if style.bold { Weight::BOLD } else { Weight::NORMAL };
    let font_style = if style.italic { FontStyle::Italic } else { FontStyle::Normal };
    let family = resolve_font_family(&style.font_name);
    let attrs = Attrs::new().family(Family::Name(family)).weight(weight).style(font_style);
    buffer.set_text(text, &attrs, Shaping::Advanced, None);
    buffer.shape_until_scroll(font_system, false);
    buffer.layout_runs().count()
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TextAlign {
    Left,
    Center,
    Right,
}

#[derive(Clone, Debug)]
pub struct TextStyle {
    pub size_px: f32,
    pub color: [u8; 3],
    /// Extra opacity multiplier on top of glyph coverage (e.g. for a fade
    /// transition) — 1.0 for plain opaque text.
    pub alpha: f32,
    pub bold: bool,
    pub italic: bool,
    pub align: TextAlign,
    /// `line_height / size_px` ratio — callers pass the same 1.4 the
    /// preview's `drawTitle`/`drawSubtitle` use so wrapping breaks at the
    /// same point on both sides.
    pub line_height_ratio: f32,
    /// Font family name (e.g., "Arial", "Georgia", "Inter"). Mapped to actual
    /// bundled family via resolve_font_family().
    pub font_name: String,
}

/// One touched pixel from a rasterize pass — `rasterize_sparse`'s output
/// shape, keyed for a cheap per-frame blend pass (see that function's doc).
pub struct TitlePixel {
    pub x: u32,
    pub y: u32,
    pub rgb: [u8; 3],
    pub alpha: f32,
}

/// Shared cosmic-text plumbing: builds and shapes a `Buffer` for `text`
/// inside `rect`, then calls `emit(absolute_x, absolute_y, rgb, alpha)` for
/// every covered pixel — `rect`'s own (x, y) offset is already folded in, so
/// callers never see cosmic-text's rect-local coordinates. Returns the
/// number of laid-out lines (0 for empty text).
fn rasterize<F: FnMut(i32, i32, [u8; 3], f32)>(
    rect: (f32, f32, f32, f32),
    text: &str,
    style: &TextStyle,
    font_system: &mut FontSystem,
    swash_cache: &mut SwashCache,
    mut emit: F,
) -> usize {
    if text.is_empty() || style.alpha <= 0.0 {
        return 0;
    }
    let (rx, ry, rw, rh) = rect;

    let metrics = Metrics::new(style.size_px, style.size_px * style.line_height_ratio);
    let mut buffer = Buffer::new(font_system, metrics);
    buffer.set_size(Some(rw), Some(rh));

    let weight = if style.bold { Weight::BOLD } else { Weight::NORMAL };
    let font_style = if style.italic { FontStyle::Italic } else { FontStyle::Normal };
    let align = match style.align {
        TextAlign::Left => cosmic_text::Align::Left,
        TextAlign::Center => cosmic_text::Align::Center,
        TextAlign::Right => cosmic_text::Align::Right,
    };
    let family = resolve_font_family(&style.font_name);
    let attrs = Attrs::new().family(Family::Name(family)).weight(weight).style(font_style);
    buffer.set_text(text, &attrs, Shaping::Advanced, Some(align));

    let color = CosmicColor::rgb(style.color[0], style.color[1], style.color[2]);
    let alpha = style.alpha.clamp(0.0, 1.0);

    buffer.draw(font_system, swash_cache, color, |gx, gy, gw, gh, c| {
        let a = (c.a() as f32 / 255.0) * alpha;
        if a <= 0.0 {
            return;
        }
        let rgb = [c.r(), c.g(), c.b()];
        for oy in 0..gh as i32 {
            for ox in 0..gw as i32 {
                emit(rx as i32 + gx + ox, ry as i32 + gy + oy, rgb, a);
            }
        }
    });

    buffer.layout_runs().count()
}

/// Rasterizes `text`, word-wrapped to `rect`'s width, directly into `buf` (a
/// `w × h × 4` RGBA frame). Lines beyond `rect`'s height are simply not
/// laid out (cosmic-text only shapes as many lines as fit the bounded
/// height) — callers wanting an exact "2 lines max" cap should size
/// `rect.3` to `2 * size_px * line_height_ratio`. Returns how many lines
/// were actually laid out (0 for empty text).
///
/// Prefer `rasterize_sparse` for anything called once and blended into many
/// frames (e.g. a render job's title, constant across the whole video) —
/// this one is for one-shot uses (tests, thumbnails) where redoing the
/// layout per call doesn't matter.
#[allow(clippy::too_many_arguments)]
pub fn draw_text(
    buf: &mut [u8],
    w: usize,
    h: usize,
    rect: (f32, f32, f32, f32),
    text: &str,
    style: &TextStyle,
    font_system: &mut FontSystem,
    swash_cache: &mut SwashCache,
) -> usize {
    rasterize(rect, text, style, font_system, swash_cache, |x, y, rgb, a| {
        if x < 0 || y < 0 {
            return;
        }
        let (x, y) = (x as usize, y as usize);
        if x >= w || y >= h {
            return;
        }
        blend(buf, (y * w + x) * 4, rgb, a);
    })
}

/// Same layout/shaping as `draw_text`, but collects touched pixels into a
/// `Vec` instead of blending into a frame buffer immediately — for a title
/// that's identical across every frame of a render (frame.rs's
/// `compute_frame_luts` precompute pattern), rasterize once here and have
/// the per-frame (possibly parallel/rayon) loop just blend this small list,
/// instead of running cosmic-text — not `Sync` — on every frame/thread.
pub fn rasterize_sparse(
    w: usize,
    h: usize,
    rect: (f32, f32, f32, f32),
    text: &str,
    style: &TextStyle,
    font_system: &mut FontSystem,
    swash_cache: &mut SwashCache,
) -> Vec<TitlePixel> {
    let mut pixels = Vec::new();
    rasterize(rect, text, style, font_system, swash_cache, |x, y, rgb, a| {
        if x < 0 || y < 0 {
            return;
        }
        let (x, y) = (x as usize, y as usize);
        if x >= w || y >= h {
            return;
        }
        pixels.push(TitlePixel { x: x as u32, y: y as u32, rgb, alpha: a });
    });
    pixels
}

#[cfg(test)]
mod tests {
    use super::*;

    fn blank_buf(w: usize, h: usize) -> Vec<u8> {
        let mut v = vec![0u8; w * h * 4];
        for px in v.chunks_exact_mut(4) {
            px[3] = 255;
        }
        v
    }

    fn default_style() -> TextStyle {
        TextStyle {
            size_px: 24.0,
            color: [255, 255, 255],
            alpha: 1.0,
            bold: false,
            italic: false,
            align: TextAlign::Left,
            line_height_ratio: 1.4,
            font_name: "Inter".to_string(),
        }
    }

    #[test]
    fn draws_something() {
        let (w, h) = (200usize, 80usize);
        let mut buf = blank_buf(w, h);
        let mut fs = new_font_system();
        let mut cache = new_swash_cache();

        let lines = draw_text(&mut buf, w, h, (4.0, 4.0, 192.0, 72.0), "Hi", &default_style(), &mut fs, &mut cache);

        assert!(lines >= 1);
        assert!(buf.chunks_exact(4).any(|px| px[0] > 0 || px[1] > 0 || px[2] > 0), "expected some non-black pixel");
    }

    #[test]
    fn respects_color() {
        let (w, h) = (200usize, 80usize);
        let mut fs = new_font_system();
        let mut cache = new_swash_cache();

        let mut style = default_style();
        style.color = [200, 40, 40]; // a reddish tone, distinct from white/black
        style.size_px = 48.0;

        let mut buf = blank_buf(w, h);
        draw_text(&mut buf, w, h, (4.0, 4.0, 192.0, 72.0), "M", &style, &mut fs, &mut cache);

        let most_saturated = buf
            .chunks_exact(4)
            .max_by_key(|px| px[0] as u32 + px[1] as u32 + px[2] as u32)
            .unwrap();
        // The strongest-coverage pixel should be much closer to the requested
        // red-ish color than to plain white or plain black.
        assert!(most_saturated[0] > most_saturated[2], "red channel should dominate blue for this color");
    }

    #[test]
    fn align_shifts_pixels() {
        let (w, h) = (300usize, 60usize);
        let mut fs = new_font_system();
        let mut cache = new_swash_cache();
        let text = "Hi";

        let mut left_buf = blank_buf(w, h);
        let mut left_style = default_style();
        left_style.align = TextAlign::Left;
        draw_text(&mut left_buf, w, h, (0.0, 0.0, 300.0, 60.0), text, &left_style, &mut fs, &mut cache);

        let mut right_buf = blank_buf(w, h);
        let mut right_style = default_style();
        right_style.align = TextAlign::Right;
        draw_text(&mut right_buf, w, h, (0.0, 0.0, 300.0, 60.0), text, &right_style, &mut fs, &mut cache);

        fn ink_centroid_x(buf: &[u8], w: usize, h: usize) -> f64 {
            let (mut sum_x, mut sum_w) = (0.0f64, 0.0f64);
            for y in 0..h {
                for x in 0..w {
                    let idx = (y * w + x) * 4;
                    let weight = buf[idx] as f64;
                    sum_x += x as f64 * weight;
                    sum_w += weight;
                }
            }
            if sum_w == 0.0 { 0.0 } else { sum_x / sum_w }
        }

        let left_x = ink_centroid_x(&left_buf, w, h);
        let right_x = ink_centroid_x(&right_buf, w, h);
        assert!(right_x > left_x, "right-aligned text should sit further right than left-aligned (left={left_x}, right={right_x})");
    }

    #[test]
    fn bold_is_wider() {
        let (w, h) = (300usize, 80usize);
        let mut fs = new_font_system();
        let mut cache = new_swash_cache();
        let text = "Willowy"; // a word with enough width to show a clear difference

        fn ink_bbox_width(buf: &[u8], w: usize, h: usize) -> usize {
            let (mut min_x, mut max_x) = (w, 0usize);
            for y in 0..h {
                for x in 0..w {
                    let idx = (y * w + x) * 4;
                    if buf[idx] > 10 {
                        min_x = min_x.min(x);
                        max_x = max_x.max(x);
                    }
                }
            }
            max_x.saturating_sub(min_x)
        }

        let mut regular_buf = blank_buf(w, h);
        let regular_style = default_style();
        draw_text(&mut regular_buf, w, h, (4.0, 4.0, 292.0, 72.0), text, &regular_style, &mut fs, &mut cache);

        let mut bold_buf = blank_buf(w, h);
        let mut bold_style = default_style();
        bold_style.bold = true;
        draw_text(&mut bold_buf, w, h, (4.0, 4.0, 292.0, 72.0), text, &bold_style, &mut fs, &mut cache);

        let regular_w = ink_bbox_width(&regular_buf, w, h);
        let bold_w = ink_bbox_width(&bold_buf, w, h);
        assert!(bold_w >= regular_w, "bold text should not be narrower than regular (regular={regular_w}, bold={bold_w})");
    }

    /// PHASE3_TASKS.md T3 step 4 — rough per-line rasterization budget check.
    /// 30fps × up to 2 title lines ≈ a 5%-of-frame-time ceiling of ~2ms/line
    /// once wired into the per-frame path; this crate never calls draw_text
    /// per-frame though (see the module doc's note for T4 — title is
    /// constant across a whole render, so it should be rasterized once, not
    /// 30×dur times), so this is a sanity check, not a hard gate.
    #[test]
    fn benchmark_one_line_rasterization() {
        let (w, h) = (1280usize, 200usize);
        let mut buf = blank_buf(w, h);
        let mut fs = new_font_system();
        let mut cache = new_swash_cache();
        let text = "The quick brown fox jumps over"; // 30 chars
        let mut style = default_style();
        style.size_px = 48.0;

        // Warm up font/glyph caches once, matching how a real render would
        // (rasterize the title once before the frame loop) — the interesting
        // number is steady-state cost, not first-glyph cache misses.
        draw_text(&mut buf, w, h, (8.0, 8.0, 1264.0, 184.0), text, &style, &mut fs, &mut cache);

        let start = std::time::Instant::now();
        const ITERS: u32 = 20;
        for _ in 0..ITERS {
            draw_text(&mut buf, w, h, (8.0, 8.0, 1264.0, 184.0), text, &style, &mut fs, &mut cache);
        }
        let per_line_ms = start.elapsed().as_secs_f64() * 1000.0 / ITERS as f64;
        eprintln!("draw_text: {per_line_ms:.3}ms/line for a 30-char line (budget: 2ms/line)");
    }

    /// PHASE3_TASKS.md T4 relies on `rasterize_sparse` producing exactly the
    /// pixels `draw_text` would've blended directly — this is what lets
    /// frame.rs precompute the title once and blend the (small) result into
    /// every frame instead of calling cosmic-text per-frame.
    #[test]
    fn rasterize_sparse_matches_draw_text() {
        let (w, h) = (200usize, 80usize);
        let rect = (4.0, 4.0, 192.0, 72.0);
        let text = "Parity";
        let style = default_style();

        let mut fs = new_font_system();
        let mut cache = new_swash_cache();
        let mut direct_buf = blank_buf(w, h);
        draw_text(&mut direct_buf, w, h, rect, text, &style, &mut fs, &mut cache);

        let mut fs2 = new_font_system();
        let mut cache2 = new_swash_cache();
        let pixels = rasterize_sparse(w, h, rect, text, &style, &mut fs2, &mut cache2);
        assert!(!pixels.is_empty(), "expected some pixels for non-empty text");

        let mut sparse_buf = blank_buf(w, h);
        for p in &pixels {
            let idx = (p.y as usize * w + p.x as usize) * 4;
            blend(&mut sparse_buf, idx, p.rgb, p.alpha);
        }

        assert_eq!(direct_buf, sparse_buf, "rasterize_sparse should produce the same pixels as draw_text");
    }
}
