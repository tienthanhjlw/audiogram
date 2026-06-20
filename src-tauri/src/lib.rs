use serde::{Deserialize, Serialize};
use std::{
  env,
  fs,
  io::{BufRead, BufReader, Write},
  path::{Path, PathBuf},
  process::{Command, Stdio},
  thread,
};
use tauri::{AppHandle, Emitter, Manager};
use tauri::menu::{Menu, MenuItem};

#[derive(Deserialize, Debug)]
struct RenderParams {
  audio_path: String,
  /// Per-bar peak amplitudes (0.0–1.0), decoded from audio in the frontend.
  peaks: Vec<f32>,
  bg_color: String,
  captions_path: Option<String>,
  width: u32,
  height: u32,
  fps: u32,
  wave_color: String,
  wave_style: String,
  intro_title: Option<String>,
  intro_duration: Option<u32>,
  /// Font size percentage multiplier (70–140), default 100.
  font_size: Option<u32>,
  /// Font family name, e.g. "Arial", "Georgia", "Impact", "Verdana".
  font_name: Option<String>,
  output_path: String,
}

/// Escape special characters for FFmpeg drawtext filter values.
fn escape_drawtext(s: &str) -> String {
  let mut r = String::with_capacity(s.len() + 4);
  for c in s.chars() {
    match c {
      '\\' => r.push_str("\\\\"),
      '\'' => r.push_str("\\'"),
      ':'  => r.push_str("\\:"),
      '['  => r.push_str("\\["),
      ']'  => r.push_str("\\]"),
      _    => r.push(c),
    }
  }
  r
}

/// Wrap `text` into at most 2 lines of `max_chars` characters each.
fn wrap_text_2lines(text: &str, max_chars: usize) -> Vec<String> {
  let chars: Vec<char> = text.chars().collect();
  if chars.len() <= max_chars {
    return vec![text.to_string()];
  }
  // Walk back from max_chars to find a word boundary
  let mut split = max_chars.min(chars.len());
  while split > 0 && chars[split - 1] != ' ' {
    split -= 1;
  }
  if split == 0 { split = max_chars.min(chars.len()); }
  let line1: String = chars[..split].iter().collect::<String>().trim().to_string();
  let line2: String = chars[split..].iter().collect::<String>().trim().to_string();
  if line2.is_empty() { vec![line1] } else { vec![line1, line2] }
}

/// Wrap a subtitle text line into at most 2 lines for SRT.
fn wrap_srt_line(text: &str) -> String {
  let lines = wrap_text_2lines(text, 42);
  lines.join("\n")
}

// ── Pixel helpers ─────────────────────────────────────────

fn hex_to_rgb(hex: &str) -> [u8; 3] {
  let h = hex.trim().trim_start_matches('#');
  let n = u32::from_str_radix(h, 16).unwrap_or(0);
  [((n >> 16) & 0xFF) as u8, ((n >> 8) & 0xFF) as u8, (n & 0xFF) as u8]
}

/// Alpha-blend `rgb` over the pixel at `idx` in the RGBA buffer.
#[inline]
fn blend(px: &mut [u8], idx: usize, rgb: [u8; 3], a: f32) {
  let ia = 1.0 - a;
  px[idx]   = (px[idx]   as f32 * ia + rgb[0] as f32 * a) as u8;
  px[idx+1] = (px[idx+1] as f32 * ia + rgb[1] as f32 * a) as u8;
  px[idx+2] = (px[idx+2] as f32 * ia + rgb[2] as f32 * a) as u8;
}

/// Render one RGBA frame that exactly mirrors WaveformCanvas.tsx logic.
/// `t` matches the Canvas `ts / 1200` time parameter.
fn render_frame(w: usize, h: usize, peaks: &[f32],
                bg: [u8; 3], wc: [u8; 3], style: &str, t: f64) -> Vec<u8> {
  let mut px = vec![0u8; w * h * 4];

  // Background fill
  for c in px.chunks_exact_mut(4) {
    c[0] = bg[0]; c[1] = bg[1]; c[2] = bg[2]; c[3] = 255;
  }

  // Gradient overlay: darkens bg from 25% at top to 55% at bottom
  for y in 0..h {
    let dark = (0.25 + 0.30 * y as f32 / h as f32).clamp(0.0, 1.0);
    let keep = 1.0 - dark;
    let row  = y * w;
    for x in 0..w {
      let i = (row + x) * 4;
      px[i]   = (px[i]   as f32 * keep) as u8;
      px[i+1] = (px[i+1] as f32 * keep) as u8;
      px[i+2] = (px[i+2] as f32 * keep) as u8;
    }
  }

  let n = peaks.len();
  if n == 0 { return px; }

  // Match Canvas layout: waveform in middle 52% of height, starting at 24%
  let wave_area_h = h as f32 * 0.52;
  let wave_y      = h as f32 * 0.24;

  match style {
    "line" => {
      let pts: Vec<(i32, i32)> = (0..n).map(|i| {
        let anim = peaks[i] as f64 * (0.78 + 0.22 * (t * 1.6 + i as f64 * 0.28).sin());
        let x = (i as f64 / (n - 1).max(1) as f64 * w as f64) as i32;
        let y = (wave_y as f64 + wave_area_h as f64 / 2.0 - anim * wave_area_h as f64 / 2.0) as i32;
        (x, y)
      }).collect();
      for seg in pts.windows(2) {
        draw_thick_line(&mut px, w, h, seg[0].0, seg[0].1, seg[1].0, seg[1].1, wc, 2);
      }
    }
    "mirror" => {
      let bar_w = w as f32 * 0.64 / n as f32;
      let gap   = w as f32 * 0.36 / n as f32;
      let mid_y = wave_y + wave_area_h / 2.0;
      for (i, &p) in peaks.iter().enumerate() {
        let anim = p * (0.78 + 0.22 * (t * 1.6 + i as f64 * 0.28).sin() as f32);
        let half = (anim * wave_area_h / 2.0).max(3.0);
        let x0 = (i as f32 * (bar_w + gap)) as usize;
        let x1 = (x0 as f32 + bar_w).min(w as f32) as usize;
        let y0 = (mid_y - half).max(0.0) as usize;
        let y1 = (mid_y + half).min(h as f32 - 1.0) as usize;
        for y in y0..=y1 {
          // Gradient: bright at center, fade to ~19% at edges (matching color+'30')
          let tf = (y - y0) as f32 / (y1 - y0).max(1) as f32;
          let a  = 1.0 - (tf - 0.5).abs() * 2.0 * 0.81;
          for x in x0..x1 { blend(&mut px, (y * w + x) * 4, wc, a); }
        }
      }
    }
    _ => {  // "bar" (default)
      let bar_w = w as f32 * 0.64 / n as f32;
      let gap   = w as f32 * 0.36 / n as f32;
      let mid_y = wave_y + wave_area_h / 2.0;
      for (i, &p) in peaks.iter().enumerate() {
        let anim = p * (0.78 + 0.22 * (t * 1.6 + i as f64 * 0.28).sin() as f32);
        let bh   = (anim * wave_area_h).max(4.0);
        let x0 = (i as f32 * (bar_w + gap)) as usize;
        let x1 = (x0 as f32 + bar_w).min(w as f32) as usize;
        let y0 = (mid_y - bh / 2.0).max(0.0) as usize;
        let y1 = (mid_y + bh / 2.0).min(h as f32 - 1.0) as usize;
        for y in y0..=y1 {
          // Gradient: full alpha at top, ~33% at bottom (matching color+'FF' → color+'55')
          let tf = (y - y0) as f32 / (y1 - y0).max(1) as f32;
          let a  = 1.0 - tf * 0.67;
          for x in x0..x1 { blend(&mut px, (y * w + x) * 4, wc, a); }
        }
      }
    }
  }

  px
}

/// Bresenham thick line — used for "line" waveform style.
fn draw_thick_line(px: &mut [u8], w: usize, h: usize,
                   x0: i32, y0: i32, x1: i32, y1: i32, rgb: [u8; 3], r: i32) {
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
          let px2 = cx + tx; let py2 = cy + ty;
          if px2 >= 0 && px2 < w as i32 && py2 >= 0 && py2 < h as i32 {
            blend(px, (py2 as usize * w + px2 as usize) * 4, rgb, 1.0);
          }
        }
      }
    }
    if cx == x1 && cy == y1 { break; }
    let e2 = 2 * err;
    if e2 >= dy { err += dy; cx += sx; }
    if e2 <= dx { err += dx; cy += sy; }
  }
}

/// Probe audio duration in seconds using ffmpeg -i stderr output.
fn get_audio_duration(ffmpeg: &Path, audio_path: &str) -> f64 {
  let Ok(out) = Command::new(ffmpeg).arg("-i").arg(audio_path).output() else { return 0.0 };
  for line in String::from_utf8_lossy(&out.stderr).lines() {
    if let Some(pos) = line.find("Duration:") {
      let ts = line[pos + 9..].trim().split(',').next().unwrap_or("").trim();
      let p: Vec<&str> = ts.split(':').collect();
      if p.len() == 3 {
        let hh: f64 = p[0].parse().unwrap_or(0.0);
        let mm: f64 = p[1].parse().unwrap_or(0.0);
        let ss: f64 = p[2].parse().unwrap_or(0.0);
        return hh * 3600.0 + mm * 60.0 + ss;
      }
    }
  }
  0.0
}

#[tauri::command]
fn ping(name: String) -> String {
  format!("pong {}!", name)
}

fn emit_log(app: &AppHandle, msg: impl AsRef<str>) {
  let _ = app.emit("log", msg.as_ref().to_string());
}

#[cfg(unix)]
fn ensure_executable(p: &Path) -> Result<(), String> {
  use std::os::unix::fs::PermissionsExt;
  let meta = fs::metadata(p).map_err(|e| format!("ffmpeg metadata: {e}"))?;
  let mut perm = meta.permissions();
  let mode = perm.mode();
  if mode & 0o111 == 0 {
    perm.set_mode(mode | 0o755);
    fs::set_permissions(p, perm).map_err(|e| format!("chmod ffmpeg: {e}"))?;
  }
  Ok(())
}

#[cfg(not(unix))]
fn ensure_executable(_p: &Path) -> Result<(), String> { Ok(()) }

fn ffmpeg_path(app: &AppHandle) -> Result<PathBuf, String> {
  // Try multiple strategies to locate the bundled ffmpeg.
  let mut search_dirs: Vec<PathBuf> = Vec::new();

  // 0) Explicit override via env var
  if let Ok(override_path) = env::var("FFMPEG_PATH") {
    let p = PathBuf::from(&override_path);
    if p.exists() {
      emit_log(app, format!("Using FFmpeg from FFMPEG_PATH: {}", p.display()));
      return Ok(p);
    } else {
      emit_log(app, format!("FFMPEG_PATH set but not found: {}", p.display()));
    }
  }

  // 1) Look for ffmpeg on PATH
  if let Some(p) = find_in_path("ffmpeg") {
    emit_log(app, format!("Using FFmpeg from PATH: {}", p.display()));
    return Ok(p);
  }

  // 1) Current executable directory.
  if let Ok(exe) = std::env::current_exe() {
    if let Some(p) = exe.parent() { search_dirs.push(p.to_path_buf()); }
  }

  // 2) Tauri-reported executable_dir (may fail in dev on some platforms).
  if let Ok(dir) = app.path().executable_dir() { search_dirs.push(dir); }

  // 3) On macOS bundles: Contents/MacOS -> sibling Contents/Resources
  if let Some(mac_os_dir) = search_dirs.first() {
    if mac_os_dir.ends_with("MacOS") {
      if let Some(contents) = mac_os_dir.parent() {
        let resources = contents.join("Resources");
        search_dirs.push(resources);
      }
    }
  }

  // 4) Tauri resource_dir if available.
  if let Ok(res) = app.path().resource_dir() { search_dirs.push(res); }

  // Create candidate filenames for each directory.
  let triple = option_env!("TAURI_ENV_TARGET_TRIPLE");
  let mut tried: Vec<PathBuf> = Vec::new();
  for dir in search_dirs {
    // Prefer binaries/<os>/ffmpeg over a bare ffmpeg beside the executable
    let base_candidates = vec![
      dir.join("binaries").join("macos").join("ffmpeg"),
      dir.join("binaries").join("linux").join("ffmpeg"),
      dir.join("binaries").join("windows").join("ffmpeg.exe"),
      dir.join("ffmpeg"),
      dir.join("ffmpeg.exe"),
    ];
    for c in base_candidates {
      // 4a) Plain filename
      if c.exists() { ensure_executable(&c)?; return Ok(c); }
      tried.push(c.clone());

      // 4b) Suffixed with the target triple
      if let Some(t) = triple {
        let suffixed = if let Some(ext) = c.extension() {
          // insert -<triple> before extension
          let mut stem = c.file_stem().unwrap_or_default().to_os_string();
          stem.push(format!("-{}", t));
          c.with_file_name(stem).with_extension(ext)
        } else {
          let mut name = c.file_name().unwrap_or_default().to_os_string();
          name.push(format!("-{}", t));
          c.with_file_name(name)
        };
        if suffixed.exists() { ensure_executable(&suffixed)?; return Ok(suffixed); }
        tried.push(suffixed);
      }
    }
  }

  // Log searched paths for debugging.
  for p in tried.iter().take(10) { // limit spam
    emit_log(app, format!("Searched: {}", p.display()));
  }
  if tried.len() > 10 { emit_log(app, format!("... and {} more", tried.len() - 10)); }
  Err("Bundled ffmpeg not found".into())
}

fn find_in_path(bin: &str) -> Option<PathBuf> {
  let mut candidates: Vec<PathBuf> = Vec::new();
  if let Some(paths) = env::var_os("PATH") {
    for entry in env::split_paths(&paths) {
      let p = entry.join(bin);
      candidates.push(p.clone());
      #[cfg(windows)]
      {
        let pe = entry.join(format!("{}.exe", bin));
        candidates.push(pe);
      }
    }
  }
  // Common macOS Homebrew locations if PATH is restricted
  #[cfg(target_os = "macos")]
  {
    candidates.push(PathBuf::from("/opt/homebrew/bin").join(bin));
    candidates.push(PathBuf::from("/usr/local/bin").join(bin));
  }
  for c in candidates {
    if c.exists() {
      return Some(c);
    }
  }
  None
}

#[tauri::command]
fn render_audiogram(app: AppHandle, params: RenderParams) -> Result<String, String> {
  if !Path::new(&params.audio_path).exists() {
    return Err("Audio file not found".into());
  }
  if params.peaks.is_empty() {
    return Err("No waveform peaks provided — audio may not have loaded in the preview".into());
  }

  let ffmpeg = ffmpeg_path(&app)?;
  emit_log(&app, format!("FFmpeg: {}", ffmpeg.display()));

  let duration = get_audio_duration(&ffmpeg, &params.audio_path);
  if duration <= 0.0 {
    return Err("Could not determine audio duration".into());
  }
  let total_frames = (duration * params.fps as f64).ceil() as u64;
  emit_log(&app, format!("Audio: {:.1}s → {} frames @ {} fps", duration, total_frames, params.fps));

  let bg = hex_to_rgb(&params.bg_color);
  let wc = hex_to_rgb(&params.wave_color);
  let w  = params.width  as usize;
  let h  = params.height as usize;

  // Build filter_complex for title + subtitle overlays
  let font     = params.font_name.as_deref().unwrap_or("Arial");
  let fs_scale = params.font_size.unwrap_or(100) as f64 / 100.0;
  let base_fs  = (h as f64 * 0.058 * fs_scale).round() as u32;
  let line_gap = (base_fs as f64 * 1.4).round() as u32;

  let mut fc = "[0:v]".to_string();
  let mut vi = 0usize; // output label counter

  if let Some(ref title) = params.intro_title {
    if !title.is_empty() {
      let dur   = params.intro_duration.unwrap_or(3).max(1).min(15);
      let lines = wrap_text_2lines(title, 30);
      let total_h = lines.len() as u32 * line_gap;
      // Center block around 11% from top
      let center_y = (h as f64 * 0.11).round() as u32;
      let start_y  = center_y.saturating_sub(total_h / 2);

      for (i, line) in lines.iter().enumerate() {
        let t = escape_drawtext(line);
        let y = start_y + i as u32 * line_gap;
        vi += 1;
        fc.push_str(&format!(
          "drawtext=text='{t}':font='{font}':fontcolor=white@0.95\
          :fontsize={base_fs}:x=(w-text_w)/2:y={y}\
          :enable='lt(t\\,{dur})'[v{vi}];\
          [v{vi}]"
        ));
      }
    }
  }

  if let Some(ref srt) = params.captions_path {
    if !srt.is_empty() && Path::new(srt).exists() {
      let esc = escape_drawtext(srt);
      vi += 1;
      if srt.ends_with(".ass") {
        // ASS file has its own style (karaoke colours embedded)
        fc.push_str(&format!("ass='{esc}'[v{vi}];\n[v{vi}]"));
      } else {
        let sub_fs = (base_fs as f64 * 0.80).round() as u32;
        fc.push_str(&format!(
          "subtitles='{esc}':force_style=\
          'FontName={font},FontSize={sub_fs},\
          PrimaryColour=&H00FFFFFF&,OutlineColour=&H00000000&,\
          Outline=2,Shadow=1,MarginV=65'[v{vi}];\n[v{vi}]"
        ));
      }
    }
  }

  fc.push_str("format=yuv420p[vout]");

  // Temp output path
  let final_out = PathBuf::from(&params.output_path);
  if let Some(p) = final_out.parent() { let _ = fs::create_dir_all(p); }
  let tmp_out = std::env::temp_dir()
    .join(format!(".audiogram-{}.mp4", std::process::id()));

  // Spawn FFmpeg reading raw RGBA frames from stdin
  let mut child = Command::new(&ffmpeg)
    .arg("-y")
    .arg("-f").arg("rawvideo")
    .arg("-pixel_format").arg("rgba")
    .arg("-video_size").arg(format!("{}x{}", params.width, params.height))
    .arg("-r").arg(params.fps.to_string())
    .arg("-i").arg("pipe:0")
    .arg("-i").arg(&params.audio_path)
    .arg("-filter_complex").arg(&fc)
    .arg("-map").arg("[vout]")
    .arg("-map").arg("1:a")
    .arg("-c:v").arg("libx264").arg("-preset").arg("veryfast").arg("-crf").arg("18")
    .arg("-pix_fmt").arg("yuv420p")
    .arg("-c:a").arg("aac").arg("-b:a").arg("192k")
    .arg("-movflags").arg("+faststart")
    .arg("-shortest")
    .arg(&tmp_out)
    .stdin(Stdio::piped())
    .stderr(Stdio::piped())
    .spawn()
    .map_err(|e| format!("spawn ffmpeg: {e}"))?;

  // Log FFmpeg stderr in background
  let app2 = app.clone();
  if let Some(stderr) = child.stderr.take() {
    thread::spawn(move || {
      for line in BufReader::new(stderr).lines().flatten() {
        let _ = app2.emit("log", format!("[ffmpeg] {line}"));
      }
    });
  }

  // Generate and pipe frames — matches WaveformCanvas animation exactly
  {
    let mut stdin = child.stdin.take().ok_or("no ffmpeg stdin")?;
    let peaks  = &params.peaks;
    let style  = params.wave_style.as_str();
    let report_every = (params.fps as u64 * 5).max(1);

    for fi in 0..total_frames {
      // t mirrors canvas: ts_ms / 1200, where ts_ms = fi * (1000 / fps)
      let t = fi as f64 * 1000.0 / params.fps as f64 / 1200.0;
      let frame = render_frame(w, h, peaks, bg, wc, style, t);
      stdin.write_all(&frame).map_err(|e| format!("write frame {fi}: {e}"))?;
      if fi % report_every == 0 {
        emit_log(&app, format!("Encoding {:.0}s / {:.0}s…",
          fi as f64 / params.fps as f64, duration));
      }
    }
  } // closes stdin → signals EOF to FFmpeg

  let status = child.wait().map_err(|e| format!("ffmpeg wait: {e}"))?;
  if !status.success() {
    return Err("FFmpeg encoding failed".into());
  }

  // Move temp → final
  match fs::rename(&tmp_out, &final_out) {
    Ok(_) => {}
    Err(_) => {
      fs::copy(&tmp_out, &final_out).map_err(|e| format!("copy to output: {e}"))?;
      let _ = fs::remove_file(&tmp_out);
    }
  }

  emit_log(&app, "Done!");
  Ok(final_out.to_string_lossy().to_string())
}

#[tauri::command]
fn resolve_ffmpeg_path(app: AppHandle) -> Result<String, String> {
  let p = ffmpeg_path(&app)?;
  emit_log(&app, format!("FFmpeg path: {}", p.display()));
  Ok(p.to_string_lossy().to_string())
}

#[tauri::command]
fn open_folder(_app: AppHandle, path: String) -> Result<(), String> {
  #[cfg(target_os = "macos")]
  {
    Command::new("open").arg(path).spawn().map_err(|e| e.to_string())?;
    return Ok(());
  }
  #[cfg(target_os = "windows")]
  {
    Command::new("explorer.exe").arg(path).spawn().map_err(|e| e.to_string())?;
    return Ok(());
  }
  #[cfg(target_os = "linux")]
  {
    Command::new("xdg-open").arg(path).spawn().map_err(|e| e.to_string())?;
    return Ok(());
  }
  #[allow(unreachable_code)]
  Err("unsupported platform".into())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  // Build a simple top-level menu with one action.
  let mut builder = tauri::Builder::default();
  builder = builder.menu(|app| {
    let menu = Menu::new(app)?;
    let item = MenuItem::with_id(app, "show_ffmpeg", "Show FFmpeg Path", true, Option::<&str>::None)?;
    menu.append(&item)?;
    Ok(menu)
  }).on_menu_event(|app, event| {
    if event.id().as_ref() == "show_ffmpeg" {
      // Resolve and emit path to logs
      match ffmpeg_path(app) {
        Ok(p) => {
          let _ = app.emit("log", format!("FFmpeg path: {}", p.display()));
        }
        Err(e) => {
          let _ = app.emit("log", format!("FFmpeg resolve error: {}", e));
        }
      }
    }
  });

  builder
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_opener::init())
    .invoke_handler(tauri::generate_handler![
      ping, render_audiogram, resolve_ffmpeg_path, open_folder,
      transcribe_audio, write_srt, write_ass
    ])
    .setup(|app| {
      seed_bundled_model(app.handle());
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

// ─────────────────────────────────────────────────────────
// WHISPER TRANSCRIPTION
// Binary and model are bundled inside the app — no external deps.
// ─────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Segment {
  pub id: usize,
  pub start: f64,
  pub end: f64,
  pub text: String,
}

/// Locate the bundled whisper-cpp sidecar binary.
fn whisper_path(app: &AppHandle) -> Option<PathBuf> {
  let triple = option_env!("TAURI_ENV_TARGET_TRIPLE");
  let mut dirs: Vec<PathBuf> = Vec::new();
  if let Ok(exe) = std::env::current_exe() {
    if let Some(d) = exe.parent() { dirs.push(d.to_path_buf()); }
  }
  if let Ok(d) = app.path().executable_dir() { dirs.push(d); }

  for dir in &dirs {
    let base = dir.join("whisper-cpp");
    // Try triple-suffixed first (Tauri convention), then plain name
    if let Some(t) = triple {
      let suffixed = base.with_file_name(format!("whisper-cpp-{t}"));
      if suffixed.exists() { let _ = ensure_executable(&suffixed); return Some(suffixed); }
    }
    if base.exists() { let _ = ensure_executable(&base); return Some(base); }
  }
  None
}

/// Locate the bundled ggml-base.bin model (resource_dir → app_data_dir).
fn bundled_model(app: &AppHandle) -> Option<PathBuf> {
  // resource_dir: inside .app bundle at runtime
  if let Ok(res) = app.path().resource_dir() {
    let p = res.join("models").join("ggml-base.bin");
    if p.exists() { return Some(p); }
  }
  // app_data_dir: seeded on first launch from resource_dir
  if let Ok(data) = app.path().app_data_dir() {
    let p = data.join("models").join("ggml-base.bin");
    if p.exists() { return Some(p); }
  }
  None
}

/// On first launch, copy the bundled model from Resources into app_data_dir
/// so it remains accessible even if resource_dir path changes across updates.
fn seed_bundled_model(app: &AppHandle) {
  let Ok(res) = app.path().resource_dir() else { return };
  let Ok(data) = app.path().app_data_dir() else { return };
  let src = res.join("models").join("ggml-base.bin");
  let dst_dir = data.join("models");
  let dst = dst_dir.join("ggml-base.bin");
  if src.exists() && !dst.exists() {
    let _ = fs::create_dir_all(&dst_dir);
    if let Err(e) = fs::copy(&src, &dst) {
      let _ = app.emit("log", format!("[setup] model seed failed: {e}"));
    }
  }
}

/// Transcribe audio using the bundled whisper-cpp binary and base model.
/// Returns timestamped segments for the user to review/edit.
#[tauri::command]
fn transcribe_audio(app: AppHandle, audio_path: String) -> Result<Vec<Segment>, String> {
  emit_log(&app, "Transcribing…");

  let bin = whisper_path(&app)
    .ok_or("Whisper binary not found inside app bundle")?;
  let model = bundled_model(&app)
    .ok_or("Whisper model not found inside app bundle")?;

  emit_log(&app, format!("bin   : {}", bin.display()));
  emit_log(&app, format!("model : {}", model.display()));

  let tmp_dir = std::env::temp_dir().join("audiogram_whisper");
  fs::create_dir_all(&tmp_dir).map_err(|e| format!("mkdir tmp: {e}"))?;

  let wav_path = convert_to_wav_if_needed(&app, &audio_path, &tmp_dir)?;

  let stem = Path::new(&audio_path)
    .file_stem().and_then(|s| s.to_str()).unwrap_or("audio").to_string();
  let out_prefix = tmp_dir.join(&stem);

  let mut child = Command::new(&bin)
    .arg("-m").arg(&model)
    .arg("-f").arg(&wav_path)
    .arg("--output-json")
    .arg("-of").arg(&out_prefix)
    .arg("-t").arg("4")
    .stderr(Stdio::piped())
    .stdout(Stdio::piped())
    .spawn()
    .map_err(|e| format!("spawn whisper: {e}"))?;

  let app2 = app.clone();
  let stderr = child.stderr.take().map(BufReader::new);
  thread::spawn(move || {
    if let Some(r) = stderr {
      for line in r.lines().flatten() {
        let _ = app2.emit("log", format!("[whisper] {line}"));
      }
    }
  });

  let status = child.wait().map_err(|e| format!("whisper wait: {e}"))?;
  if !status.success() {
    return Err(format!("whisper-cpp exited with code: {status}"));
  }

  let json_path = tmp_dir.join(format!("{stem}.json"));
  let json_str = fs::read_to_string(&json_path)
    .map_err(|e| format!("read json: {e}"))?;

  let parsed: serde_json::Value = serde_json::from_str(&json_str)
    .map_err(|e| format!("parse json: {e}"))?;

  let raw = parsed["transcription"].as_array().cloned()
    .or_else(|| parsed["segments"].as_array().cloned())
    .unwrap_or_default();

  let segments: Vec<Segment> = raw.iter().enumerate()
    .map(|(i, s)| {
      if s.get("offsets").is_some() {
        Segment {
          id: i,
          start: s["offsets"]["from"].as_f64().unwrap_or(0.0) / 1000.0,
          end:   s["offsets"]["to"].as_f64().unwrap_or(0.0)   / 1000.0,
          text:  s["text"].as_str().unwrap_or("").trim().to_string(),
        }
      } else {
        Segment {
          id: i,
          start: s["start"].as_f64().unwrap_or(0.0),
          end:   s["end"].as_f64().unwrap_or(0.0),
          text:  s["text"].as_str().unwrap_or("").trim().to_string(),
        }
      }
    })
    .filter(|s| !s.text.is_empty())
    .collect();

  emit_log(&app, format!("Done — {} segments", segments.len()));
  Ok(segments)
}

/// Write segments to an SRT file, return its path.
#[tauri::command]
fn write_srt(segments: Vec<Segment>) -> Result<String, String> {
  let tmp = std::env::temp_dir().join("audiogram_whisper").join("subtitles.srt");
  fs::create_dir_all(tmp.parent().unwrap()).ok();
  let mut out = String::new();
  for seg in &segments {
    out.push_str(&format!(
      "{}\n{} --> {}\n{}\n\n",
      seg.id + 1,
      format_srt_time(seg.start),
      format_srt_time(seg.end),
      wrap_srt_line(seg.text.trim()),
    ));
  }
  fs::write(&tmp, out).map_err(|e| format!("write srt: {e}"))?;
  Ok(tmp.to_string_lossy().to_string())
}

/// Write ASS subtitle file with karaoke `\kf` sweep effect.
/// Secondary colour = dim white (unlit), Primary colour = highlight colour (lit).
#[tauri::command]
fn write_ass(segments: Vec<Segment>, highlight_color: String) -> Result<String, String> {
  let tmp = std::env::temp_dir().join("audiogram_whisper").join("subtitles.ass");
  fs::create_dir_all(tmp.parent().unwrap()).ok();

  // Convert #RRGGBB → ASS &H00BBGGRR
  let rgb = hex_to_rgb(&highlight_color);
  let ass_primary   = format!("&H00{:02X}{:02X}{:02X}", rgb[2], rgb[1], rgb[0]);
  let ass_secondary = "&H60FFFFFF".to_string(); // semi-transparent white (unlit state)

  let mut out = String::new();
  out.push_str("[Script Info]\nScriptType: v4.00+\nWrapStyle: 0\nScaledBorderAndShadow: yes\n\n");
  out.push_str("[V4+ Styles]\n");
  out.push_str("Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n");
  out.push_str(&format!(
    "Style: Default,Arial,28,{},{},&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,2.5,1,2,10,10,65,1\n\n",
    ass_primary, ass_secondary
  ));
  out.push_str("[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n");

  for seg in &segments {
    let words: Vec<&str> = seg.text.split_whitespace().collect();
    if words.is_empty() { continue; }
    let seg_dur = (seg.end - seg.start).max(0.1);
    let word_cs = ((seg_dur / words.len() as f64) * 100.0).round() as u32;

    let karaoke: String = words.iter()
      .map(|w| format!("{{\\kf{}}}{} ", word_cs, w))
      .collect::<String>();

    out.push_str(&format!(
      "Dialogue: 0,{},{},Default,,0,0,0,,{}\n",
      format_ass_time(seg.start),
      format_ass_time(seg.end),
      karaoke.trim_end(),
    ));
  }

  fs::write(&tmp, out).map_err(|e| format!("write ass: {e}"))?;
  Ok(tmp.to_string_lossy().to_string())
}

fn format_ass_time(secs: f64) -> String {
  let h = (secs / 3600.0) as u64;
  let m = ((secs % 3600.0) / 60.0) as u64;
  let s = (secs % 60.0) as u64;
  let cs = ((secs % 1.0) * 100.0) as u64;
  format!("{h}:{m:02}:{s:02}.{cs:02}")
}

fn format_srt_time(secs: f64) -> String {
  let h = (secs / 3600.0) as u64;
  let m = ((secs % 3600.0) / 60.0) as u64;
  let s = (secs % 60.0) as u64;
  let ms = ((secs % 1.0) * 1000.0) as u64;
  format!("{h:02}:{m:02}:{s:02},{ms:03}")
}

/// Convert audio to 16kHz mono WAV (required by whisper.cpp).
fn convert_to_wav_if_needed(
  app: &AppHandle,
  audio_path: &str,
  tmp_dir: &Path,
) -> Result<String, String> {
  if audio_path.to_lowercase().ends_with(".wav") {
    return Ok(audio_path.to_string());
  }
  let out = tmp_dir.join("whisper_input.wav");
  emit_log(app, "⚙️  Converting audio to 16kHz WAV…");
  let ff = ffmpeg_path(app)?;
  let status = Command::new(ff)
    .args(["-y", "-i", audio_path,
           "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le"])
    .arg(out.to_string_lossy().as_ref())
    .status()
    .map_err(|e| format!("ffmpeg wav convert: {e}"))?;
  if !status.success() { return Err("WAV conversion failed".into()); }
  Ok(out.to_string_lossy().to_string())
}
