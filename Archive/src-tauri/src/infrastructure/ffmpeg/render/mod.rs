/// Video encoding pipeline — 3-stage architecture:
///
///   Stage 1 — Pre-compute  (sequential, fast)
///     • audio duration probe
///     • FFT spectrum decode   (decode_pcm_hound → hound → compute_spectrum)
///     • EQ EMA state chain    (advance_eq_state for every frame — sequential invariant)
///     • frame LUTs            (vignette rows, gradient alpha maps)
///
///   Stage 2 — Parallel render  (rayon thread pool, CPU-bound)
///     • batches of `cpu_count` frames rendered concurrently
///     • each frame is independent given its pre-computed eq_snapshot + shared LUTs
///     • order is preserved by rayon's indexed collect()
///
///   Stage 3 — Stream write  (sequential, I/O-bound)
///     • completed batch written to FFmpeg stdin in frame order
///     • FFmpeg encodes H.264 + AAC in a separate process concurrently
pub mod frame;
pub mod pixel;
pub mod wave;

use std::{
    fs,
    io::{BufRead, BufReader, Write},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    thread,
};
use rayon::prelude::*;
use tauri::{AppHandle, Emitter};

use crate::{
    domain::entities::RenderJob,
    infrastructure::{
        ffmpeg::audio::{audio_duration, decode_pcm_hound},
        spectrum::rustfft::{compute_spectrum, EQ_BANDS, EQ_BPS},
    },
    shared::{
        util::{emit_log, escape_drawtext, wrap_text_2lines},
        AppError,
    },
};

use self::{
    frame::{compute_frame_luts, render_frame},
    wave::{advance_eq_state, effect_for},
};

/// Encode a `RenderJob` to MP4 on the current thread.
/// Streams `render_progress` (0–100) and `log` events via `app`.
pub fn encode_blocking(
    app: AppHandle,
    ffmpeg: PathBuf,
    job: RenderJob,
) -> Result<PathBuf, AppError> {
    emit_log(&app, format!("FFmpeg: {}", ffmpeg.display()));

    // ── Stage 1a: Audio metadata ──────────────────────────────────────────────
    let duration = audio_duration(&ffmpeg, &job.audio_path);
    if duration <= 0.0 {
        return Err(AppError::Encode("Could not determine audio duration".into()));
    }
    let total_frames = (duration * job.fps as f64).ceil() as usize;
    emit_log(&app, format!(
        "Audio: {:.1}s → {} frames @ {} fps",
        duration, total_frames, job.fps
    ));

    let w = job.width  as usize;
    let h = job.height as usize;
    let is_eq = effect_for(&job.wave_style).needs_spectrum();

    // ── Stage 1b: FFT spectrum (only for "eq" style) ──────────────────────────
    // Uses decode_pcm_hound: FFmpeg → 16kHz WAV on disk → hound read → Vec<f32>
    // Avoids the 230 MB double-buffer that pipe-based decode_pcm caused.
    let (fft_peaks, fft_n_buckets): (Vec<f32>, usize) = if is_eq {
        emit_log(&app, "Analyzing spectrum (FFT)…");
        match decode_pcm_hound(&ffmpeg, &job.audio_path) {
            Ok(pcm) => {
                let r = compute_spectrum(&pcm, 16_000, EQ_BPS);
                emit_log(&app, format!(
                    "Spectrum: {} buckets × {} bands", r.n_buckets, r.n_bands
                ));
                let n = r.n_buckets;
                (r.bands, n)
            }
            Err(e) => {
                emit_log(&app, format!("Spectrum decode failed, using simulation: {e}"));
                (vec![], 0)
            }
        }
    } else {
        (vec![], 0)
    };

    // ── Stage 1c: EQ state chain (sequential — each frame depends on previous) ─
    // We pre-compute the EMA-smoothed snapshot for every frame upfront.
    // This sequential pass is cheap (~40 multiplies × total_frames).
    // Storing all snapshots unlocks fully parallel rendering in Stage 2.
    emit_log(&app, "Pre-computing EQ state chain…");
    let eq_snapshots: Vec<Vec<f32>> = if is_eq {
        let mut state = vec![0f32; EQ_BANDS];
        (0..total_frames)
            .map(|fi| {
                let t_sec = fi as f64 / job.fps as f64;
                advance_eq_state(
                    &mut state, &fft_peaks, fft_n_buckets,
                    &job.peaks, t_sec, duration,
                );
                state.clone()
            })
            .collect()
    } else {
        vec![]
    };

    // ── Stage 1d: Frame LUTs ──────────────────────────────────────────────────
    // Pre-compute per-pixel constants that are identical for every frame:
    //   • vignette_rows  — bg colour × keep factor per row  (eliminates f32 math in fill pass)
    //   • fullbg_alpha   — radial gradient √ per pixel      (eliminates sqrt in fullbg layout)
    //   • karaoke_alpha  — radial gradient √ per pixel      (eliminates sqrt in karaoke layout)
    emit_log(&app, "Building frame LUTs…");
    let luts = compute_frame_luts(w, h, job.bg_color, &job.layout);

    // ── Stage 1e: Spawn FFmpeg subprocess ─────────────────────────────────────
    let final_out = PathBuf::from(&job.output_path);
    if let Some(p) = final_out.parent() { let _ = fs::create_dir_all(p); }
    let tmp_out = std::env::temp_dir()
        .join(format!(".audiogram-{}.mp4", std::process::id()));

    let fc = build_filter_complex(&job, w, h);

    let mut child = Command::new(&ffmpeg)
        .args(["-y", "-f", "rawvideo", "-pixel_format", "rgba"])
        .args(["-video_size", &format!("{}x{}", job.width, job.height)])
        .args(["-r", &job.fps.to_string(), "-i", "pipe:0"])
        .args(["-i", &job.audio_path])
        .args(["-filter_complex", &fc])
        .args(["-map", "[vout]", "-map", "1:a"])
        .args(["-c:v", "libx264", "-preset", "veryfast", "-crf", "18"])
        .args(["-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k"])
        .args(["-movflags", "+faststart", "-shortest"])
        .arg(&tmp_out)
        .stdin(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| AppError::Encode(format!("spawn ffmpeg: {e}")))?;

    let app_log = app.clone();
    if let Some(stderr) = child.stderr.take() {
        thread::spawn(move || {
            for line in BufReader::new(stderr).lines().flatten() {
                let _ = app_log.emit("log", format!("[ffmpeg] {line}"));
            }
        });
    }

    // ── Stage 2 + 3: Parallel render → sequential stream write ───────────────
    //
    // Batch size = number of rayon worker threads (≈ CPU logical cores).
    // Memory per batch: batch_size × w × h × 4 bytes
    //   e.g. 8 threads × 1080p = 8 × 8.3 MB = 66 MB peak
    //
    // rayon's IndexedParallelIterator::collect() preserves order, so
    // `frames[i]` corresponds to frame `batch_start + i` — no sort needed.
    {
        let mut stdin = child.stdin.take()
            .ok_or_else(|| AppError::Encode("no ffmpeg stdin".into()))?;

        let batch_size    = rayon::current_num_threads().max(4);
        let progress_step = (total_frames / 100).max(1);
        let empty_eq: Vec<f32> = vec![];

        // Shared references — safe to access from parallel threads
        let peaks_ref      = job.peaks.as_slice();
        let fft_peaks_ref  = fft_peaks.as_slice();
        let wave_style_ref = job.wave_style.as_str();
        let layout_ref     = job.layout.as_str();

        for batch_start in (0..total_frames).step_by(batch_size) {
            let batch_end = (batch_start + batch_size).min(total_frames);

            // Stage 2: render batch in parallel ────────────────────────────────
            let frames: Vec<Vec<u8>> = (batch_start..batch_end)
                .into_par_iter()
                .map(|fi| {
                    let t_sec    = fi as f64 / job.fps as f64;
                    let eq_snap  = if is_eq { eq_snapshots[fi].as_slice() } else { &empty_eq };
                    render_frame(
                        w, h, peaks_ref, job.wave_color,
                        wave_style_ref, t_sec, duration, layout_ref,
                        eq_snap, fft_peaks_ref, fft_n_buckets,
                        &luts,
                    )
                })
                .collect(); // order preserved (IndexedParallelIterator)

            // Stage 3: write batch to FFmpeg stdin in frame order ───────────────
            for (i, frame) in frames.iter().enumerate() {
                let fi = batch_start + i;
                stdin.write_all(frame)
                    .map_err(|e| AppError::Encode(format!("write frame {fi}: {e}")))?;
                if fi % progress_step == 0 {
                    let _ = app.emit(
                        "render_progress",
                        ((fi + 1) * 99 / total_frames) as u8,
                    );
                }
            }
        }
    } // stdin dropped here → signals EOF to FFmpeg

    let status = child.wait()
        .map_err(|e| AppError::Encode(format!("ffmpeg wait: {e}")))?;
    if !status.success() {
        return Err(AppError::Encode("FFmpeg encoding failed".into()));
    }

    if fs::rename(&tmp_out, &final_out).is_err() {
        fs::copy(&tmp_out, &final_out)
            .map_err(|e| AppError::Encode(format!("copy to output: {e}")))?;
        let _ = fs::remove_file(&tmp_out);
    }

    let _ = app.emit("render_progress", 100u8);
    emit_log(&app, "Done!");
    Ok(final_out)
}

// ── FFmpeg filter graph ───────────────────────────────────────────────────────

fn build_filter_complex(job: &RenderJob, w: usize, h: usize) -> String {
    let font     = &job.font_name;
    let fs_scale = job.font_size_pct as f64 / 100.0;
    let base_fs  = (h as f64 * 0.058 * fs_scale).round() as u32;
    let line_gap = (base_fs as f64 * 1.4).round() as u32;
    let layout   = job.layout.as_str();

    let mut fc = "[0:v]".to_string();
    let mut vi = 0usize;

    if let Some(title) = job.title.as_deref().filter(|t| !t.is_empty()) {
        let lines    = wrap_text_2lines(title, 30);
        let total_h  = lines.len() as u32 * line_gap;
        let center_y = match layout {
            "spotify" => (h as f64 * 0.50).round() as u32,
            "split"   => (h as f64 * 0.22).round() as u32,
            "fullbg"  => (h as f64 * 0.42).round() as u32,
            "karaoke" => 0,
            "brand"   => (h as f64 * 0.44).round() as u32,
            _         => (h as f64 * 0.13).round() as u32,
        };

        if layout != "karaoke" && center_y > 0 {
            let start_y = center_y.saturating_sub(total_h / 2);
            let x_expr  = match layout {
                "split" => format!("{w}/2+(w/2-text_w)/2"),
                "brand" => {
                    let av_r  = ((h as f64 * 0.14).min(w as f64 * 0.09)).round() as u32;
                    let info_x = (w as f64 * 0.12).round() as u32 + av_r + (w as f64 * 0.04).round() as u32;
                    format!("{info_x}")
                }
                _ => "(w-text_w)/2".to_string(),
            };
            for (i, line) in lines.iter().enumerate() {
                let t = escape_drawtext(line);
                let y = start_y + i as u32 * line_gap;
                vi += 1;
                fc.push_str(&format!(
                    "drawtext=text='{t}':font='{font}':fontcolor=white@0.95\
                    :fontsize={base_fs}:x={x_expr}:y={y}:enable='gt(t\\,0)'[v{vi}];\
                    [v{vi}]"
                ));
            }
        }
    }

    if let Some(srt) = job.captions_path.as_deref().filter(|p| !p.is_empty()) {
        if Path::new(srt).exists() {
            vi += 1;
            fc.push_str(&format!("ass='{}'[v{vi}];\n[v{vi}]", escape_drawtext(srt)));
        }
    }

    fc.push_str("format=yuv420p[vout]");
    fc
}
