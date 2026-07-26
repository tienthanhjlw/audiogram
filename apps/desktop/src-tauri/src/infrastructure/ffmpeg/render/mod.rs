/// Video encoding pipeline — 3-stage architecture:
///
///   Stage 1 — Pre-compute  (sequential, fast)
///     • audio duration probe
///     • FFT spectrum decode   (EQ style only)
///     • EQ EMA state chain    (sequential invariant → flat Vec<f32> snapshot table)
///     • frame LUTs            (vignette rows, radial gradient alpha maps)
///
///   Stage 2 — Parallel render  (rayon thread pool, CPU-bound)
///     • frames in each batch rendered concurrently into a pre-allocated flat buffer
///     • buffer is reused across batches — zero per-frame heap allocation
///
///   Stage 3 — Stream write  (sequential, I/O-bound)
///     • frames written to FFmpeg stdin in order while FFmpeg encodes concurrently
///
/// The pure rasterizer (frame/wave/pixel) lives in the `audiogram-render`
/// crate (T16) — this module owns everything Tauri/ffmpeg-process-specific:
/// spawning/managing the ffmpeg subprocess and reporting progress through a
/// `TauriSink` (below) instead of scattering raw `AppHandle::emit` calls
/// through the render loop.
use std::{
    fs,
    io::{BufRead, BufReader, Write},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::{atomic::{AtomicBool, Ordering}, Arc},
    thread,
};
use rayon::prelude::*;
use tauri::{AppHandle, Emitter};

use audiogram_core::util::{escape_drawtext, wrap_text_2lines};
use audiogram_render::{
    frame::{compute_frame_luts, render_frame_into},
    wave::{advance_eq_state, effect_for},
    ProgressSink,
};
use crate::{
    domain::entities::{Layout, RenderEvent, RenderJob, RenderStage, SerializableError},
    infrastructure::{
        ffmpeg::audio::{audio_duration, decode_pcm_hound},
        spectrum::rustfft::{compute_spectrum, EQ_BANDS, EQ_BPS},
    },
    shared::{util::emit_log, AppError},
};

/// Fans every `RenderEvent` out to the structured `render_event` channel
/// (TECH_ARCHITECTURE.md §2.3) and, for the 2 variants the pre-T16 pipeline
/// already put on a legacy channel, to `render_progress` too (T9 compat —
/// `emit_log`'s plain "log" channel is untouched below; `RenderEvent::Log`
/// was never emitted by this pipeline before T16 and still isn't, so this
/// doesn't create a duplicate "log" line for the same message).
#[derive(Clone)]
struct TauriSink(AppHandle);

impl ProgressSink for TauriSink {
    fn emit(&self, event: RenderEvent) {
        match &event {
            RenderEvent::Progress { pct, .. } => { let _ = self.0.emit("render_progress", *pct as u8); }
            RenderEvent::Done { .. } => { let _ = self.0.emit("render_progress", 100u8); }
            _ => {}
        }
        let _ = self.0.emit("render_event", event);
    }
}

/// Encode a `RenderJob` to MP4 on the current thread.
/// Streams `render_progress`/`log` (legacy) and `render_event`
/// (TECH_ARCHITECTURE.md §2.3) events via `app`. `cancel` is polled once per
/// batch (§4.2) — batch-granularity, not frame-granularity: the Stage 2
/// render loop is a rayon parallel iterator with no cheap per-frame
/// short-circuit, and a few frames' worth of extra latency (a handful of ms)
/// is not perceptible as "cancel didn't work" to a human clicking a button.
pub fn encode_blocking(
    app: AppHandle,
    ffmpeg: PathBuf,
    job: RenderJob,
    cancel: Arc<AtomicBool>,
) -> Result<PathBuf, AppError> {
    let sink = TauriSink(app.clone());
    emit_log(&app, format!("FFmpeg: {}", ffmpeg.display()));
    sink.emit(RenderEvent::Stage { stage: RenderStage::Preparing });

    // ── Stage 1a: Audio metadata ──────────────────────────────────────────────
    let duration = audio_duration(&ffmpeg, &job.audio_path);
    if duration <= 0.0 {
        return Err(AppError::Encode("Could not determine audio duration".into()));
    }
    let total_frames = (duration * job.fps as f64).ceil() as usize;
    emit_log(&app, format!(
        "Audio: {:.1}s → {} frames @ {} fps", duration, total_frames, job.fps
    ));

    // The .ass file itself was already written by the separate `write_ass`
    // command before this job started — this stage just marks "burning
    // captions into the video" as a conceptual step for the UI's benefit.
    if job.captions_path.is_some() {
        sink.emit(RenderEvent::Stage { stage: RenderStage::Captions });
    }

    let w = job.width  as usize;
    let h = job.height as usize;
    let is_eq = effect_for(job.wave_style).needs_spectrum();

    // ── Stage 1b: FFT spectrum (EQ style only) ────────────────────────────────
    let (fft_peaks, fft_n_buckets): (Vec<f32>, usize) = if is_eq {
        emit_log(&app, "Analyzing spectrum (FFT)…");
        match decode_pcm_hound(&ffmpeg, &job.audio_path) {
            Ok(pcm) => {
                let r = compute_spectrum(&pcm, 16_000, EQ_BPS);
                emit_log(&app, format!(
                    "Spectrum: {} buckets × {} bands", r.n_buckets, r.n_bands
                ));
                let n = r.n_buckets as usize;
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
    //
    // Pre-compute one EMA snapshot per frame so Stage 2 can render all frames
    // independently in parallel. Storage: flat Vec<f32> with stride EQ_BANDS —
    // one allocation, cache-friendly, no per-frame heap churn.
    let eq_snapshots: Vec<f32> = if is_eq {
        emit_log(&app, "Pre-computing EQ state chain…");
        let mut buf   = vec![0f32; total_frames * EQ_BANDS];
        let mut state = vec![0f32; EQ_BANDS];
        for fi in 0..total_frames {
            let t_sec = fi as f64 / job.fps as f64;
            advance_eq_state(&mut state, &fft_peaks, fft_n_buckets, &job.peaks, t_sec, duration);
            buf[fi * EQ_BANDS..(fi + 1) * EQ_BANDS].copy_from_slice(&state);
        }
        buf
    } else {
        vec![]
    };

    // ── Stage 1d: Frame LUTs ──────────────────────────────────────────────────
    emit_log(&app, "Building frame LUTs…");
    let luts = compute_frame_luts(w, h, job.bg_color, job.layout);

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

    sink.emit(RenderEvent::Stage { stage: RenderStage::Frames });

    // ── Stage 2 + 3: Parallel render → sequential stream write ───────────────
    //
    // One flat buffer is allocated before the loop and reused for every batch:
    //   batch_buf[i * frame_size .. (i+1) * frame_size]  = frame i in this batch
    //
    // render_frame_into writes every pixel, so no zeroing is needed between batches.
    // Memory: batch_size × w × h × 4  (e.g. 8 threads × 1080p ≈ 66 MB — constant).
    {
        let mut stdin = child.stdin.take()
            .ok_or_else(|| AppError::Encode("no ffmpeg stdin".into()))?;

        let batch_size    = rayon::current_num_threads().max(4);
        let frame_size    = w * h * 4;
        let progress_step = (total_frames / 100).max(1);
        let empty_eq      = &[][..];

        let mut batch_buf = vec![0u8; batch_size * frame_size];

        for batch_start in (0..total_frames).step_by(batch_size) {
            // Checked once per batch, not per frame — Stage 2 below is a
            // rayon parallel iterator with no cheap per-frame short-circuit,
            // and a few frames' worth of latency is imperceptible as "cancel
            // didn't work" (TECH_ARCHITECTURE.md §4.2).
            if cancel.load(Ordering::Relaxed) {
                drop(stdin);
                let _ = child.kill();
                let _ = child.wait();
                let _ = fs::remove_file(&tmp_out);
                sink.emit(RenderEvent::Failed {
                    error: SerializableError { kind: "cancelled".into(), message: "Cancelled".into() },
                });
                return Err(AppError::Cancelled);
            }

            let batch_len = (batch_start + batch_size).min(total_frames) - batch_start;

            // Stage 2: render each frame in the batch into its slice of batch_buf ─
            batch_buf[..batch_len * frame_size]
                .par_chunks_mut(frame_size)
                .enumerate()
                .for_each(|(i, frame)| {
                    let fi    = batch_start + i;
                    let t_sec = fi as f64 / job.fps as f64;
                    let eq_snap = if is_eq {
                        &eq_snapshots[fi * EQ_BANDS..(fi + 1) * EQ_BANDS]
                    } else {
                        empty_eq
                    };
                    render_frame_into(
                        frame, w, h,
                        &job.peaks, job.wave_color, job.wave_style, t_sec, duration,
                        job.layout, eq_snap, &fft_peaks, fft_n_buckets, &luts,
                    );
                });

            // Stage 3: write each frame to FFmpeg stdin in order ──────────────
            for i in 0..batch_len {
                let fi    = batch_start + i;
                let start = i * frame_size;
                stdin.write_all(&batch_buf[start..start + frame_size])
                    .map_err(|e| AppError::Encode(format!("write frame {fi}: {e}")))?;
                if fi % progress_step == 0 {
                    let pct = ((fi + 1) * 99 / total_frames) as u8;
                    sink.emit(RenderEvent::Progress {
                        pct: pct as f32,
                        frame: (fi + 1) as u32,
                        total: total_frames as u32,
                    });
                }
            }
        }
    } // stdin dropped here → EOF to FFmpeg

    sink.emit(RenderEvent::Stage { stage: RenderStage::Encoding });

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

    let output = final_out.to_string_lossy().to_string();
    sink.emit(RenderEvent::Done { output: output.clone() });
    emit_log(&app, "Done!");
    Ok(final_out)
}

// ── FFmpeg filter graph ───────────────────────────────────────────────────────

fn build_filter_complex(job: &RenderJob, w: usize, h: usize) -> String {
    let font     = &job.font_name;
    let fs_scale = job.font_size_pct as f64 / 100.0;
    let base_fs  = (h as f64 * 0.058 * fs_scale).round() as u32;
    let line_gap = (base_fs as f64 * 1.4).round() as u32;

    let mut fc = "[0:v]".to_string();
    let mut vi = 0usize;

    if let Some(title) = job.title.as_deref().filter(|t| !t.is_empty()) {
        // Karaoke layout uses large centred text drawn via ASS — skip drawtext title.
        let center_y: Option<u32> = match job.layout {
            Layout::Spotify => Some((h as f64 * 0.50).round() as u32),
            Layout::Split   => Some((h as f64 * 0.22).round() as u32),
            Layout::FullBg  => Some((h as f64 * 0.42).round() as u32),
            Layout::Brand   => Some((h as f64 * 0.44).round() as u32),
            Layout::Minimal => Some((h as f64 * 0.13).round() as u32),
            Layout::Karaoke => None, // handled by ASS overlay
        };

        if let Some(cy) = center_y {
            let lines   = wrap_text_2lines(title, 30);
            let total_h = lines.len() as u32 * line_gap;
            let start_y = cy.saturating_sub(total_h / 2);
            let x_expr  = match job.layout {
                Layout::Split => format!("{w}/2+(w/2-text_w)/2"),
                Layout::Brand => {
                    let av_r   = ((h as f64 * 0.14).min(w as f64 * 0.09)).round() as u32;
                    let info_x = (w as f64 * 0.12).round() as u32 + av_r
                               + (w as f64 * 0.04).round() as u32;
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
