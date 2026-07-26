//! Golden-frame parity guard (OPTIMIZATION_PLAN.md F2, "Đợt 1" — built ahead
//! of Phase 2's preview renderer rewrite so a drift in layout geometry or
//! waveform math has something other than eyeballs to be caught by).
//!
//! Renders every (layout × representative wave style × t) combination at a
//! fixed, deterministic input (canvas size, colors, peaks, EQ state chain)
//! and byte-compares the RGBA buffer against a PNG committed under
//! `tests/golden/`. This crate draws no text (title/subtitle burn-in are
//! ffmpeg drawtext/libass, outside `audiogram-render` — see
//! OPTIMIZATION_PLAN.md F1), so there is no font-rendering source of
//! cross-machine flakiness here: every pixel comes from fills, blends, and
//! analytic circle/gradient math, so an exact byte match is expected to
//! reproduce identically on any platform.
//!
//! **First run / intentional geometry change:** delete the golden PNG(s)
//! that should change (or the whole `tests/golden/` dir to reseed
//! everything), then run
//! `cargo test -p audiogram-render --test golden_frames`. Missing goldens
//! are generated rather than silently treated as a pass — the test still
//! fails on that run (with the list of newly-generated files) so a human
//! reviews the new PNG by eye before it's committed. Run again afterward to
//! confirm it now passes.
//!
//! **Mismatch:** a diff PNG (red = differing pixel, gray = matching context
//! from the actual frame) is written to `target/golden-diffs/<name>.png`.

use audiogram_core::entities::{Layout, WaveStyle};
use audiogram_render::frame::{compute_frame_luts, render_frame_into};
use audiogram_render::wave::advance_eq_state;
use audiogram_spectrum::EQ_BANDS;
use std::path::{Path, PathBuf};

const W: usize = 320;
const H: usize = 180;
const DUR: f64 = 10.0;
const BG: [u8; 3] = [0x11, 0x18, 0x27];
const WC: [u8; 3] = [0xFF, 0xFF, 0xFF];
const FPS: f64 = 30.0;

const LAYOUTS: [(Layout, &str); 6] = [
    (Layout::Spotify, "spotify"),
    (Layout::Split, "split"),
    (Layout::Minimal, "minimal"),
    (Layout::FullBg, "fullbg"),
    (Layout::Karaoke, "karaoke"),
    (Layout::Brand, "brand"),
];

// 3 representative styles rather than all 9 (OPTIMIZATION_PLAN.md 1.1):
// Bar (the plain/most common path), Eq (the only style with a sequential
// cross-frame state chain — advance_eq_state), Orb (a distinct circular
// geometry, unlike Bar/Eq's rectangular bars).
const STYLES: [(WaveStyle, &str); 3] = [
    (WaveStyle::Bar, "bar"),
    (WaveStyle::Eq, "eq"),
    (WaveStyle::Orb, "orb"),
];

const TIME_FRACTIONS: [(f64, &str); 3] = [(0.0, "t0"), (0.25, "t25"), (0.5, "t50")];

/// Deterministic fake amplitude envelope, same shape family as the
/// frontend's demo fallback waveform (WaveformCanvas.tsx's catch branch) —
/// reimplemented here rather than shared since this crate has no TS import.
fn fixed_peaks() -> Vec<f32> {
    (0..1200)
        .map(|i| {
            let i = i as f32;
            0.3 + 0.5 * (i * 0.12).sin().abs() * (0.6 + 0.4 * (i * 0.031).sin().abs())
        })
        .collect()
}

fn golden_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/golden")
}

fn diff_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../target/golden-diffs")
}

/// Renders one (layout, style, t_sec) case against the fixed input. For the
/// `eq` style, mirrors the app crate's sequential pre-pass
/// (infrastructure/ffmpeg/render/mod.rs's `eq_snapshots` loop) at a fixed
/// 30fps so the EMA state at `t_sec` is reproducible regardless of case
/// order — real FFT input is unavailable in this pure-crate test, so
/// `fft_n_buckets = 0` exercises `advance_eq_state`'s envelope-only
/// fallback branch (the same one a real render falls back to when FFmpeg's
/// PCM decode fails).
fn render_case(layout: Layout, style: WaveStyle, t_sec: f64, peaks: &[f32]) -> Vec<u8> {
    let luts = compute_frame_luts(W, H, BG, layout);
    let mut buf = vec![0u8; W * H * 4];

    let eq_snapshot = if style == WaveStyle::Eq {
        let mut state = vec![0f32; EQ_BANDS];
        let total_frames = ((t_sec * FPS).round() as usize) + 1;
        for fi in 0..total_frames {
            let ft = fi as f64 / FPS;
            advance_eq_state(&mut state, &[], 0, peaks, ft, DUR);
        }
        state
    } else {
        vec![]
    };

    render_frame_into(
        &mut buf, W, H,
        peaks, WC, style, t_sec, DUR,
        layout,
        &eq_snapshot, &[], 0,
        &luts,
        None,
    );
    buf
}

fn save_rgba_png(path: &Path, buf: &[u8]) {
    image::RgbaImage::from_raw(W as u32, H as u32, buf.to_vec())
        .expect("buffer size matches W*H*4")
        .save(path)
        .unwrap_or_else(|e| panic!("failed to write {}: {e}", path.display()));
}

fn save_diff_png(path: &Path, golden: &[u8], actual: &[u8]) {
    let mut out = vec![0u8; golden.len()];
    for i in (0..golden.len()).step_by(4) {
        if golden[i..i + 4] != actual[i..i + 4] {
            out[i] = 255;
            out[i + 1] = 0;
            out[i + 2] = 0;
            out[i + 3] = 255;
        } else {
            let gray = ((actual[i] as u32 + actual[i + 1] as u32 + actual[i + 2] as u32) / 3) as u8;
            out[i] = gray;
            out[i + 1] = gray;
            out[i + 2] = gray;
            out[i + 3] = 255;
        }
    }
    save_rgba_png(path, &out);
}

#[test]
fn golden_frames() {
    let peaks = fixed_peaks();
    std::fs::create_dir_all(golden_dir()).expect("create tests/golden");

    let mut generated = Vec::new();
    let mut mismatches = Vec::new();

    for (layout, layout_name) in LAYOUTS {
        for (style, style_name) in STYLES {
            for (frac, frac_name) in TIME_FRACTIONS {
                let t_sec = DUR * frac;
                let actual = render_case(layout, style, t_sec, &peaks);
                let name = format!("{layout_name}_{style_name}_{frac_name}.png");
                let path = golden_dir().join(&name);

                if !path.exists() {
                    save_rgba_png(&path, &actual);
                    generated.push(name);
                    continue;
                }

                let golden = image::open(&path)
                    .unwrap_or_else(|e| panic!("failed to open golden {name}: {e}"))
                    .to_rgba8();

                if golden.as_raw().len() != actual.len() || golden.as_raw() != &actual {
                    std::fs::create_dir_all(diff_dir()).ok();
                    let diff_path = diff_dir().join(&name);
                    save_diff_png(&diff_path, golden.as_raw(), &actual);
                    mismatches.push(format!("{name} (diff: {})", diff_path.display()));
                }
            }
        }
    }

    assert!(
        generated.is_empty(),
        "generated {} new golden image(s) under tests/golden/ — review by eye, \
         then rerun this test (it should pass with no further changes): {generated:?}",
        generated.len(),
    );
    assert!(
        mismatches.is_empty(),
        "golden frame mismatch — rendering no longer matches the committed \
         reference PNGs (parity regression per CLAUDE.md's preview↔export \
         invariant):\n{}",
        mismatches.join("\n"),
    );
}
