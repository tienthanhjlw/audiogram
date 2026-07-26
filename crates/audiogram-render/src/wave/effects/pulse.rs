//! `pulse` — bell-windowed bars (centre emphasised, edges tapered).
//! Parity: src/waves/pulse.ts
use std::f32::consts::PI;
use crate::{
    frame::{BAR_FILL, GAP_FILL},
    pixel::draw_capsule_bar,
    wave::{WaveCtx, WaveEffect},
};

pub struct PulseEffect;

impl WaveEffect for PulseEffect {
    fn id(&self) -> &'static str { "pulse" }

    fn draw(&self, px: &mut [u8], c: &WaveCtx) {
        let m = c.env.len();
        let bars = 40usize;
        let bar_w = c.ww as f32 * BAR_FILL / bars as f32;
        let gap = c.ww as f32 * GAP_FILL / bars as f32;
        let mid_y = c.wy + c.wh / 2.0;
        let cur = ((c.t_sec / c.dur) * (m - 1) as f64).round() as i64;
        let half = (bars / 2) as i64;
        for i in 0..bars {
            let raw_idx = (cur - half + i as i64).max(0).min((m - 1) as i64) as usize;
            let t = i as f32 / (bars - 1) as f32;
            let p = c.env[raw_idx] * (t * PI).sin().powf(0.65);
            let half_h = (p * c.wh / 2.0).max(2.0);
            let cx = (c.wx as f32 + i as f32 * (bar_w + gap) + bar_w * 0.5) as i32;
            let y0 = (mid_y - half_h).max(0.0) as i32;
            let y1 = (mid_y + half_h).min(c.h as f32) as i32;
            let hbw = (bar_w * 0.5).max(1.0) as i32;
            draw_capsule_bar(px, c.w, c.h, cx, y0, y1, hbw, c.wc, 0.27, 1.0);
        }
    }
}
