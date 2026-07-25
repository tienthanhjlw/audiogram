use std::{
    path::{Path, PathBuf},
    process::Command,
};
use crate::shared::AppError;

/// Probe audio duration in seconds by parsing `Duration:` from `ffmpeg -i` stderr.
pub fn audio_duration(ffmpeg: &Path, audio_path: &str) -> f64 {
    let Ok(out) = Command::new(ffmpeg).arg("-i").arg(audio_path).output() else {
        return 0.0;
    };
    for line in String::from_utf8_lossy(&out.stderr).lines() {
        if let Some(pos) = line.find("Duration:") {
            let ts = line[pos + 9..].trim().split(',').next().unwrap_or("").trim();
            let parts: Vec<&str> = ts.split(':').collect();
            if parts.len() == 3 {
                let hh: f64 = parts[0].parse().unwrap_or(0.0);
                let mm: f64 = parts[1].parse().unwrap_or(0.0);
                let ss: f64 = parts[2].parse().unwrap_or(0.0);
                return hh * 3600.0 + mm * 60.0 + ss;
            }
        }
    }
    0.0
}

/// Convert any audio to 16 kHz mono PCM WAV in `tmp_dir`.
/// Returns the source path unchanged if it is already a `.wav`.
pub fn to_wav(ffmpeg: &Path, audio_path: &str, tmp_dir: &Path) -> Result<PathBuf, AppError> {
    if audio_path.to_lowercase().ends_with(".wav") {
        return Ok(PathBuf::from(audio_path));
    }
    std::fs::create_dir_all(tmp_dir)
        .map_err(|e| AppError::AudioDecode(format!("create tmp dir: {e}")))?;
    let out = tmp_dir.join("whisper_input.wav");
    let out_cmd = Command::new(ffmpeg)
        .args(["-y", "-i", audio_path, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", "-vn"])
        .arg(&out)
        .output()
        .map_err(|e| AppError::AudioDecode(format!("ffmpeg wav convert: {e}")))?;
    if !out_cmd.status.success() {
        return Err(AppError::AudioDecode(
            String::from_utf8_lossy(&out_cmd.stderr)
                .lines()
                .last()
                .unwrap_or("WAV conversion failed")
                .to_string(),
        ));
    }
    Ok(out)
}

/// Decode audio to 16 kHz mono f32 PCM via FFmpeg → temp WAV file → hound.
///
/// Writes to a temp file (PID-scoped) instead of stdout pipe to avoid allocating
/// the full raw-bytes buffer before f32 casting (was ~230 MB for a 1-hour file).
pub fn decode_pcm_hound(ffmpeg: &Path, audio_path: &str) -> Result<Vec<f32>, AppError> {
    let tmp = std::env::temp_dir().join("audiogram_spectrum");
    std::fs::create_dir_all(&tmp)
        .map_err(|e| AppError::AudioDecode(format!("mkdir spectrum tmp: {e}")))?;
    let wav_path = tmp.join(format!("spectrum_{}.wav", std::process::id()));

    let out = Command::new(ffmpeg)
        .args(["-y", "-i", audio_path,
               "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", "-vn"])
        .arg(&wav_path)
        .output()
        .map_err(|e| AppError::AudioDecode(format!("ffmpeg to wav: {e}")))?;

    if !out.status.success() {
        return Err(AppError::AudioDecode(
            String::from_utf8_lossy(&out.stderr)
                .lines()
                .last()
                .unwrap_or("FFmpeg WAV conversion failed")
                .to_string(),
        ));
    }

    let samples = {
        let mut reader = hound::WavReader::open(&wav_path)
            .map_err(|e| AppError::AudioDecode(format!("hound open: {e}")))?;
        reader
            .samples::<i16>()
            .map(|s| s.map(|v| v as f32 / i16::MAX as f32))
            .collect::<Result<Vec<f32>, _>>()
            .map_err(|e| AppError::AudioDecode(format!("hound read: {e}")))?
    };

    let _ = std::fs::remove_file(&wav_path);
    Ok(samples)
}
