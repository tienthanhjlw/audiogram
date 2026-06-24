/// Real-spectrum analysis via Short-Time Fourier Transform (STFT).
///
/// Replaces the time-domain amplitude envelope used by all other wave styles with
/// genuine frequency-band data for the "eq" style — each of the 40 bars maps to a
/// distinct frequency range on a log scale (60 Hz … 8 kHz).
use rustfft::{num_complex::Complex, FftPlanner};
use serde::Serialize;
use std::f32::consts::PI;

// ── Constants ─────────────────────────────────────────────────────────────────

/// Number of EQ bars / frequency bands. Must match `BARS` in WaveformCanvas.tsx.
pub const EQ_BANDS: usize = 40;

/// Buckets per second for the FFT spectrum (independent of WAVE_BPS).
/// Lower than WAVE_BPS so the JSON payload stays small (~30 BPS × 40 bands × 4 B ≈ 4.8 kB/s).
pub const EQ_BPS: u32 = 30;

/// Sample rate used for PCM decode. 16 kHz covers all speech + music up to 8 kHz.
const SAMPLE_RATE: u32 = 16_000;

/// FFT window size. At 16 kHz: bin resolution = 16000/1024 ≈ 15.6 Hz.
const FFT_SIZE: usize = 1024;

/// Lowest / highest frequencies mapped to the 40 bands (log scale).
const MIN_FREQ: f32 = 60.0;
const MAX_FREQ: f32 = 7_800.0;

// ── Public API ────────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct SpectrumResult {
    /// Flat Vec<f32> of length `n_buckets × EQ_BANDS`.
    /// Access: `bands[t * EQ_BANDS + b]` = amplitude of band b at time bucket t.
    pub bands: Vec<f32>,
    pub n_buckets: usize,
    pub n_bands: usize,
}

// ── Core STFT ─────────────────────────────────────────────────────────────────

/// Compute a log-scale spectrum from mono f32 PCM.
/// Returns a SpectrumResult with `n_buckets × EQ_BANDS` amplitudes normalized 0..1.
pub fn compute_spectrum(pcm: &[f32], sample_rate: u32, bps: u32) -> SpectrumResult {
    let hop = (sample_rate / bps).max(1) as usize;
    let n = pcm.len();
    let n_buckets = if n >= FFT_SIZE { (n - FFT_SIZE) / hop + 1 } else { 0 };

    if n_buckets == 0 {
        return SpectrumResult { bands: vec![], n_buckets: 0, n_bands: EQ_BANDS };
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
    SpectrumResult { bands, n_buckets, n_bands: EQ_BANDS }
}

/// Decode audio and compute STFT spectrum — used by the `analyze_spectrum` Tauri command.
///
/// Uses `decode_pcm_hound` (FFmpeg → WAV file → hound → rubato) instead of the
/// old pipe-based `decode_pcm` to avoid large stdout buffer allocations on long audio.
pub fn analyze(ffmpeg: &std::path::Path, audio_path: &str) -> Result<SpectrumResult, crate::shared::AppError> {
    let pcm = crate::infrastructure::ffmpeg::audio::decode_pcm_hound(ffmpeg, audio_path)?;
    Ok(compute_spectrum(&pcm, SAMPLE_RATE, EQ_BPS))
}
