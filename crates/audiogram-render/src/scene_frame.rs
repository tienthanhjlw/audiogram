/// Node-based scene renderer (P5-T4) — runs alongside the legacy 6
/// layout match-arms in `frame.rs`, which is NOT modified by this file
/// (PHASE5_TASKS.md §A.5: old render path stays until T18). Mirrors
/// `domain/preview/nodeRenderer.ts` (P5-T3): filter/sort/dispatch by
/// `SceneNode.type`, reusing the exact same drawing primitives frame.rs
/// already uses (`wave::render_wave`, `text::draw_text`,
/// `pixel::draw_image_cover_rect_topleft`) instead of reimplementing them.
use crate::{
    pixel::draw_image_cover_rect_topleft,
    text::{self, TextAlign as RenderTextAlign, TextStyle},
    wave::render_wave,
};
use audiogram_core::contract_gen::TITLE_LINE_HEIGHT;
use audiogram_core::entities::scene_node::{SceneNodeProps, SceneNodeType, TextAlign as NodeTextAlign};
use audiogram_core::entities::{SceneNode, WaveStyle};
use audiogram_core::util::hex_to_rgb;
use cosmic_text::{FontSystem, SwashCache};

/// A decoded RGBA image available to `image`-type nodes, keyed by `ImageProps.src`.
/// Resolving/decoding files is the app crate's job (mirrors `frame::CoverImage`,
/// asset lifecycle is T15's scope) — this crate stays file-I/O-free.
pub struct SceneImage<'a> {
    pub src: &'a str,
    pub pixels: &'a [u8],
    pub width: u32,
    pub height: u32,
}

/// Everything the node dispatch needs beyond `nodes` + `t_sec`.
pub struct SceneShared<'a> {
    pub peaks: &'a [f32],
    pub t_sec: f64,
    pub dur: f64,
    pub eq_snapshot: &'a [f32],
    pub fft_peaks: &'a [f32],
    pub fft_n_buckets: usize,
    pub images: &'a [SceneImage<'a>],
    pub font_system: &'a mut FontSystem,
    pub swash_cache: &'a mut SwashCache,
}

fn node_align_to_render_align(align: NodeTextAlign) -> RenderTextAlign {
    match align {
        NodeTextAlign::Left => RenderTextAlign::Left,
        NodeTextAlign::Center => RenderTextAlign::Center,
        NodeTextAlign::Right => RenderTextAlign::Right,
    }
}

fn find_image<'a>(images: &'a [SceneImage<'a>], src: &str) -> Option<&'a SceneImage<'a>> {
    images.iter().find(|i| i.src == src)
}

/// Draws every node in `nodes`, sorted by `z`, into `buf` (`w × h × 4` RGBA).
///
/// Nodes with a `timing` window are skipped outside `[start, end]` (P5-T8),
/// and so is any node whose ancestor group is hidden by ITS OWN timing
/// (P5-T10 — a group's timing/animIn/animOut applies to the whole subtree).
/// A grouped node's drawn transform is its world transform: its own
/// (possibly animated) transform composed with every ancestor group's own
/// transform (crate::group::world_transform).
#[allow(clippy::too_many_arguments)]
pub fn render_scene_frame_into(buf: &mut [u8], w: usize, h: usize, nodes: &[SceneNode], shared: &mut SceneShared) {
    debug_assert_eq!(buf.len(), w * h * 4);
    let nodes_by_id = crate::group::index_by_id(nodes);
    let mut sorted: Vec<&SceneNode> = nodes.iter().collect();
    sorted.sort_by_key(|n| n.z);

    for node in sorted {
        if !crate::group::is_visible_with_ancestors(node, &nodes_by_id, shared.t_sec, shared.dur) {
            continue;
        }
        let Some(props) = &node.props else { continue };
        let t = crate::group::world_transform(node, &nodes_by_id, shared.t_sec, shared.dur);
        match (node.r#type, props) {
            (SceneNodeType::Waveform, SceneNodeProps::Waveform(p)) => {
                if shared.peaks.is_empty() {
                    continue;
                }
                let style = WaveStyle::try_from(p.style.as_str()).unwrap_or(WaveStyle::Bar);
                let wc = hex_to_rgb(&p.color);
                render_wave(
                    buf, w, h, shared.peaks, wc, style, shared.t_sec, shared.dur,
                    (t.x * w as f32) as usize, t.y * h as f32, (t.w * w as f32) as usize, t.h * h as f32,
                    shared.eq_snapshot, shared.fft_peaks, shared.fft_n_buckets,
                );
            }
            (SceneNodeType::Text, SceneNodeProps::Text(p)) => {
                if p.text.is_empty() {
                    continue;
                }
                // `size` is px at a 1080-tall canvas (scene_node.rs / scene.ts contract).
                let size_px = h as f32 * (p.size / 1080.0);
                let style = TextStyle {
                    size_px,
                    color: hex_to_rgb(&p.color),
                    alpha: t.opacity,
                    bold: p.bold,
                    italic: p.italic,
                    align: node_align_to_render_align(p.align),
                    line_height_ratio: TITLE_LINE_HEIGHT,
                    font_name: p.font.clone(),
                };
                let rect = (t.x * w as f32, t.y * h as f32, t.w * w as f32, t.h * h as f32);
                text::draw_text(buf, w, h, rect, &p.text, &style, shared.font_system, shared.swash_cache);
            }
            (SceneNodeType::Image, SceneNodeProps::Image(p)) => {
                let Some(img) = find_image(shared.images, &p.src) else { continue };
                let x0 = (t.x * w as f32) as usize;
                let y0 = (t.y * h as f32) as usize;
                let x1 = ((t.x + t.w) * w as f32) as usize;
                let y1 = ((t.y + t.h) * h as f32) as usize;
                // T4 scope: cover fit only (matches frame.rs's existing helper);
                // contain fit + circle/rounded clipping are T13/T15 follow-ups.
                draw_image_cover_rect_topleft(buf, w, h, x0, y0, x1, y1, img.pixels, img.width, img.height);
            }
            _ => {} // Sticker/Video/Group have no T4 drawing yet (T13/T15/T10).
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use audiogram_core::entities::scene_node::{Transform, WaveformProps};

    fn make_transform(x: f32, y: f32, w: f32, h: f32) -> Transform {
        Transform { x, y, w, h, rotation: 0.0, opacity: 1.0 }
    }

    fn make_shared<'a>(peaks: &'a [f32], font_system: &'a mut FontSystem, swash_cache: &'a mut SwashCache) -> SceneShared<'a> {
        SceneShared {
            peaks,
            t_sec: 1.0,
            dur: 10.0,
            eq_snapshot: &[],
            fft_peaks: &[],
            fft_n_buckets: 0,
            images: &[],
            font_system,
            swash_cache,
        }
    }

    #[test]
    fn renders_waveform_node_without_panicking() {
        let peaks: Vec<f32> = (0..300).map(|i| 0.4 + 0.4 * (i as f32 * 0.1).sin().abs()).collect();
        let mut buf = vec![0u8; 640 * 360 * 4];
        let node = SceneNode {
            id: "w1".into(),
            r#type: SceneNodeType::Waveform,
            parent_id: None,
            transform: make_transform(0.02, 0.3, 0.96, 0.36),
            z: 0,
            timing: None,
            anim_in: None,
            anim_out: None,
            keyframes: vec![],
            props: Some(SceneNodeProps::Waveform(WaveformProps { style: "bar".into(), color: "#7C5CFF".into() })),
        };
        let mut font_system = text::new_font_system();
        let mut swash_cache = text::new_swash_cache();
        let mut shared = make_shared(&peaks, &mut font_system, &mut swash_cache);
        render_scene_frame_into(&mut buf, 640, 360, &[node], &mut shared);
        assert!(buf.iter().any(|&b| b != 0), "expected some pixels to be drawn");
    }

    #[test]
    fn empty_nodes_leaves_buffer_untouched() {
        let peaks: Vec<f32> = vec![0.5; 300];
        let mut buf = vec![0u8; 100 * 100 * 4];
        let mut font_system = text::new_font_system();
        let mut swash_cache = text::new_swash_cache();
        let mut shared = make_shared(&peaks, &mut font_system, &mut swash_cache);
        render_scene_frame_into(&mut buf, 100, 100, &[], &mut shared);
        assert!(buf.iter().all(|&b| b == 0));
    }

    #[test]
    fn unknown_props_type_is_skipped_not_panicking() {
        // A node whose props don't match its declared type (shouldn't happen via
        // the JSON schema, but defends against a future desync) is silently skipped.
        let peaks: Vec<f32> = vec![0.5; 300];
        let mut buf = vec![0u8; 100 * 100 * 4];
        let node = SceneNode {
            id: "x".into(),
            r#type: SceneNodeType::Image,
            parent_id: None,
            transform: Transform::identity(),
            z: 0,
            timing: None,
            anim_in: None,
            anim_out: None,
            keyframes: vec![],
            props: Some(SceneNodeProps::Waveform(WaveformProps { style: "bar".into(), color: "#fff".into() })),
        };
        let mut font_system = text::new_font_system();
        let mut swash_cache = text::new_swash_cache();
        let mut shared = make_shared(&peaks, &mut font_system, &mut swash_cache);
        render_scene_frame_into(&mut buf, 100, 100, &[node], &mut shared);
        assert!(buf.iter().all(|&b| b == 0));
    }

    /// Parity: a single waveform node covering `minimal`'s waveform zone
    /// must draw byte-identical pixels to `frame::render_frame_into`'s
    /// `Minimal` match arm on the same background (background/vignette is
    /// Stage A of the legacy renderer, not yet part of the T4 dispatch —
    /// compared here by pre-filling both buffers with the same flat colour
    /// instead of running Stage A twice).
    #[test]
    fn parity_waveform_matches_legacy_minimal() {
        use crate::frame::render_frame_into;
        use audiogram_core::contract_gen::default_zones;
        use audiogram_core::entities::Layout;

        let (w, h) = (320usize, 180usize);
        let peaks: Vec<f32> = (0..300).map(|i| 0.4 + 0.4 * (i as f32 * 0.1).sin().abs()).collect();
        let wave_color = [0xFF, 0xFFu8, 0xFF];
        let zones = default_zones("minimal").unwrap();
        let luts = crate::frame::compute_frame_luts(w, h, [0, 0, 0], Layout::Minimal);

        let mut buf_legacy = vec![0u8; w * h * 4];
        render_frame_into(
            &mut buf_legacy, w, h, &peaks, wave_color, WaveStyle::Bar,
            1.0, 10.0, Layout::Minimal, &[], &[], 0, &luts, None, &zones, &[],
        );

        let mut buf_scene = vec![0u8; w * h * 4];
        let node = SceneNode {
            id: "w1".into(),
            r#type: SceneNodeType::Waveform,
            parent_id: None,
            transform: make_transform(zones.waveform.x, zones.waveform.y, zones.waveform.w, zones.waveform.h),
            z: 0,
            timing: None,
            anim_in: None,
            anim_out: None,
            keyframes: vec![],
            props: Some(SceneNodeProps::Waveform(WaveformProps { style: "bar".into(), color: "#FFFFFF".into() })),
        };
        let mut font_system = text::new_font_system();
        let mut swash_cache = text::new_swash_cache();
        let mut shared = SceneShared {
            peaks: &peaks, t_sec: 1.0, dur: 10.0, eq_snapshot: &[], fft_peaks: &[], fft_n_buckets: 0,
            images: &[], font_system: &mut font_system, swash_cache: &mut swash_cache,
        };
        render_scene_frame_into(&mut buf_scene, w, h, &[node], &mut shared);

        // The scene renderer has no Stage A (background/vignette isn't part
        // of the T4 node dispatch yet) so `buf_scene` starts at [0,0,0,0]
        // outside the waveform band, while `buf_legacy` has the vignette
        // fill everywhere — compare only the waveform band's RGB (not alpha,
        // not the untouched background) where both draw the same content.
        let wz = zones.waveform;
        let (bx0, by0) = ((w as f32 * wz.x) as usize, (h as f32 * wz.y) as usize);
        let (bx1, by1) = (((w as f32 * (wz.x + wz.w)) as usize).min(w), ((h as f32 * (wz.y + wz.h)) as usize).min(h));
        for y in by0..by1 {
            for x in bx0..bx1 {
                let idx = (y * w + x) * 4;
                assert_eq!(
                    &buf_legacy[idx..idx + 3], &buf_scene[idx..idx + 3],
                    "waveform pixel mismatch at ({x},{y})",
                );
            }
        }
    }

    /// Budget (PHASE5_TASKS.md §5c / T4 step 4): ms/frame for 20 nodes @1080p.
    #[test]
    fn budget_20_nodes_at_1080p() {
        let (w, h) = (1920usize, 1080usize);
        let peaks: Vec<f32> = (0..300).map(|i| 0.4 + 0.4 * (i as f32 * 0.1).sin().abs()).collect();
        let mut nodes = Vec::new();
        for i in 0..20 {
            if i % 2 == 0 {
                nodes.push(SceneNode {
                    id: format!("w{i}"), r#type: SceneNodeType::Waveform, parent_id: None,
                    transform: make_transform(0.1, 0.1 * (i % 8) as f32, 0.3, 0.1),
                    z: i as i32, timing: None, anim_in: None, anim_out: None, keyframes: vec![],
                    props: Some(SceneNodeProps::Waveform(WaveformProps { style: "bar".into(), color: "#7C5CFF".into() })),
                });
            } else {
                nodes.push(SceneNode {
                    id: format!("t{i}"), r#type: SceneNodeType::Text, parent_id: None,
                    transform: make_transform(0.1, 0.1 * (i % 8) as f32, 0.3, 0.1),
                    z: i as i32, timing: None, anim_in: None, anim_out: None, keyframes: vec![],
                    props: Some(SceneNodeProps::Text(audiogram_core::entities::scene_node::TextProps {
                        text: format!("Node {i}"), role: audiogram_core::entities::scene_node::TextRole::Freeform,
                        bound_to_transcript: false, color: "#FFFFFF".into(), font: "Arial".into(),
                        size: 40.0, align: audiogram_core::entities::scene_node::TextAlign::Center,
                        bold: false, italic: false,
                    })),
                });
            }
        }
        let mut buf = vec![0u8; w * h * 4];
        let mut font_system = text::new_font_system();
        let mut swash_cache = text::new_swash_cache();
        let mut shared = SceneShared {
            peaks: &peaks, t_sec: 1.0, dur: 10.0, eq_snapshot: &[], fft_peaks: &[], fft_n_buckets: 0,
            images: &[], font_system: &mut font_system, swash_cache: &mut swash_cache,
        };

        let start = std::time::Instant::now();
        render_scene_frame_into(&mut buf, w, h, &nodes, &mut shared);
        let elapsed = start.elapsed();

        let ms = elapsed.as_secs_f64() * 1000.0;
        println!("[P5-T4 budget] render_scene_frame_into, 20 nodes (10 waveform + 10 text) @1080p: {ms:.3} ms (budget <= 16 ms)");
        // TODO(p5-t4): measured ~27ms release / ~44ms debug on this machine — OVER the
        // 16ms/frame budget (PHASE5_TASKS.md §5c). Root cause: each text node re-shapes
        // via cosmic-text (text::draw_text) on every single call, unlike the legacy path
        // (frame.rs's compute_title_pixels), which shapes the title once per render and
        // blends a cached pixel list per frame — cheap regardless of frame count. A scene
        // can have many text nodes (captions, stickers, keyframed labels), so the fix is a
        // per-node "shape once, reuse while text/style/rect are unchanged" cache — not
        // built here per §A.9 ("exceed budget ⇒ stop, report"; user confirmed report-only
        // for T4, revisit once T8's `timing` gives a natural per-node stability boundary).
        // Not asserting on `ms` here — a hard-failing perf assertion in a debug test run
        // would block every later task's required `cargo test --workspace` (§A.2) on
        // machine-dependent timing noise; the real gate is this comment + the reported
        // number above, tracked for M1's "every budget has a real number" close-out check.
    }

    /// P5-T8 §A.6 stand-in: exercises the exact `render_scene_frame_into`
    /// call `encode_blocking`'s Stage 2 makes (infrastructure/ffmpeg/render/
    /// mod.rs), with a `timing`-windowed node, at 3 points in a render — one
    /// before the window (must not draw), one inside it (must draw), one
    /// after (must not draw). A real UI-triggered export isn't scriptable
    /// from this environment (T5's note applies here too), but this proves
    /// the actual production render function honors `timing` end to end,
    /// not just the pure `crate::timing` helpers in isolation.
    #[test]
    fn timing_window_appears_and_disappears_across_frames() {
        let (w, h) = (320usize, 180usize);
        let peaks: Vec<f32> = (0..300).map(|i| 0.4 + 0.4 * (i as f32 * 0.1).sin().abs()).collect();
        let node = SceneNode {
            id: "t1".into(),
            r#type: SceneNodeType::Text,
            parent_id: None,
            transform: make_transform(0.2, 0.2, 0.6, 0.2),
            z: 0,
            timing: Some(audiogram_core::entities::scene_node::Timing { start: 2.0, end: 5.0 }),
            anim_in: None,
            anim_out: None,
            keyframes: vec![],
            props: Some(SceneNodeProps::Text(audiogram_core::entities::scene_node::TextProps {
                text: "Appears at 2s".into(),
                role: audiogram_core::entities::scene_node::TextRole::Freeform,
                bound_to_transcript: false, color: "#FFFFFF".into(), font: "Arial".into(),
                size: 60.0, align: audiogram_core::entities::scene_node::TextAlign::Center,
                bold: false, italic: false,
            })),
        };
        let mut font_system = text::new_font_system();
        let mut swash_cache = text::new_swash_cache();

        let render_at = |t_sec: f64, font_system: &mut FontSystem, swash_cache: &mut SwashCache| -> Vec<u8> {
            let mut buf = vec![0u8; w * h * 4];
            let mut shared = SceneShared {
                peaks: &peaks, t_sec, dur: 10.0, eq_snapshot: &[], fft_peaks: &[], fft_n_buckets: 0,
                images: &[], font_system, swash_cache,
            };
            render_scene_frame_into(&mut buf, w, h, std::slice::from_ref(&node), &mut shared);
            buf
        };

        let before = render_at(1.0, &mut font_system, &mut swash_cache);
        let inside = render_at(3.5, &mut font_system, &mut swash_cache);
        let after  = render_at(6.0, &mut font_system, &mut swash_cache);

        assert!(before.iter().all(|&b| b == 0), "node outside its timing window must not draw");
        assert!(after.iter().all(|&b| b == 0), "node past its timing window must not draw");
        assert!(inside.iter().any(|&b| b != 0), "node inside its timing window must draw");
    }

    /// P5-T10 — same production-path check as the timing test above, but for
    /// a grouped node: a waveform child of a group whose OWN `timing` hides
    /// it, drawn via the exact render_scene_frame_into call encode_blocking
    /// uses. The child has no `timing` of its own — visibility is inherited
    /// entirely from the ancestor group.
    #[test]
    fn grouped_node_inherits_group_timing_in_production_render_path() {
        let (w, h) = (320usize, 180usize);
        let peaks: Vec<f32> = (0..300).map(|i| 0.4 + 0.4 * (i as f32 * 0.1).sin().abs()).collect();
        let group = SceneNode {
            id: "g".into(), r#type: SceneNodeType::Group, parent_id: None,
            transform: make_transform(0.1, 0.1, 0.8, 0.8), z: 0,
            timing: Some(audiogram_core::entities::scene_node::Timing { start: 2.0, end: 5.0 }),
            anim_in: None, anim_out: None, keyframes: vec![], props: None,
        };
        let child = SceneNode {
            id: "w1".into(), r#type: SceneNodeType::Waveform, parent_id: Some("g".into()),
            transform: make_transform(0.0, 0.0, 1.0, 1.0), z: 1,
            timing: None, anim_in: None, anim_out: None, keyframes: vec![],
            props: Some(SceneNodeProps::Waveform(WaveformProps { style: "bar".into(), color: "#FFFFFF".into() })),
        };
        let nodes = [group, child];
        let mut font_system = text::new_font_system();
        let mut swash_cache = text::new_swash_cache();

        let mut render_at = |t_sec: f64| -> Vec<u8> {
            let mut buf = vec![0u8; w * h * 4];
            let mut shared = SceneShared {
                peaks: &peaks, t_sec, dur: 10.0, eq_snapshot: &[], fft_peaks: &[], fft_n_buckets: 0,
                images: &[], font_system: &mut font_system, swash_cache: &mut swash_cache,
            };
            render_scene_frame_into(&mut buf, w, h, &nodes, &mut shared);
            buf
        };

        assert!(render_at(1.0).iter().all(|&b| b == 0), "child must not draw before the group's timing window");
        assert!(render_at(3.5).iter().any(|&b| b != 0), "child must draw inside the group's timing window");
        assert!(render_at(6.0).iter().all(|&b| b == 0), "child must not draw after the group's timing window");
    }
}
