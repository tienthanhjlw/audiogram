//! Timing window + animIn/animOut evaluation (P5-T8) — mirrors
//! `apps/desktop/src/domain/scene/timing.ts` exactly.
use crate::anim_presets::{eval as eval_preset, AnimDelta};
use audiogram_core::entities::scene_node::Transform;
use audiogram_core::entities::SceneNode;

/// Clamps `timing` to a sane window: `end < start` collapses to a
/// zero-length window (never visible except the single instant t==start);
/// `end` beyond `dur` (video's total length) is clamped to it. `dur <= 0`
/// (duration not known) skips the video-length clamp.
fn clamped_window(node: &SceneNode, dur: f64) -> Option<(f64, f64)> {
    let timing = node.timing.as_ref()?;
    let start = timing.start as f64;
    let mut end = (timing.start as f64).max(timing.end as f64);
    if dur > 0.0 {
        end = end.min(dur);
    }
    Some((start, end))
}

/// Is this node visible at time `t_sec`? Absent `timing` = always visible.
pub fn is_visible_at(node: &SceneNode, t_sec: f64, dur: f64) -> bool {
    match clamped_window(node, dur) {
        None => true,
        Some((start, end)) => t_sec >= start && t_sec <= end,
    }
}

/// animIn/animOut duration, clamped to half the timing window (edge case: a
/// duration longer than the whole window would otherwise make entry/exit
/// animations overlap-collide).
fn clamped_anim_duration(requested: f32, window_len: f64) -> f64 {
    (requested as f64).max(0.0).min(window_len / 2.0)
}

fn apply_anim_delta(base: &Transform, delta: AnimDelta) -> Transform {
    let w = base.w * delta.scale;
    let h = base.h * delta.scale;
    let cx = base.x + base.w / 2.0;
    let cy = base.y + base.h / 2.0;
    Transform {
        x: cx - w / 2.0 + delta.dx,
        y: cy - h / 2.0 + delta.dy,
        w,
        h,
        rotation: base.rotation,
        opacity: base.opacity * delta.opacity,
    }
}

/// Effective (post-animation) transform for `node` at time `t_sec`. Outside
/// any animIn/animOut window, or with no `timing` at all, returns a clone of
/// the node's own `transform` unchanged.
pub fn effective_transform(node: &SceneNode, t_sec: f64, dur: f64) -> Transform {
    let base = &node.transform;
    let Some((start, end)) = clamped_window(node, dur) else { return base.clone() };

    if let Some(anim_in) = &node.anim_in {
        let anim_dur = clamped_anim_duration(anim_in.duration, end - start);
        if anim_dur > 0.0 && t_sec < start + anim_dur {
            let t_rel = (((t_sec - start) / anim_dur) as f32).clamp(0.0, 1.0);
            return apply_anim_delta(base, eval_preset(anim_in.preset, t_rel));
        }
    }
    if let Some(anim_out) = &node.anim_out {
        let anim_dur = clamped_anim_duration(anim_out.duration, end - start);
        if anim_dur > 0.0 && t_sec > end - anim_dur {
            let t_rel = (((end - t_sec) / anim_dur) as f32).clamp(0.0, 1.0);
            return apply_anim_delta(base, eval_preset(anim_out.preset, t_rel));
        }
    }
    base.clone()
}

#[cfg(test)]
mod tests {
    use super::*;
    use audiogram_core::entities::scene_node::{AnimationClip, AnimationId, SceneNodeType, Timing};

    fn make_transform() -> Transform {
        Transform { x: 0.2, y: 0.2, w: 0.4, h: 0.4, rotation: 0.0, opacity: 1.0 }
    }

    fn make_node(timing: Option<Timing>, anim_in: Option<AnimationClip>, anim_out: Option<AnimationClip>) -> SceneNode {
        SceneNode {
            id: "n".into(), r#type: SceneNodeType::Waveform, parent_id: None,
            transform: make_transform(), z: 0, timing, anim_in, anim_out, keyframes: vec![], props: None,
        }
    }

    #[test]
    fn no_timing_is_always_visible() {
        let node = make_node(None, None, None);
        assert!(is_visible_at(&node, 0.0, 0.0));
        assert!(is_visible_at(&node, 9999.0, 0.0));
    }

    #[test]
    fn timing_window_visibility() {
        let node = make_node(Some(Timing { start: 2.0, end: 5.0 }), None, None);
        assert!(!is_visible_at(&node, 1.9, 0.0));
        assert!(is_visible_at(&node, 2.0, 0.0));
        assert!(is_visible_at(&node, 5.0, 0.0));
        assert!(!is_visible_at(&node, 5.1, 0.0));
    }

    /// Edge case: end < start collapses to a zero-length window.
    #[test]
    fn end_before_start_collapses_to_zero_length_window() {
        let node = make_node(Some(Timing { start: 5.0, end: 2.0 }), None, None);
        assert!(!is_visible_at(&node, 3.0, 0.0));
        assert!(is_visible_at(&node, 5.0, 0.0)); // the single collapsed instant
    }

    /// Edge case: timing.end beyond the video's actual duration clamps to it.
    #[test]
    fn end_beyond_video_duration_is_clamped() {
        let node = make_node(Some(Timing { start: 0.0, end: 100.0 }), None, None);
        assert!(is_visible_at(&node, 9.0, 10.0));
        assert!(!is_visible_at(&node, 50.0, 10.0)); // beyond clamped end=10
    }

    #[test]
    fn effective_transform_no_timing_returns_base() {
        let node = make_node(None, None, None);
        assert_eq!(effective_transform(&node, 1.0, 0.0), node.transform);
    }

    #[test]
    fn anim_in_fade_reaches_full_opacity_at_window_end() {
        let node = make_node(
            Some(Timing { start: 0.0, end: 10.0 }),
            Some(AnimationClip { preset: AnimationId::Fade, duration: 1.0 }),
            None,
        );
        let start = effective_transform(&node, 0.0, 0.0);
        assert!((start.opacity - 0.0).abs() < 1e-6);
        let mid = effective_transform(&node, 0.5, 0.0);
        assert!((mid.opacity - 0.5).abs() < 1e-6);
        let after = effective_transform(&node, 1.0, 0.0);
        assert!((after.opacity - 1.0).abs() < 1e-6);
    }

    #[test]
    fn anim_out_fade_reaches_zero_opacity_at_window_end() {
        let node = make_node(
            Some(Timing { start: 0.0, end: 10.0 }),
            None,
            Some(AnimationClip { preset: AnimationId::Fade, duration: 1.0 }),
        );
        let before = effective_transform(&node, 9.0, 0.0);
        assert!((before.opacity - 1.0).abs() < 1e-6);
        let end = effective_transform(&node, 10.0, 0.0);
        assert!((end.opacity - 0.0).abs() < 1e-6);
    }

    /// Edge case: animIn.duration longer than the whole [start,end] window
    /// clamps to half the window, so animIn/animOut can never collide.
    #[test]
    fn anim_in_duration_longer_than_window_is_clamped_to_half() {
        let node = make_node(
            Some(Timing { start: 0.0, end: 2.0 }),
            Some(AnimationClip { preset: AnimationId::Fade, duration: 100.0 }),
            None,
        );
        // Clamped duration = 1.0 (half of the 2s window) — at t=1.0 (the
        // clamped window's end) opacity must already be 1.0, not still fading.
        let at_clamped_end = effective_transform(&node, 1.0, 0.0);
        assert!((at_clamped_end.opacity - 1.0).abs() < 1e-6);
    }
}
