/// Frame renderer — orchestrates background, layout, and waveform into one RGBA buffer.
/// Layout geometry here must stay in sync with WaveformCanvas.tsx (the preview is the contract).
use crate::{
    pixel::{
        blend, draw_circle_ring, draw_gradient_circle, draw_image_cover_circle,
        draw_image_cover_full, draw_image_cover_rect_topleft, fill_rect,
    },
    wave::render_wave,
};
use audiogram_core::contract_gen::{LayoutZone, LayoutZones};
use audiogram_core::entities::{Layout, WaveStyle};

/// Decoded RGBA avatar/background image (StepLayout's cover image), decoded
/// once per render in the app crate's Stage 1 (mirrors the FFT spectrum
/// precompute) and passed by shared reference into every frame — this crate
/// has no file I/O of its own (PACKAGE_SPLIT_PLAN.md §3.1).
pub struct CoverImage {
    pub pixels: Vec<u8>,
    pub width: u32,
    pub height: u32,
}

// ── Shared constants (must match WaveformCanvas.tsx) ─────────────────────────
// Sourced from contract/constants.json via audiogram-core's contract_gen.rs
// (T14/T16) — re-exported here so every existing `use super::frame::{WAVE_BARS, ...}`
// call site throughout wave/effects/*.rs keeps working unchanged.
pub use audiogram_core::contract_gen::{BAR_FILL, GAP_FILL, WAVE_BARS};
use audiogram_core::contract_gen::{BG_DARK_BOTTOM, BG_DARK_TOP};

pub const PINK: [u8; 3] = [0xEC, 0x4F, 0xC4];

/// Avatar center + radius from a zone fraction — mirrors
/// domain/preview/renderer.ts's `drawAvatar` call sites exactly:
/// `avCx = W·(az.x + az.w/2)`, `avCy = H·(az.y + az.h/2)`,
/// `avR = min(W·az.w, H·az.h) / 2`. Every layout below must use this
/// instead of a locally hardcoded fraction (PHASE3_TASKS.md T2) — that's
/// what the preview already does, so this is the parity contract.
fn avatar_geom(z: LayoutZone, w: usize, h: usize) -> (i32, i32, i32) {
    let cx = (w as f32 * (z.x + z.w / 2.0)) as i32;
    let cy = (h as f32 * (z.y + z.h / 2.0)) as i32;
    let r  = ((w as f32 * z.w).min(h as f32 * z.h) / 2.0) as i32;
    (cx, cy, r)
}

// ── Pre-computed per-encode lookup tables ─────────────────────────────────────

/// Computed once per encode call; passed by shared reference to every frame render.
pub struct FrameLuts {
    /// `vignette_rows[y]` = background RGB after vignette dimming — no f32 math per pixel.
    pub vignette_rows: Vec<[u8; 3]>,
    /// Pre-computed radial gradient alpha for the `FullBg` layout (empty otherwise).
    pub fullbg_alpha:  Vec<f32>,
    /// Pre-computed radial gradient alpha for the `Karaoke` layout (empty otherwise).
    pub karaoke_alpha: Vec<f32>,
}

/// Pre-compute all per-frame constants that depend only on canvas size, background colour,
/// and layout. Call once before the frame loop; for a 30-min render this eliminates
/// ~49 billion `sqrt` calls and float multiplies per pixel.
pub fn compute_frame_luts(w: usize, h: usize, bg: [u8; 3], layout: Layout) -> FrameLuts {
    let vignette_rows: Vec<[u8; 3]> = (0..h)
        .map(|y| {
            let keep = 1.0
                - (BG_DARK_TOP + (BG_DARK_BOTTOM - BG_DARK_TOP) * y as f32 / h as f32)
                    .clamp(0.0, 1.0);
            [
                (bg[0] as f32 * keep) as u8,
                (bg[1] as f32 * keep) as u8,
                (bg[2] as f32 * keep) as u8,
            ]
        })
        .collect();

    let fullbg_alpha = if layout == Layout::FullBg {
        let mut v = Vec::with_capacity(w * h);
        for y in 0..h {
            for x in 0..w {
                let dx = x as f32 / w as f32 - 0.25;
                let dy = y as f32 / h as f32 - 0.30;
                v.push((1.0 - (dx * dx + dy * dy).sqrt() / 0.55).clamp(0.0, 1.0) * 0.32);
            }
        }
        v
    } else {
        vec![]
    };

    let karaoke_alpha = if layout == Layout::Karaoke {
        let mut v = Vec::with_capacity(w * h);
        for y in 0..h {
            for x in 0..w {
                let dx = x as f32 / w as f32 - 0.50;
                let dy = y as f32 / h as f32 - 0.52;
                v.push((1.0 - (dx * dx + dy * dy).sqrt() / 0.42).clamp(0.0, 1.0) * 0.12);
            }
        }
        v
    } else {
        vec![]
    };

    FrameLuts { vignette_rows, fullbg_alpha, karaoke_alpha }
}

// ── Frame entry point ─────────────────────────────────────────────────────────

/// Render one complete RGBA frame into `buf` (must be exactly `w × h × 4` bytes).
///
/// Writing into a caller-supplied buffer avoids allocating and dropping ~1–33 MB
/// per frame. The caller pre-allocates one buffer per rayon thread and reuses it
/// across batches.
///
/// Thread-safe: `eq_snapshot` is a read-only slice, `luts` is shared read-only.
#[allow(clippy::too_many_arguments)]
pub fn render_frame_into(
    buf: &mut [u8],
    w: usize,
    h: usize,
    peaks: &[f32],
    wc: [u8; 3],
    style: WaveStyle,
    t_sec: f64,
    dur: f64,
    layout: Layout,
    eq_snapshot: &[f32],
    fft_peaks: &[f32],
    fft_n_buckets: usize,
    luts: &FrameLuts,
    cover: Option<&CoverImage>,
    zones: &LayoutZones,
) {
    debug_assert_eq!(buf.len(), w * h * 4);

    // ── Stage A: background + vignette (one pass, no float math) ────────────
    for y in 0..h {
        let [r, g, b] = luts.vignette_rows[y];
        let row = &mut buf[y * w * 4..(y + 1) * w * 4];
        for c in row.chunks_exact_mut(4) {
            c[0] = r; c[1] = g; c[2] = b; c[3] = 255;
        }
    }

    if peaks.is_empty() {
        return;
    }

    let wave = |px: &mut [u8], wx: f32, wy: f32, ww: f32, wh: f32| {
        render_wave(px, w, h, peaks, wc, style, t_sec, dur,
            wx as usize, wy, ww as usize, wh, eq_snapshot, fft_peaks, fft_n_buckets);
    };

    match layout {
        Layout::Spotify => {
            if let Some(az) = zones.avatar {
                let (av_cx, av_cy, av_r) = avatar_geom(az, w, h);
                match cover {
                    Some(img) => draw_image_cover_circle(buf, w, h, av_cx, av_cy, av_r, &img.pixels, img.width, img.height),
                    None => draw_gradient_circle(buf, w, h, av_cx, av_cy, av_r, PINK, wc),
                }
                draw_circle_ring(buf, w, h, av_cx, av_cy, av_r, 2, [255, 255, 255], 0.22);
            }
            let wz = zones.waveform;
            wave(buf, w as f32 * wz.x, h as f32 * wz.y, w as f32 * wz.w, h as f32 * wz.h);
        }
        Layout::Split => {
            // Split's "avatar" zone is the full left image rect (x/y/h are
            // always 0/0/1 by convention — only .w varies), matching
            // renderer.ts's drawSplit: `leftW = W * az.w`.
            let left_w_frac = zones.avatar.map(|a| a.w).unwrap_or(0.5);
            let left_w = (w as f32 * left_w_frac) as usize;
            match cover {
                Some(img) => draw_image_cover_rect_topleft(buf, w, h, 0, 0, left_w, h, &img.pixels, img.width, img.height),
                None => fill_rect(buf, w, h, 0, 0, left_w, h, [0x3D, 0x1A, 0x6E], 0.80),
            }
            // Blend band kept at the same offsets from the split boundary
            // (-0.08w, +0.06w) the original hardcoded 0.42/0.56 implied
            // around a fixed 0.5 center, now following the real boundary.
            // TODO(v1.1): composition spec — this offset shape is decorative.
            let bs = (left_w as f32 - w as f32 * 0.08).max(0.0) as usize;
            let be = ((left_w as f32 + w as f32 * 0.06) as usize).min(w);
            for x in bs..be.min(w) {
                let t = (x - bs) as f32 / (be - bs) as f32;
                for y in 0..h { blend(buf, (y * w + x) * 4, [0x1A, 0x0A, 0x3E], 1.0 - t); }
            }
            let wz = zones.waveform;
            wave(buf, w as f32 * wz.x, h as f32 * wz.y, w as f32 * wz.w, h as f32 * wz.h);
        }
        Layout::FullBg => {
            match cover {
                Some(img) => draw_image_cover_full(buf, w, h, &img.pixels, img.width, img.height),
                None => {
                    if !luts.fullbg_alpha.is_empty() {
                        for y in 0..h {
                            let row = y * w;
                            for x in 0..w {
                                blend(buf, (row + x) * 4, PINK, luts.fullbg_alpha[row + x]);
                            }
                        }
                    }
                }
            }
            // TODO(v1.1): composition spec — decorative dimming, not zone geometry.
            for c in buf.chunks_exact_mut(4) {
                c[0] = (c[0] as f32 * 0.52) as u8;
                c[1] = (c[1] as f32 * 0.52) as u8;
                c[2] = (c[2] as f32 * 0.52) as u8;
            }
            if let Some(az) = zones.avatar {
                let (av_cx, av_cy, av_r) = avatar_geom(az, w, h);
                match cover {
                    Some(img) => draw_image_cover_circle(buf, w, h, av_cx, av_cy, av_r, &img.pixels, img.width, img.height),
                    None => draw_gradient_circle(buf, w, h, av_cx, av_cy, av_r, PINK, wc),
                }
                draw_circle_ring(buf, w, h, av_cx, av_cy, av_r, 2, [255, 255, 255], 0.28);
            }
            // TODO(v1.1): composition spec — bottom darken-out band, decorative.
            let bs = (h as f32 * 0.58) as usize;
            for y in bs..h {
                let t = (y - bs) as f32 / (h - bs) as f32;
                let row = y * w;
                for x in 0..w { blend(buf, (row + x) * 4, [0, 0, 0], t * 0.70); }
            }
            let wz = zones.waveform;
            wave(buf, w as f32 * wz.x, h as f32 * wz.y, w as f32 * wz.w, h as f32 * wz.h);
        }
        Layout::Karaoke => {
            if !luts.karaoke_alpha.is_empty() {
                for y in 0..h {
                    let row = y * w;
                    for x in 0..w {
                        blend(buf, (row + x) * 4, wc, luts.karaoke_alpha[row + x]);
                    }
                }
            }
            let wz = zones.waveform;
            wave(buf, w as f32 * wz.x, h as f32 * wz.y, w as f32 * wz.w, h as f32 * wz.h);
        }
        Layout::Brand => {
            // TODO(v1.1): composition spec — accent bar width, decorative.
            let bw = (w as f32 * 0.012).max(4.0) as usize;
            for y in 0..h {
                let t = y as f32 / h as f32;
                let col = [
                    (wc[0] as f32 * (1.0 - t) + PINK[0] as f32 * t) as u8,
                    (wc[1] as f32 * (1.0 - t) + PINK[1] as f32 * t) as u8,
                    (wc[2] as f32 * (1.0 - t) + PINK[2] as f32 * t) as u8,
                ];
                for x in 0..bw { blend(buf, (y * w + x) * 4, col, 1.0); }
            }
            if let Some(az) = zones.avatar {
                let (av_cx, av_cy, av_r) = avatar_geom(az, w, h);
                match cover {
                    Some(img) => draw_image_cover_circle(buf, w, h, av_cx, av_cy, av_r, &img.pixels, img.width, img.height),
                    None => draw_gradient_circle(buf, w, h, av_cx, av_cy, av_r, wc, PINK),
                }
                draw_circle_ring(buf, w, h, av_cx, av_cy, av_r, 2, [255, 255, 255], 0.22);
            }
            // TODO(v1.1): composition spec — divider line position, decorative.
            let divx = (w as f32 * 0.52) as usize;
            for y in (h as f32 * 0.10) as usize..(h as f32 * 0.90) as usize {
                blend(buf, (y * w + divx) * 4, [255, 255, 255], 0.08);
            }
            let wz = zones.waveform;
            wave(buf, w as f32 * wz.x, h as f32 * wz.y, w as f32 * wz.w, h as f32 * wz.h);
        }
        Layout::Minimal => {
            let wz = zones.waveform;
            wave(buf, w as f32 * wz.x, h as f32 * wz.y, w as f32 * wz.w, h as f32 * wz.h);
        }
    }
}
