//! `line` — connected amplitude polyline.
//! Parity: src/waves/line.ts
use crate::{
    frame::WAVE_BARS,
    pixel::draw_thick_line,
    wave::{WaveCtx, WaveEffect},
};

pub struct LineEffect;

impl WaveEffect for LineEffect {
    fn id(&self) -> &'static str { "line" }

    fn draw(&self, px: &mut [u8], c: &WaveCtx) {
        let n = WAVE_BARS;
        let pts: Vec<(i32, i32)> = (0..n)
            .map(|i| {
                let p = c.heights[i] as f64;
                let x = (c.wx as f64 + i as f64 / (n - 1).max(1) as f64 * c.ww as f64) as i32;
                let y = (c.wy as f64 + c.wh as f64 / 2.0 - p * c.wh as f64 / 2.0) as i32;
                (x, y)
            })
            .collect();
        for seg in pts.windows(2) {
            draw_thick_line(px, c.w, c.h, seg[0].0, seg[0].1, seg[1].0, seg[1].1, c.wc, 2);
        }
    }
}
