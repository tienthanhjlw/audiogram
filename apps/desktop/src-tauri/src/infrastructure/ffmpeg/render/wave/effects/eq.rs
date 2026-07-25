//! `eq` — spectrum analyser bars. Reads the pre-computed EMA snapshot
//! (advanced sequentially by `advance_eq_state` before parallel render).
//! Parity: src/waves/eq.ts
use crate::infrastructure::ffmpeg::render::{
    frame::{BAR_FILL, GAP_FILL},
    pixel::draw_capsule_bar,
    wave::{WaveCtx, WaveEffect},
};
use crate::infrastructure::spectrum::rustfft::EQ_BANDS;

pub struct EqEffect;

impl WaveEffect for EqEffect {
    fn id(&self) -> &'static str { "eq" }

    fn needs_spectrum(&self) -> bool { true }

    fn draw(&self, px: &mut [u8], c: &WaveCtx) {
        let bars = EQ_BANDS;
        let bar_w = c.ww as f32 * BAR_FILL / bars as f32;
        let gap = c.ww as f32 * GAP_FILL / bars as f32;
        let mid_y = c.wy + c.wh / 2.0;
        for i in 0..bars {
            let p = c.eq_snapshot.get(i).copied().unwrap_or(0.0);
            let half_h = (p * c.wh / 2.0).max(2.0);
            let cx = (c.wx as f32 + i as f32 * (bar_w + gap) + bar_w * 0.5) as i32;
            let y0 = (mid_y - half_h).max(0.0) as i32;
            let y1 = (mid_y + half_h).min(c.h as f32) as i32;
            let hbw = (bar_w * 0.5).max(1.0) as i32;
            draw_capsule_bar(px, c.w, c.h, cx, y0, y1, hbw, c.wc, 0.19, 1.0);
        }
    }
}
