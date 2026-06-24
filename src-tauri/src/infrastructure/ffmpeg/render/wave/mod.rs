/// Waveform rendering — **plugin architecture**.
///
/// Each visual style lives in its own file under `effects/` and implements the
/// [`WaveEffect`] trait. The [`effect_for`] registry maps a style id → effect.
/// Adding a new style = add one `effects/<name>.rs` + one line in `effect_for`.
/// Nothing else in the pipeline changes.
///
/// Each effect file pairs 1:1 with a frontend counterpart in `src/waves/<name>.ts`
/// — keep the two in sync (the canvas preview is the parity contract).
pub mod support;
pub mod effects;

pub use support::{advance_eq_state, wave_heights};

use super::frame::WAVE_BARS;
use crate::domain::entities::WaveStyle;

/// Everything an effect needs to draw one frame's waveform.
/// Built once per frame by [`render_wave`] and passed to the selected effect.
pub struct WaveCtx<'a> {
    pub w: usize,
    pub h: usize,
    /// Raw amplitude envelope (full track). Some effects window it themselves.
    pub env: &'a [f32],
    /// Pre-windowed `WAVE_BARS` amplitudes centred on `t_sec` (via `wave_heights`).
    pub heights: [f32; WAVE_BARS],
    /// Wave colour RGB.
    pub wc: [u8; 3],
    pub t_sec: f64,
    pub dur: f64,
    /// Waveform rect inside the frame.
    pub wx: usize,
    pub wy: f32,
    pub ww: usize,
    pub wh: f32,
    /// Pre-computed EMA snapshot for spectrum effects (empty otherwise).
    pub eq_snapshot: &'a [f32],
    /// Flat FFT spectrum (empty when unavailable).
    pub fft_peaks: &'a [f32],
    pub fft_n_buckets: usize,
}

/// A self-contained waveform visual style.
/// Implementors are zero-size unit structs registered in [`effect_for`].
pub trait WaveEffect: Sync {
    /// Style id — must match the `WaveStyle` value sent from the frontend.
    fn id(&self) -> &'static str;

    /// Whether this effect consumes the pre-computed spectrum/EMA snapshot.
    /// The render pipeline uses this (instead of a hardcoded `== "eq"`) to decide
    /// whether to run the sequential `advance_eq_state` pre-pass.
    fn needs_spectrum(&self) -> bool {
        false
    }

    /// Draw the waveform into the RGBA frame buffer `px`.
    fn draw(&self, px: &mut [u8], c: &WaveCtx);
}

/// Registry: resolve a `WaveStyle` to its effect. Exhaustive — no silent fallback.
pub fn effect_for(style: WaveStyle) -> &'static dyn WaveEffect {
    match style {
        WaveStyle::Bar    => &effects::bar::BarEffect,
        WaveStyle::Line   => &effects::line::LineEffect,
        WaveStyle::Mirror => &effects::mirror::MirrorEffect,
        WaveStyle::Dot    => &effects::dot::DotEffect,
        WaveStyle::Neon   => &effects::neon::NeonEffect,
        WaveStyle::Orb    => &effects::orb::OrbEffect,
        WaveStyle::Pulse  => &effects::pulse::PulseEffect,
        WaveStyle::Eq     => &effects::eq::EqEffect,
        WaveStyle::Player => &effects::player::PlayerEffect,
    }
}

/// Draw the waveform for one frame into `px`. Dispatches to the plugin via [`effect_for`].
#[allow(clippy::too_many_arguments)]
pub fn render_wave(
    px: &mut [u8],
    w: usize,
    h: usize,
    env: &[f32],
    wc: [u8; 3],
    style: WaveStyle,
    t_sec: f64,
    dur: f64,
    wx: usize,
    wy: f32,
    ww: usize,
    wh: f32,
    eq_snapshot: &[f32],
    fft_peaks: &[f32],
    fft_n_buckets: usize,
) {
    if env.is_empty() || ww == 0 {
        return;
    }
    let heights = wave_heights(env, t_sec, dur);
    let ctx = WaveCtx {
        w, h, env, heights, wc, t_sec, dur, wx, wy, ww, wh,
        eq_snapshot, fft_peaks, fft_n_buckets,
    };
    effect_for(style).draw(px, &ctx);
}
