/// Shared waveform helpers used by effects and the render pipeline.
use crate::frame::WAVE_BARS;
use audiogram_spectrum::EQ_BANDS;

/// Window `WAVE_BARS` amplitude buckets centred on `t_sec`.
/// Bar `WAVE_BARS/2` = now; left = past; right = future.
/// Clamps at edges — mirrors `waveHeights()` in WaveformCanvas.tsx.
pub fn wave_heights(env: &[f32], t_sec: f64, dur: f64) -> [f32; WAVE_BARS] {
    let mut out = [0f32; WAVE_BARS];
    let m = env.len();
    if m == 0 || dur <= 0.0 {
        return out;
    }
    let cur = ((t_sec / dur) * (m - 1) as f64).round() as i64;
    let half = (WAVE_BARS / 2) as i64;
    for i in 0..WAVE_BARS {
        let idx = (cur - half + i as i64).clamp(0, m as i64 - 1) as usize;
        out[i] = env[idx];
    }
    out
}

/// Advance the EQ EMA state by one frame — **must be called sequentially** (frame 0, 1, 2…).
///
/// Separating state advancement from drawing allows frame rendering to run
/// concurrently: callers pre-compute all snapshots in a sequential pass, then
/// hand each snapshot to a parallel frame renderer.
pub fn advance_eq_state(
    state: &mut [f32],
    fft_peaks: &[f32],
    fft_n_buckets: usize,
    env: &[f32],
    t_sec: f64,
    dur: f64,
) {
    let bars = EQ_BANDS;
    if state.len() < bars || dur <= 0.0 {
        return;
    }

    for i in 0..bars {
        let target: f32 = if fft_n_buckets > 0 && fft_peaks.len() == fft_n_buckets * bars {
            let fft_cur = (((t_sec / dur) * (fft_n_buckets - 1) as f64).round() as usize)
                .min(fft_n_buckets - 1);
            fft_peaks[fft_cur * bars + i]
        } else {
            let m = env.len();
            if m == 0 {
                0.0
            } else {
                const LAG: usize = 2;
                let cur = (((t_sec / dur) * (m - 1) as f64).round() as usize).min(m - 1);
                let sample_idx = cur.saturating_sub((bars - 1 - i) * LAG);
                let start = sample_idx.saturating_sub(2);
                let sum: f32 = env[start..=sample_idx].iter().sum();
                let count = sample_idx - start + 1;
                if count > 0 { sum / count as f32 } else { 0.0 }
            }
        };

        let frac = i as f32 / (bars - 1) as f32;
        let prev = state[i];
        let alpha = if target > prev { 0.40 } else { 0.045 + frac * 0.055 };
        state[i] = alpha * target + (1.0 - alpha) * prev;
    }
}
