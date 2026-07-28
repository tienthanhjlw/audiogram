//! Animation preset registry (P5-T8) — mirrors
//! `apps/desktop/src/domain/scene/animPresets.ts` exactly. Parity-tested at
//! `tRelative` ∈ {0, 0.25, 0.5, 0.75, 1} against the TS side.
use audiogram_core::entities::scene_node::AnimationId;

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct AnimDelta {
    pub opacity: f32,
    pub dx: f32,
    pub dy: f32,
    pub scale: f32,
}

const IDENTITY: AnimDelta = AnimDelta { opacity: 1.0, dx: 0.0, dy: 0.0, scale: 1.0 };

/// Entrance offset, canvas-fraction units — matches animPresets.ts's SLIDE_OFFSET.
const SLIDE_OFFSET: f32 = 0.08;

/// Evaluate the preset for `id` at `t_relative` (0 = window start, 1 = window end).
pub fn eval(id: AnimationId, t_relative: f32) -> AnimDelta {
    let t = t_relative;
    match id {
        AnimationId::Fade => AnimDelta { opacity: t, ..IDENTITY },
        AnimationId::SlideUp => AnimDelta { opacity: t, dy: (1.0 - t) * SLIDE_OFFSET, ..IDENTITY },
        AnimationId::SlideDown => AnimDelta { opacity: t, dy: -(1.0 - t) * SLIDE_OFFSET, ..IDENTITY },
        AnimationId::ScaleIn => AnimDelta { opacity: t, scale: 0.5 + 0.5 * t, ..IDENTITY },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Parity fixture — must match apps/desktop/src/domain/scene/animPresets.ts's
    // ANIM_PRESETS output at the same 5 tRelative points, error < 1e-6.
    #[test]
    fn fade_matches_ts_at_sample_points() {
        for t in [0.0, 0.25, 0.5, 0.75, 1.0] {
            let d = eval(AnimationId::Fade, t);
            assert!((d.opacity - t).abs() < 1e-6);
            assert_eq!(d.dx, 0.0);
            assert_eq!(d.dy, 0.0);
            assert_eq!(d.scale, 1.0);
        }
    }

    #[test]
    fn slide_up_matches_ts_at_sample_points() {
        for t in [0.0, 0.25, 0.5, 0.75, 1.0] {
            let d = eval(AnimationId::SlideUp, t);
            assert!((d.opacity - t).abs() < 1e-6);
            assert!((d.dy - (1.0 - t) * SLIDE_OFFSET).abs() < 1e-6);
        }
    }

    #[test]
    fn slide_down_matches_ts_at_sample_points() {
        for t in [0.0, 0.25, 0.5, 0.75, 1.0] {
            let d = eval(AnimationId::SlideDown, t);
            assert!((d.opacity - t).abs() < 1e-6);
            assert!((d.dy - -((1.0 - t) * SLIDE_OFFSET)).abs() < 1e-6);
        }
    }

    #[test]
    fn scale_in_matches_ts_at_sample_points() {
        for t in [0.0, 0.25, 0.5, 0.75, 1.0] {
            let d = eval(AnimationId::ScaleIn, t);
            assert!((d.opacity - t).abs() < 1e-6);
            assert!((d.scale - (0.5 + 0.5 * t)).abs() < 1e-6);
        }
    }
}
