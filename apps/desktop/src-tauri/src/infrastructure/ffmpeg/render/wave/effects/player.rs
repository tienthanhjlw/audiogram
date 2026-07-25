//! `player` — media player style: amplitude texture + progress fill + play triangle.
//! Parity: src/waves/player.ts
use crate::infrastructure::ffmpeg::render::{
    frame::{BAR_FILL, GAP_FILL, WAVE_BARS},
    pixel::{blend, fill_rect},
    wave::{WaveCtx, WaveEffect},
};

pub struct PlayerEffect;

impl WaveEffect for PlayerEffect {
    fn id(&self) -> &'static str { "player" }

    fn draw(&self, px: &mut [u8], c: &WaveCtx) {
        let n = WAVE_BARS;
        let bar_w = c.ww as f32 * BAR_FILL / n as f32;
        let gap   = c.ww as f32 * GAP_FILL / n as f32;
        let mid_y = c.wy + c.wh / 2.0;
        let progress = if c.dur > 0.0 { (c.t_sec / c.dur).min(1.0) as f32 } else { 0.0 };
        let fill_x = c.wx as f32 + c.ww as f32 * progress;

        // Background amplitude bars (dim)
        for (i, &p) in c.heights.iter().enumerate() {
            let bh = (p * c.wh * 0.7).max(3.0);
            let x0 = (c.wx as f32 + i as f32 * (bar_w + gap)) as usize;
            let x1 = (x0 as f32 + bar_w).min((c.wx + c.ww) as f32) as usize;
            let y0 = (mid_y - bh / 2.0).max(0.0) as usize;
            let y1 = (mid_y + bh / 2.0).min(c.h as f32) as usize;
            fill_rect(px, c.w, c.h, x0, y0, x1, y1, c.wc, 0.15);
        }

        // Progress-filled bars
        for (i, &p) in c.heights.iter().enumerate() {
            let bh = (p * c.wh * 0.7).max(3.0);
            let x0f = c.wx as f32 + i as f32 * (bar_w + gap);
            if x0f >= fill_x { break; }
            let x0 = x0f as usize;
            let x1 = ((x0f + bar_w).min(fill_x)).min((c.wx + c.ww) as f32) as usize;
            let y0 = (mid_y - bh / 2.0).max(0.0) as usize;
            let y1 = (mid_y + bh / 2.0).min(c.h as f32) as usize;
            let bar_alpha_step = 1.0 / bh.max(1.0);
            for y in y0..y1 {
                let local_t = (y as f32 - y0 as f32) * bar_alpha_step;
                let a = 1.0 - local_t * 0.45; // gradient: full at top, 55% at bottom
                fill_rect(px, c.w, c.h, x0, y, x1, y + 1, c.wc, a);
            }
        }

        // Scrubber line
        let lx = fill_x as usize;
        if lx + 2 <= c.wx + c.ww {
            fill_rect(px, c.w, c.h, lx, c.wy as usize, lx + 2, (c.wy + c.wh) as usize, c.wc, 0.95);
        }

        // Play triangle (left of wave zone)
        let tri_h = (c.wh * 0.38).max(6.0);
        let tri_x = c.wx.saturating_sub((tri_h * 1.2) as usize);
        for row in 0..(tri_h as usize) {
            let t = row as f32 / tri_h;
            let half_w = (t * tri_h * 0.85 / 2.0) as usize;
            let cy = (mid_y - tri_h / 2.0) as usize + row;
            let cx = tri_x + half_w.min(tri_x);
            let cx_end = (tri_x + 2 * half_w + 1).min(c.w);
            for x in cx..cx_end {
                if let Some(idx) = (cy * c.w + x).checked_mul(4) {
                    if idx + 3 < px.len() {
                        blend(px, idx, c.wc, 0.80);
                    }
                }
            }
        }
    }
}
