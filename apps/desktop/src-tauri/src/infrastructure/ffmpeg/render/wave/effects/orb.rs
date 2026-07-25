//! `orb` — radial visualiser: bars radiate from a centre ring.
//! Parity: src/waves/orb.ts
use std::f32::consts::PI;
use crate::infrastructure::ffmpeg::render::{
    frame::{BAR_FILL, WAVE_BARS},
    pixel::{draw_circle_ring, fill_circle},
    wave::{WaveCtx, WaveEffect},
};

pub struct OrbEffect;

impl WaveEffect for OrbEffect {
    fn id(&self) -> &'static str { "orb" }

    fn draw(&self, px: &mut [u8], c: &WaveCtx) {
        let n = WAVE_BARS;
        let (w, h, wc) = (c.w, c.h, c.wc);
        let cx_f = c.wx as f32 + c.ww as f32 / 2.0;
        let cy_f = c.wy + c.wh / 2.0;
        let r_inner = c.wh.min(c.ww as f32) * 0.28;
        let max_ext = ((c.wh.min(c.ww as f32) / 2.0 - r_inner) * 0.94).max(1.0);
        let dot_r = ((c.ww as f32 * BAR_FILL / n as f32 * 0.32).max(1.0)) as i32;
        for (i, &p) in c.heights.iter().enumerate() {
            if p < 0.02 { continue; }
            let angle = (i as f32 / n as f32) * PI * 2.0 - PI / 2.0;
            let ext = r_inner * 0.04 + p * max_ext;
            let cos = angle.cos();
            let sin = angle.sin();
            let steps = (ext / 3.0).ceil() as usize + 1;
            for s in 0..=steps {
                let t = s as f32 / steps as f32;
                let r = r_inner + t * ext;
                let (col, a) = if t > 0.75 {
                    let tw = (t - 0.75) / 0.25;
                    ([
                        (wc[0] as f32 * (1.0 - tw) + 255.0 * tw) as u8,
                        (wc[1] as f32 * (1.0 - tw) + 255.0 * tw) as u8,
                        (wc[2] as f32 * (1.0 - tw) + 255.0 * tw) as u8,
                    ], 0.75 + t * 0.25)
                } else {
                    (wc, 0.30 + t * 0.55)
                };
                fill_circle(px, w, h, (cx_f + cos * r) as i32, (cy_f + sin * r) as i32, dot_r, col, a);
            }
        }
        draw_circle_ring(px, w, h, cx_f as i32, cy_f as i32, r_inner as i32 - 1, 1, wc, 0.25);
    }
}
