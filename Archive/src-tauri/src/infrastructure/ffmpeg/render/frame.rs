/// Frame renderer — orchestrates background, layout, and waveform into one RGBA buffer.
/// Layout geometry here must stay in sync with WaveformCanvas.tsx (the preview is the contract).
use super::{
    pixel::{blend, draw_circle_ring, draw_gradient_circle, fill_rect},
    wave::render_wave,
};

// ── Shared constants (must match WaveformCanvas.tsx) ─────────────────────────

pub const WAVE_BARS:    usize = 64;
pub const BAR_FILL:     f32   = 0.64;
pub const GAP_FILL:     f32   = 0.36;
const BG_DARK_TOP:      f32   = 0.22;
const BG_DARK_BOTTOM:   f32   = 0.50;
pub const PINK: [u8; 3]       = [0xEC, 0x4F, 0xC4];

// ── Pre-computed per-encode lookup tables ─────────────────────────────────────

/// Computed once per encode call in `compute_frame_luts`.
/// Passed by reference to every `render_frame` call — zero per-frame allocation.
pub struct FrameLuts {
    /// `vignette_rows[y]` = background RGB after vignette dimming for that row.
    /// Lets the background fill + vignette pass collapse into a single loop with
    /// no floating-point arithmetic.
    pub vignette_rows: Vec<[u8; 3]>,

    /// `fullbg_alpha[y * w + x]` = pre-computed radial gradient alpha for the
    /// "fullbg" layout.  Empty for all other layouts.
    pub fullbg_alpha: Vec<f32>,

    /// `karaoke_alpha[y * w + x]` = pre-computed radial gradient alpha for the
    /// "karaoke" layout.  Empty for all other layouts.
    pub karaoke_alpha: Vec<f32>,
}

/// Pre-compute all per-frame constants that depend only on canvas size, background
/// colour, and layout — not on audio content or time.
///
/// Call once before the frame loop.  For a 30-min render this eliminates:
///   • 49 billion per-pixel float multiplies (vignette)
///   • 49 billion `sqrt` calls (radial gradients for fullbg / karaoke)
pub fn compute_frame_luts(w: usize, h: usize, bg: [u8; 3], layout: &str) -> FrameLuts {
    // Vignette: combine solid-colour fill + linear dimming into one [u8;3] per row.
    // render_frame can then fill entire rows with a simple array copy — no f32 math.
    let vignette_rows: Vec<[u8; 3]> = (0..h)
        .map(|y| {
            let keep = 1.0
                - (BG_DARK_TOP
                    + (BG_DARK_BOTTOM - BG_DARK_TOP) * y as f32 / h as f32)
                    .clamp(0.0, 1.0);
            [
                (bg[0] as f32 * keep) as u8,
                (bg[1] as f32 * keep) as u8,
                (bg[2] as f32 * keep) as u8,
            ]
        })
        .collect();

    // Radial gradient for "fullbg": sqrt computed once, stored as alpha.
    let fullbg_alpha = if layout == "fullbg" {
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

    // Radial gradient for "karaoke": sqrt computed once, stored as alpha.
    let karaoke_alpha = if layout == "karaoke" {
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

/// Render one complete RGBA frame (w × h × 4 bytes) into a new Vec<u8>.
///
/// Thread-safe: all mutable state (`eq_snapshot`) is owned by the caller
/// and passed as a read-only slice computed by `advance_eq_state`.
/// `luts` is shared read-only across all parallel frame renders.
#[allow(clippy::too_many_arguments)]
pub fn render_frame(
    w: usize,
    h: usize,
    peaks: &[f32],
    wc: [u8; 3],
    style: &str,
    t_sec: f64,
    dur: f64,
    layout: &str,
    eq_snapshot: &[f32],
    fft_peaks: &[f32],
    fft_n_buckets: usize,
    luts: &FrameLuts,
) -> Vec<u8> {
    let mut px = vec![0u8; w * h * 4];

    // ── Stage A: background + vignette in one pass (no float math) ───────────
    // vignette_rows[y] already encodes bg_colour × keep_factor for each row.
    for y in 0..h {
        let [r, g, b] = luts.vignette_rows[y];
        let row_start = y * w * 4;
        let row_end   = row_start + w * 4;
        let row       = &mut px[row_start..row_end];
        for c in row.chunks_exact_mut(4) {
            c[0] = r; c[1] = g; c[2] = b; c[3] = 255;
        }
    }

    if peaks.is_empty() { return px; }

    let wave = |px: &mut Vec<u8>, wx: f32, wy: f32, ww: f32, wh: f32| {
        render_wave(px, w, h, peaks, wc, style, t_sec, dur,
            wx as usize, wy, ww as usize, wh, eq_snapshot, fft_peaks, fft_n_buckets);
    };

    match layout {
        "spotify" => {
            let av_cy = (h as f32 * 0.26) as i32;
            let av_r  = (h as f32 * 0.18) as i32;
            draw_gradient_circle(&mut px, w, h, w as i32 / 2, av_cy, av_r, PINK, wc);
            draw_circle_ring(&mut px, w, h, w as i32 / 2, av_cy, av_r, 2, [255, 255, 255], 0.22);
            wave(&mut px, w as f32 * 0.04, h as f32 * 0.60, w as f32 * 0.92, h as f32 * 0.22);
        }
        "split" => {
            fill_rect(&mut px, w, h, 0, 0, w / 2, h, [0x3D, 0x1A, 0x6E], 0.80);
            let bs = (w as f32 * 0.42) as usize;
            let be = (w as f32 * 0.56) as usize;
            for x in bs..be.min(w) {
                let t = (x - bs) as f32 / (be - bs) as f32;
                for y in 0..h { blend(&mut px, (y*w+x)*4, [0x1A, 0x0A, 0x3E], 1.0 - t); }
            }
            wave(&mut px, w as f32 * 0.55, h as f32 * 0.42, w as f32 * 0.41, h as f32 * 0.30);
        }
        "fullbg" => {
            // ── Radial gradient via LUT (no sqrt per pixel per frame) ────────
            if !luts.fullbg_alpha.is_empty() {
                for y in 0..h {
                    let row = y * w;
                    for x in 0..w {
                        blend(&mut px, (row + x) * 4, PINK, luts.fullbg_alpha[row + x]);
                    }
                }
            }
            // Extra darkening pass (applied after gradient overlay)
            for c in px.chunks_exact_mut(4) {
                c[0] = (c[0] as f32 * 0.52) as u8;
                c[1] = (c[1] as f32 * 0.52) as u8;
                c[2] = (c[2] as f32 * 0.52) as u8;
            }
            let av_cy = (h as f32 * 0.22) as i32;
            let av_r  = (h as f32 * 0.15) as i32;
            draw_gradient_circle(&mut px, w, h, w as i32 / 2, av_cy, av_r, PINK, wc);
            draw_circle_ring(&mut px, w, h, w as i32 / 2, av_cy, av_r, 2, [255, 255, 255], 0.28);
            let bs = (h as f32 * 0.58) as usize;
            for y in bs..h {
                let t = (y - bs) as f32 / (h - bs) as f32;
                let row = y * w;
                for x in 0..w { blend(&mut px, (row+x)*4, [0,0,0], t * 0.70); }
            }
            wave(&mut px, w as f32 * 0.04, h as f32 * 0.62, w as f32 * 0.92, h as f32 * 0.20);
        }
        "karaoke" => {
            // ── Radial gradient via LUT ───────────────────────────────────────
            if !luts.karaoke_alpha.is_empty() {
                for y in 0..h {
                    let row = y * w;
                    for x in 0..w {
                        blend(&mut px, (row + x) * 4, wc, luts.karaoke_alpha[row + x]);
                    }
                }
            }
            wave(&mut px, w as f32 * 0.04, h as f32 * 0.78, w as f32 * 0.92, h as f32 * 0.10);
        }
        "brand" => {
            let bw = (w as f32 * 0.012).max(4.0) as usize;
            for y in 0..h {
                let t = y as f32 / h as f32;
                let col = [
                    (wc[0] as f32 * (1.0-t) + PINK[0] as f32 * t) as u8,
                    (wc[1] as f32 * (1.0-t) + PINK[1] as f32 * t) as u8,
                    (wc[2] as f32 * (1.0-t) + PINK[2] as f32 * t) as u8,
                ];
                for x in 0..bw { blend(&mut px, (y*w+x)*4, col, 1.0); }
            }
            let av_cx = (w as f32 * 0.12) as i32;
            let av_cy = (h as f32 * 0.50) as i32;
            let av_r  = (h as f32 * 0.14).min(w as f32 * 0.09) as i32;
            draw_gradient_circle(&mut px, w, h, av_cx, av_cy, av_r, wc, PINK);
            draw_circle_ring(&mut px, w, h, av_cx, av_cy, av_r, 2, [255, 255, 255], 0.22);
            let divx = (w as f32 * 0.52) as usize;
            for y in (h as f32 * 0.10) as usize..(h as f32 * 0.90) as usize {
                blend(&mut px, (y*w+divx)*4, [255,255,255], 0.08);
            }
            wave(&mut px, w as f32 * 0.55, h as f32 * 0.12, w as f32 * 0.42, h as f32 * 0.76);
        }
        _ => {
            // "minimal" — waveform is the hero
            wave(&mut px, w as f32 * 0.02, h as f32 * 0.30, w as f32 * 0.96, h as f32 * 0.36);
        }
    }

    px
}
