//! Real-spectrum analysis via Short-Time Fourier Transform (STFT).
//!
//! Replaces the time-domain amplitude envelope used by all other wave styles with
//! genuine frequency-band data for the "eq" style — each of the 40 bars maps to a
//! distinct frequency range on a log scale (60 Hz … 8 kHz).
//!
//! Pure — no I/O, no app-crate types. `analyze()` (decode audio → PCM → call
//! `compute_spectrum`) stays in the app crate's `infrastructure/spectrum/rustfft.rs`
//! since decoding needs the app's ffmpeg resolver/process spawn, which PACKAGE_SPLIT_PLAN.md
//! §3.1 explicitly keeps out of any extracted crate (no second consumer yet).
use rustfft::{num_complex::Complex, FftPlanner};
use serde::Serialize;
use specta::Type;
use std::f32::consts::PI;

// ── Constants ─────────────────────────────────────────────────────────────────
// Sourced from contract/constants.json via audiogram-core's contract_gen.rs
// (T16 moved contract_gen.rs there specifically so this crate and
// audiogram-render/audiogram-subtitle could all depend on it, closing the
// temporary duplication T15 introduced here).
pub use audiogram_core::contract_gen::{EQ_BANDS, EQ_BPS};

/// Sample rate used for PCM decode. 16 kHz covers all speech + music up to 8 kHz.
pub const SAMPLE_RATE: u32 = 16_000;

/// FFT window size. At 16 kHz: bin resolution = 16000/1024 ≈ 15.6 Hz.
const FFT_SIZE: usize = 1024;

/// Lowest / highest frequencies mapped to the 40 bands (log scale).
const MIN_FREQ: f32 = 60.0;
const MAX_FREQ: f32 = 7_800.0;

// ── Public API ────────────────────────────────────────────────────────────────

#[derive(Serialize, Type)]
pub struct SpectrumResult {
    /// Flat Vec<f32> of length `n_buckets × EQ_BANDS`.
    /// Access: `bands[t * EQ_BANDS + b]` = amplitude of band b at time bucket t.
    pub bands: Vec<f32>,
    // u32 (not usize): specta's TS exporter forbids pointer-width ints.
    // Bucket/band counts here are in the low thousands at most.
    pub n_buckets: u32,
    pub n_bands: u32,
}

// ── Core STFT ─────────────────────────────────────────────────────────────────

/// Compute a log-scale spectrum from mono f32 PCM.
/// Returns a SpectrumResult with `n_buckets × EQ_BANDS` amplitudes normalized 0..1.
pub fn compute_spectrum(pcm: &[f32], sample_rate: u32, bps: u32) -> SpectrumResult {
    let hop = (sample_rate / bps).max(1) as usize;
    let n = pcm.len();
    let n_buckets = if n >= FFT_SIZE { (n - FFT_SIZE) / hop + 1 } else { 0 };

    if n_buckets == 0 {
        return SpectrumResult { bands: vec![], n_buckets: 0, n_bands: EQ_BANDS as u32 };
    }

    // Hann window coefficients
    let hann: Vec<f32> = (0..FFT_SIZE)
        .map(|i| 0.5 * (1.0 - (2.0 * PI * i as f32 / (FFT_SIZE as f32 - 1.0)).cos()))
        .collect();

    // Log-scale band boundaries — each band covers a range of FFT bins
    let log_min = MIN_FREQ.log2();
    let log_max = MAX_FREQ.log2();
    let band_ranges: Vec<(usize, usize)> = (0..EQ_BANDS)
        .map(|b| {
            let t0 = b as f32 / EQ_BANDS as f32;
            let t1 = (b + 1) as f32 / EQ_BANDS as f32;
            let f0 = 2f32.powf(log_min + t0 * (log_max - log_min));
            let f1 = 2f32.powf(log_min + t1 * (log_max - log_min));
            let bin0 = ((f0 * FFT_SIZE as f32 / sample_rate as f32).floor() as usize).max(1);
            let bin1 = ((f1 * FFT_SIZE as f32 / sample_rate as f32).ceil() as usize)
                .min(FFT_SIZE / 2 - 1)
                .max(bin0 + 1);
            (bin0, bin1)
        })
        .collect();

    let mut planner = FftPlanner::<f32>::new();
    let fft = planner.plan_fft_forward(FFT_SIZE);
    let mut buf = vec![Complex { re: 0.0f32, im: 0.0f32 }; FFT_SIZE];

    let mut raw = vec![0.0f32; n_buckets * EQ_BANDS];
    let mut global_max = 1e-9f32;

    for t in 0..n_buckets {
        let start = t * hop;
        for (k, b) in buf.iter_mut().enumerate() {
            let s = if start + k < n { pcm[start + k] } else { 0.0 };
            b.re = s * hann[k];
            b.im = 0.0;
        }
        fft.process(&mut buf);

        for (band, &(b0, b1)) in band_ranges.iter().enumerate() {
            let mag: f32 = buf[b0..b1].iter().map(|c| c.norm()).sum::<f32>() / (b1 - b0) as f32;
            raw[t * EQ_BANDS + band] = mag;
            if mag > global_max { global_max = mag; }
        }
    }

    // Normalize and apply mild perceptual compression (^0.65 = lift quiet content)
    let bands: Vec<f32> = raw.iter().map(|&v| (v / global_max).powf(0.65)).collect();
    SpectrumResult { bands, n_buckets: n_buckets as u32, n_bands: EQ_BANDS as u32 }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// PACKAGE_SPLIT_PLAN.md §3.1's acceptance test for this crate: a pure
    /// 440Hz sine tone should produce peak energy in the band that covers
    /// 440Hz, proving the log-scale band mapping and FFT are wired correctly
    /// end to end — runnable with `cargo test -p audiogram-spectrum`, no
    /// Tauri/webview needed.
    #[test]
    fn sine_440hz_peaks_in_the_440hz_band() {
        let sample_rate = SAMPLE_RATE;
        let duration_secs = 1.0;
        let n = (sample_rate as f32 * duration_secs) as usize;
        let freq = 440.0f32;
        let pcm: Vec<f32> = (0..n)
            .map(|i| (2.0 * PI * freq * i as f32 / sample_rate as f32).sin())
            .collect();

        let result = compute_spectrum(&pcm, sample_rate, EQ_BPS);
        assert!(result.n_buckets > 0);

        // Average each band's energy across every time bucket, then find the
        // loudest band overall.
        let mut band_energy = vec![0.0f32; EQ_BANDS];
        for t in 0..result.n_buckets as usize {
            for b in 0..EQ_BANDS {
                band_energy[b] += result.bands[t * EQ_BANDS + b];
            }
        }
        let (loudest_band, _) = band_energy
            .iter()
            .enumerate()
            .max_by(|a, b| a.1.partial_cmp(b.1).unwrap())
            .unwrap();

        // Same log-scale band-boundary math as compute_spectrum, so this
        // computes which band index 440Hz actually falls into rather than
        // hardcoding one that would silently go stale if MIN_FREQ/MAX_FREQ
        // or EQ_BANDS ever change.
        let log_min = MIN_FREQ.log2();
        let log_max = MAX_FREQ.log2();
        let expected_band = (((freq.log2() - log_min) / (log_max - log_min)) * EQ_BANDS as f32)
            .floor() as usize;

        assert_eq!(loudest_band, expected_band);
    }
}
