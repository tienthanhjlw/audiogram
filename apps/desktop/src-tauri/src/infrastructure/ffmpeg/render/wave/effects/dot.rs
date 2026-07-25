//! `dot` — vertical dot-matrix columns, fading from centre.
//! Parity: src/waves/dot.ts
use crate::infrastructure::ffmpeg::render::{
    frame::{BAR_FILL, GAP_FILL, WAVE_BARS},
    pixel::fill_circle,
    wave::{WaveCtx, WaveEffect},
};

pub struct DotEffect;

impl WaveEffect for DotEffect {
    fn id(&self) -> &'static str { "dot" }

    fn draw(&self, px: &mut [u8], c: &WaveCtx) {
        let n = WAVE_BARS;
        let dot_rows = 18usize;
        let bar_w = c.ww as f32 * BAR_FILL / n as f32;
        let gap = c.ww as f32 * GAP_FILL / n as f32;
        let row_h = c.wh / dot_rows as f32;
        let dot_r = ((bar_w * 0.38).max(1.5)) as i32;
        for (i, &p) in c.heights.iter().enumerate() {
            let cx = (c.wx as f32 + i as f32 * (bar_w + gap) + bar_w * 0.5) as i32;
            let active = (p * dot_rows as f32 * 0.5).round() as usize;
            for row in 0..dot_rows {
                let cy = (c.wy + (row as f32 + 0.5) * row_h) as i32;
                let dist = (row as i32 - dot_rows as i32 / 2).unsigned_abs() as usize;
                if dist <= active {
                    let intensity = 1.0 - dist as f32 / (dot_rows as f32 / 2.0 + 0.001);
                    fill_circle(px, c.w, c.h, cx, cy, dot_r, c.wc, intensity.max(0.1));
                } else {
                    fill_circle(px, c.w, c.h, cx, cy, (dot_r - 1).max(1), [255, 255, 255], 0.05);
                }
            }
        }
    }
}
