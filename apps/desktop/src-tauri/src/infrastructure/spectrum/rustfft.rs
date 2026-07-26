/// Pure STFT math moved to crates/audiogram-spectrum (T15) — re-exported here
/// so existing `crate::infrastructure::spectrum::rustfft::{...}` call sites
/// keep resolving. `analyze()` stays in the app crate: it decodes audio via
/// `decode_pcm_hound`, which needs the app's ffmpeg resolver/process spawn —
/// PACKAGE_SPLIT_PLAN.md §3.1 explicitly keeps that kind of I/O out of any
/// extracted crate (no second consumer yet).
pub use audiogram_spectrum::{compute_spectrum, SpectrumResult, EQ_BANDS, EQ_BPS};

const SAMPLE_RATE: u32 = audiogram_spectrum::SAMPLE_RATE;

/// Decode audio and compute STFT spectrum — used by the `analyze_spectrum` Tauri command.
///
/// Uses `decode_pcm_hound` (FFmpeg → WAV file → hound → rubato) instead of the
/// old pipe-based `decode_pcm` to avoid large stdout buffer allocations on long audio.
pub fn analyze(ffmpeg: &std::path::Path, audio_path: &str) -> Result<SpectrumResult, crate::shared::AppError> {
    let pcm = crate::infrastructure::ffmpeg::audio::decode_pcm_hound(ffmpeg, audio_path)?;
    Ok(compute_spectrum(&pcm, SAMPLE_RATE, EQ_BPS))
}
