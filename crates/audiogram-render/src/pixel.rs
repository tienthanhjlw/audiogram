/// Low-level RGBA pixel-buffer drawing primitives.
/// All functions operate on a flat `&mut [u8]` buffer of width×height×4 bytes (RGBA).

// ── Alpha compositing ─────────────────────────────────────

/// Alpha-blend `rgb` colour over the pixel at byte offset `idx` in the RGBA buffer.
#[inline]
pub fn blend(px: &mut [u8], idx: usize, rgb: [u8; 3], a: f32) {
    let ia = 1.0 - a;
    px[idx]     = (px[idx]     as f32 * ia + rgb[0] as f32 * a) as u8;
    px[idx + 1] = (px[idx + 1] as f32 * ia + rgb[1] as f32 * a) as u8;
    px[idx + 2] = (px[idx + 2] as f32 * ia + rgb[2] as f32 * a) as u8;
    // alpha channel (idx+3) intentionally untouched — frame is always fully opaque
}

// ── Filled shapes ─────────────────────────────────────────

/// Fill the rectangle `[x0, x1) × [y0, y1)` with `col` at opacity `a`.
pub fn fill_rect(
    px: &mut [u8],
    w: usize,
    h: usize,
    x0: usize,
    y0: usize,
    x1: usize,
    y1: usize,
    col: [u8; 3],
    a: f32,
) {
    let x1 = x1.min(w);
    let y1 = y1.min(h);
    for y in y0..y1 {
        for x in x0..x1 {
            blend(px, (y * w + x) * 4, col, a);
        }
    }
}

/// Draw a gradient-filled circle (used as avatar placeholder when no cover image).
/// The gradient runs diagonally from `col1` (top-left) to `col2` (bottom-right).
pub fn draw_gradient_circle(
    px: &mut [u8],
    w: usize,
    h: usize,
    cx: i32,
    cy: i32,
    r: i32,
    col1: [u8; 3],
    col2: [u8; 3],
) {
    let diam = (r * 2 + 1) as f32;
    for dy in -r..=r {
        for dx in -r..=r {
            if dx * dx + dy * dy <= r * r {
                let x = cx + dx;
                let y = cy + dy;
                if x >= 0 && x < w as i32 && y >= 0 && y < h as i32 {
                    let t = ((dx + r) as f32 / diam + (dy + r) as f32 / diam) / 2.0;
                    let col = lerp_color(col1, col2, t);
                    blend(px, (y as usize * w + x as usize) * 4, col, 1.0);
                }
            }
        }
    }
}

/// Draw a circular ring border of `thickness` pixels at opacity `a`.
pub fn draw_circle_ring(
    px: &mut [u8],
    w: usize,
    h: usize,
    cx: i32,
    cy: i32,
    r: i32,
    thickness: i32,
    col: [u8; 3],
    a: f32,
) {
    let r_out2 = (r + thickness) * (r + thickness);
    let r_in2 = r * r;
    let extent = r + thickness;
    for dy in -extent..=extent {
        for dx in -extent..=extent {
            let d2 = dx * dx + dy * dy;
            if d2 <= r_out2 && d2 >= r_in2 {
                let x = cx + dx;
                let y = cy + dy;
                if x >= 0 && x < w as i32 && y >= 0 && y < h as i32 {
                    blend(px, (y as usize * w + x as usize) * 4, col, a);
                }
            }
        }
    }
}

/// Draw a capsule (pill) bar: rectangular body with semicircular top and bottom caps.
/// `cx` is the horizontal centre, `y0`/`y1` are top/bottom pixel rows (inclusive).
/// `half_w` is the half-width of the bar. `a_edge` is the alpha at the very top/bottom
/// of the caps; `a_mid` is the alpha at the vertical midpoint.
pub fn draw_capsule_bar(
    px: &mut [u8],
    w: usize,
    h: usize,
    cx: i32,
    y0: i32,
    y1: i32,
    half_w: i32,
    col: [u8; 3],
    a_edge: f32,
    a_mid: f32,
) {
    if y0 >= y1 || half_w <= 0 { return; }
    let bar_h = y1 - y0;
    let r = half_w.min(bar_h / 2);
    let top_cy = y0 + r;
    let bot_cy = y1 - r;

    for iy in y0..y1 {
        if iy < 0 || iy >= h as i32 { continue; }
        let (xa, xb) = if iy >= top_cy && iy <= bot_cy {
            // Rectangular body — full width
            ((cx - half_w).max(0) as usize, (cx + half_w).min(w as i32) as usize)
        } else {
            // Cap region — clip x by circle radius
            let cy_cap = if iy < top_cy { top_cy } else { bot_cy };
            let dy = iy - cy_cap;
            let dx2 = r * r - dy * dy;
            if dx2 < 0 { continue; }
            let dx = (dx2 as f32).sqrt() as i32;
            ((cx - dx).max(0) as usize, (cx + dx + 1).min(w as i32) as usize)
        };

        let tf = (iy - y0) as f32 / bar_h.max(1) as f32;
        // Gradient: a_edge at top cap → a_mid at centre → a_edge at bottom cap
        let a = a_edge + (a_mid - a_edge) * (1.0 - (tf * 2.0 - 1.0).abs());

        for x in xa..xb {
            blend(px, (iy as usize * w + x) * 4, col, a);
        }
    }
}

/// Draw a filled circle of radius `r` centred at `(cx, cy)` with colour `col` at opacity `a`.
pub fn fill_circle(px: &mut [u8], w: usize, h: usize, cx: i32, cy: i32, r: i32, col: [u8; 3], a: f32) {
    let r2 = r * r;
    for dy in -r..=r {
        for dx in -r..=r {
            if dx * dx + dy * dy <= r2 {
                let x = cx + dx;
                let y = cy + dy;
                if x >= 0 && x < w as i32 && y >= 0 && y < h as i32 {
                    blend(px, (y as usize * w + x as usize) * 4, col, a);
                }
            }
        }
    }
}

// ── Lines ─────────────────────────────────────────────────

/// Bresenham line with circular pen of radius `r` — used for the "line" waveform style.
pub fn draw_thick_line(
    px: &mut [u8],
    w: usize,
    h: usize,
    x0: i32,
    y0: i32,
    x1: i32,
    y1: i32,
    rgb: [u8; 3],
    r: i32,
) {
    let dx = (x1 - x0).abs();
    let dy = -(y1 - y0).abs();
    let sx = if x0 < x1 { 1i32 } else { -1 };
    let sy = if y0 < y1 { 1i32 } else { -1 };
    let mut err = dx + dy;
    let (mut cx, mut cy) = (x0, y0);
    loop {
        for ty in -r..=r {
            for tx in -r..=r {
                if tx * tx + ty * ty <= r * r {
                    let px2 = cx + tx;
                    let py2 = cy + ty;
                    if px2 >= 0 && px2 < w as i32 && py2 >= 0 && py2 < h as i32 {
                        blend(px, (py2 as usize * w + px2 as usize) * 4, rgb, 1.0);
                    }
                }
            }
        }
        if cx == x1 && cy == y1 {
            break;
        }
        let e2 = 2 * err;
        if e2 >= dy {
            err += dy;
            cx += sx;
        }
        if e2 <= dx {
            err += dx;
            cy += sy;
        }
    }
}

// ── Internal helpers ──────────────────────────────────────

#[inline]
fn lerp_color(a: [u8; 3], b: [u8; 3], t: f32) -> [u8; 3] {
    [
        (a[0] as f32 * (1.0 - t) + b[0] as f32 * t) as u8,
        (a[1] as f32 * (1.0 - t) + b[1] as f32 * t) as u8,
        (a[2] as f32 * (1.0 - t) + b[2] as f32 * t) as u8,
    ]
}
