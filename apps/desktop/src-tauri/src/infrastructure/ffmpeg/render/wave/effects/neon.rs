//! `neon` — glowing bars: soft halo + body + bright core.
//! Parity: src/waves/neon.ts
use crate::infrastructure::ffmpeg::render::{
    frame::{BAR_FILL, GAP_FILL, WAVE_BARS},
    pixel::blend,
    wave::{WaveCtx, WaveEffect},
};

pub struct NeonEffect;

impl WaveEffect for NeonEffect {
    fn id(&self) -> &'static str { "neon" }

    fn draw(&self, px: &mut [u8], c: &WaveCtx) {
        let n = WAVE_BARS;
        let (w, h, wc) = (c.w, c.h, c.wc);
        let bar_w = c.ww as f32 * BAR_FILL / n as f32;
        let gap = c.ww as f32 * GAP_FILL / n as f32;
        let mid_y = c.wy + c.wh / 2.0;
        for (i, &p) in c.heights.iter().enumerate() {
            let bh = (p * c.wh).max(4.0);
            let x0 = c.wx + (i as f32 * (bar_w + gap)) as usize;
            let x1 = (c.wx + c.ww).min((x0 as f32 + bar_w) as usize + 1);
            let y0 = (mid_y - bh / 2.0).max(0.0) as usize;
            let y1 = (mid_y + bh / 2.0).min(h as f32 - 1.0) as usize;
            let hx0 = (x0 as i32 - (bar_w * 0.55) as i32).max(0) as usize;
            let hx1 = ((x1 as f32 + bar_w * 0.55) as usize + 1).min(w);
            let hy0 = (y0 as i32 - (bh * 0.10) as i32).max(0) as usize;
            let hy1 = (y1 + (bh * 0.10) as usize + 1).min(h - 1);
            for y in hy0..=hy1 { for x in hx0..hx1 { blend(px, (y * w + x) * 4, wc, 0.10); } }
            for y in y0..=y1 { for x in x0..x1 { blend(px, (y * w + x) * 4, wc, 0.55); } }
            let cx0 = x0 + (bar_w * 0.22) as usize;
            let cx1 = (x0 as f32 + bar_w * 0.78).min(w as f32 - 1.0) as usize;
            for y in y0..=y1 { for x in cx0..cx1.min(w) { blend(px, (y * w + x) * 4, [255, 255, 255], 0.88); } }
        }
    }
}
