//! `bar` — capsule bars with gradient. Default style.
//! Parity: src/waves/bar.ts
use crate::{
    frame::{BAR_FILL, GAP_FILL, WAVE_BARS},
    pixel::draw_capsule_bar,
    wave::{WaveCtx, WaveEffect},
};

pub struct BarEffect;

impl WaveEffect for BarEffect {
    fn id(&self) -> &'static str { "bar" }

    fn draw(&self, px: &mut [u8], c: &WaveCtx) {
        let n = WAVE_BARS;
        let bar_w = c.ww as f32 * BAR_FILL / n as f32;
        let gap = c.ww as f32 * GAP_FILL / n as f32;
        let mid_y = c.wy + c.wh / 2.0;
        for (i, &p) in c.heights.iter().enumerate() {
            let bh = (p * c.wh).max(4.0);
            let cx = (c.wx as f32 + i as f32 * (bar_w + gap) + bar_w * 0.5) as i32;
            let y0 = (mid_y - bh / 2.0).max(0.0) as i32;
            let y1 = (mid_y + bh / 2.0).min(c.h as f32) as i32;
            let half_w = (bar_w * 0.5).max(1.0) as i32;
            draw_capsule_bar(px, c.w, c.h, cx, y0, y1, half_w, c.wc, 0.55, 1.0);
        }
    }
}
