// Scene graph entity — mirrors packages/contract/src/scene.ts exactly.
// Generated types (AnimationId, Easing, SceneNodeType) are defined here as Rust
// enums; the codegen produces the TS counterparts from contract/scene_schema.json.
//
// RULE: field names must stay in sync with the TS interfaces in scene.ts.
// If you rename a field here, update scene_schema.json + re-run `npm run contract:gen`.

use serde::{Deserialize, Serialize};
use specta::Type;

// ── Core geometry ────────────────────────────────────────────────────────────

/// Canvas-fraction transform. All x/y/w/h are in [0, 1] relative to canvas size.
/// For a child of a group, these are fractions of the group's local space.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct Transform {
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
    #[serde(default)]
    pub rotation: f32,      // degrees, default 0
    #[serde(default = "default_opacity")]
    pub opacity: f32,       // 0–1, default 1
}

fn default_opacity() -> f32 { 1.0 }

impl Transform {
    pub fn identity() -> Self {
        Self { x: 0.0, y: 0.0, w: 1.0, h: 1.0, rotation: 0.0, opacity: 1.0 }
    }

    /// Compose parent ⊗ child: child coordinates are in parent's local space.
    /// Result is in root (canvas) space.
    ///
    /// Layout rule (mirrors renderer.ts behaviour):
    ///   root_x = parent.x + child.x * parent.w
    ///   root_y = parent.y + child.y * parent.h
    ///   root_w = child.w  * parent.w
    ///   root_h = child.h  * parent.h
    ///   rotation = parent.rotation + child.rotation
    ///   opacity  = parent.opacity  * child.opacity
    pub fn compose(parent: &Transform, child: &Transform) -> Transform {
        Transform {
            x:        parent.x + child.x * parent.w,
            y:        parent.y + child.y * parent.h,
            w:        child.w  * parent.w,
            h:        child.h  * parent.h,
            rotation: parent.rotation + child.rotation,
            opacity:  parent.opacity  * child.opacity,
        }
    }

    /// Decompose a composed (root-space) transform back to child-local given
    /// the parent transform. Inverse of `compose`. Used by T10 ungroup to
    /// recover child's original local-space transform after the group is
    /// dissolved.
    ///
    /// Panics if parent.w or parent.h is zero (degenerate group).
    pub fn decompose(parent: &Transform, root: &Transform) -> Transform {
        assert!(parent.w.abs() > f32::EPSILON, "decompose: parent.w must be non-zero");
        assert!(parent.h.abs() > f32::EPSILON, "decompose: parent.h must be non-zero");
        Transform {
            x:        (root.x - parent.x) / parent.w,
            y:        (root.y - parent.y) / parent.h,
            w:        root.w / parent.w,
            h:        root.h / parent.h,
            rotation: root.rotation - parent.rotation,
            opacity:  if parent.opacity.abs() > f32::EPSILON {
                          root.opacity / parent.opacity
                      } else {
                          1.0
                      },
        }
    }
}

// ── Animation ────────────────────────────────────────────────────────────────

/// Mirrors `AnimationId` in scene.ts — keep in sync with scene_schema.json `animationPresets`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "kebab-case")]
pub enum AnimationId {
    Fade,
    SlideUp,
    SlideDown,
    ScaleIn,
}

/// Mirrors `Easing` in scene.ts — keep in sync with `easingTypes`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "kebab-case")]
pub enum Easing {
    Linear,
    EaseIn,
    EaseOut,
    EaseInOut,
    Hold,
}

/// Mirrors `KeyframeProperty` in scene.ts.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum KeyframeProperty {
    X, Y, W, H, Rotation, Opacity,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct AnimationClip {
    pub preset: AnimationId,
    pub duration: f32,  // seconds
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct Keyframe {
    pub t: f32,
    pub value: f32,     // numeric only in v1 (opacity/x/y)
    pub easing: Easing,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct KeyframeTrack {
    pub property: KeyframeProperty,
    pub keyframes: Vec<Keyframe>,
}

// ── Props per node type ──────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct WaveformProps {
    pub style: String,   // WaveStyle as string to avoid circular dep
    pub color: String,   // hex
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TextProps {
    pub text: String,
    pub role: TextRole,
    #[serde(default)]
    pub bound_to_transcript: bool,
    pub color: String,
    pub font: String,
    pub size: f32,        // px at 1080p canvas height
    pub align: TextAlign,
    pub bold: bool,
    pub italic: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum TextRole {
    Title, Subtitle, Caption, Freeform,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum TextAlign {
    Left, Center, Right,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct ImageProps {
    pub src: String,
    pub fit: Fit,
    pub shape: Option<ImageShape>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum Fit { Cover, Contain }

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ImageShape { Rect, Circle, Rounded }

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct StickerProps {
    #[serde(rename = "assetId")]
    pub asset_id: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct VideoProps {
    pub src: String,
    pub fit: Fit,
    pub r#loop: bool,
    // muted is always true — video background is decorative only, no audio mixing.
    // We don't store it in the struct (it's fixed), but the TS interface marks it
    // `readonly muted: true` so the serialized JSON will carry `"muted": true`.
    #[serde(default = "const_true")]
    pub muted: bool,
}

fn const_true() -> bool { true }

/// Discriminated union of all node prop variants.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum SceneNodeProps {
    Waveform(WaveformProps),
    Text(TextProps),
    Image(ImageProps),
    Sticker(StickerProps),
    Video(VideoProps),
}

// ── Timing ───────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct Timing {
    pub start: f32,  // seconds
    pub end: f32,    // seconds
}

// ── The node ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum SceneNodeType {
    Waveform, Text, Image, Sticker, Video, Group,
}

/// A single composable element on the scene graph.
/// Mirrors `SceneNode` in packages/contract/src/scene.ts exactly.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SceneNode {
    pub id: String,
    pub r#type: SceneNodeType,
    /// Id of parent group. `None` = root level.
    /// Children derived by `nodes.iter().filter(|n| n.parent_id.as_deref() == Some(group_id))`.
    pub parent_id: Option<String>,
    pub transform: Transform,
    pub z: i32,
    pub timing: Option<Timing>,
    pub anim_in: Option<AnimationClip>,
    pub anim_out: Option<AnimationClip>,
    #[serde(default)]
    pub keyframes: Vec<KeyframeTrack>,
    pub props: Option<SceneNodeProps>,
}

impl SceneNode {
    /// Returns the effective (root-space) transform for this node.
    ///
    /// If `parent_transform` is `Some`, composes parent ⊗ self.transform.
    /// If `None` (node is at root level), returns self.transform as-is.
    pub fn effective_transform(&self, parent_transform: Option<&Transform>) -> Transform {
        match parent_transform {
            Some(p) => Transform::compose(p, &self.transform),
            None => self.transform.clone(),
        }
    }

    /// Returns true if this node should be visible at time `t` (seconds).
    /// A node with no `timing` is always visible.
    pub fn is_visible_at(&self, t: f32) -> bool {
        match &self.timing {
            None => true,
            Some(timing) => t >= timing.start && t <= timing.end,
        }
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn make_transform(x: f32, y: f32, w: f32, h: f32) -> Transform {
        Transform { x, y, w, h, rotation: 0.0, opacity: 1.0 }
    }

    // Child {x:.1,y:.1,w:.5,h:.5} inside group {x:.2,y:.2,w:.4,h:.4}
    // Expected root: x=.2+.1*.4=.24, y=.2+.1*.4=.24, w=.5*.4=.20, h=.5*.4=.20
    #[test]
    fn compose_child_in_group() {
        let parent = make_transform(0.2, 0.2, 0.4, 0.4);
        let child  = make_transform(0.1, 0.1, 0.5, 0.5);
        let result = Transform::compose(&parent, &child);

        let eps = 1e-6_f32;
        assert!((result.x - 0.24).abs() < eps, "x={}", result.x);
        assert!((result.y - 0.24).abs() < eps, "y={}", result.y);
        assert!((result.w - 0.20).abs() < eps, "w={}", result.w);
        assert!((result.h - 0.20).abs() < eps, "h={}", result.h);
    }

    // Rotation and opacity compose independently.
    #[test]
    fn compose_rotation_opacity() {
        let parent = Transform { x: 0.0, y: 0.0, w: 1.0, h: 1.0, rotation: 30.0, opacity: 0.8 };
        let child  = Transform { x: 0.0, y: 0.0, w: 1.0, h: 1.0, rotation: 15.0, opacity: 0.5 };
        let result = Transform::compose(&parent, &child);
        assert!((result.rotation - 45.0).abs() < 1e-6, "rotation={}", result.rotation);
        assert!((result.opacity  -  0.4).abs() < 1e-6, "opacity={}", result.opacity);
    }

    // compose then decompose must return original child transform.
    #[test]
    fn decompose_round_trip() {
        let parent = make_transform(0.1, 0.2, 0.6, 0.5);
        let child  = make_transform(0.3, 0.4, 0.7, 0.8);
        let composed   = Transform::compose(&parent, &child);
        let recovered  = Transform::decompose(&parent, &composed);

        let eps = 1e-5_f32;
        assert!((recovered.x - child.x).abs() < eps, "x: {} vs {}", recovered.x, child.x);
        assert!((recovered.y - child.y).abs() < eps, "y: {} vs {}", recovered.y, child.y);
        assert!((recovered.w - child.w).abs() < eps, "w: {} vs {}", recovered.w, child.w);
        assert!((recovered.h - child.h).abs() < eps, "h: {} vs {}", recovered.h, child.h);
    }

    // effective_transform with no parent = identity passthrough.
    #[test]
    fn effective_transform_no_parent() {
        let node = SceneNode {
            id: "n1".into(),
            r#type: SceneNodeType::Text,
            parent_id: None,
            transform: make_transform(0.1, 0.2, 0.3, 0.4),
            z: 0,
            timing: None,
            anim_in: None,
            anim_out: None,
            keyframes: vec![],
            props: None,
        };
        let eff = node.effective_transform(None);
        assert_eq!(eff.x, 0.1);
        assert_eq!(eff.y, 0.2);
    }

    // effective_transform with parent = compose.
    #[test]
    fn effective_transform_with_parent() {
        let parent_t = make_transform(0.2, 0.2, 0.4, 0.4);
        let node = SceneNode {
            id: "child".into(),
            r#type: SceneNodeType::Image,
            parent_id: Some("group1".into()),
            transform: make_transform(0.1, 0.1, 0.5, 0.5),
            z: 1,
            timing: None,
            anim_in: None,
            anim_out: None,
            keyframes: vec![],
            props: None,
        };
        let eff = node.effective_transform(Some(&parent_t));
        let eps = 1e-6_f32;
        assert!((eff.x - 0.24).abs() < eps);
        assert!((eff.y - 0.24).abs() < eps);
        assert!((eff.w - 0.20).abs() < eps);
        assert!((eff.h - 0.20).abs() < eps);
    }

    // is_visible_at edge cases.
    #[test]
    fn visibility_with_timing() {
        let make_node = |start, end| SceneNode {
            id: "t".into(), r#type: SceneNodeType::Sticker,
            parent_id: None,
            transform: Transform::identity(),
            z: 0,
            timing: Some(Timing { start, end }),
            anim_in: None, anim_out: None, keyframes: vec![], props: None,
        };
        let node = make_node(2.0, 5.0);
        assert!(!node.is_visible_at(1.9));
        assert!( node.is_visible_at(2.0));
        assert!( node.is_visible_at(3.5));
        assert!( node.is_visible_at(5.0));
        assert!(!node.is_visible_at(5.1));
    }

    #[test]
    fn visibility_no_timing_always_true() {
        let node = SceneNode {
            id: "always".into(), r#type: SceneNodeType::Waveform,
            parent_id: None,
            transform: Transform::identity(),
            z: 0,
            timing: None,
            anim_in: None, anim_out: None, keyframes: vec![], props: None,
        };
        assert!(node.is_visible_at(0.0));
        assert!(node.is_visible_at(999.0));
    }

    // JSON round-trip for every node type.
    #[test]
    fn json_round_trip_waveform_node() {
        let node = SceneNode {
            id: "w1".into(),
            r#type: SceneNodeType::Waveform,
            parent_id: None,
            transform: Transform::identity(),
            z: 0,
            timing: None,
            anim_in: Some(AnimationClip { preset: AnimationId::Fade, duration: 0.4 }),
            anim_out: None,
            keyframes: vec![],
            props: Some(SceneNodeProps::Waveform(WaveformProps {
                style: "bar".into(),
                color: "#7C5CFF".into(),
            })),
        };
        let json = serde_json::to_string(&node).unwrap();
        let back: SceneNode = serde_json::from_str(&json).unwrap();
        assert_eq!(node, back);
    }

    #[test]
    fn json_round_trip_text_node() {
        let node = SceneNode {
            id: "t1".into(),
            r#type: SceneNodeType::Text,
            parent_id: None,
            transform: Transform::identity(),
            z: 1,
            timing: Some(Timing { start: 0.0, end: 10.0 }),
            anim_in: None,
            anim_out: Some(AnimationClip { preset: AnimationId::SlideDown, duration: 0.3 }),
            keyframes: vec![],
            props: Some(SceneNodeProps::Text(TextProps {
                text: "Hello".into(),
                role: TextRole::Title,
                bound_to_transcript: false,
                color: "#FFFFFF".into(),
                font: "Arial".into(),
                size: 48.0,
                align: TextAlign::Center,
                bold: true,
                italic: false,
            })),
        };
        let json = serde_json::to_string(&node).unwrap();
        let back: SceneNode = serde_json::from_str(&json).unwrap();
        assert_eq!(node, back);
    }

    #[test]
    fn json_round_trip_group_node() {
        let group = SceneNode {
            id: "g1".into(),
            r#type: SceneNodeType::Group,
            parent_id: None,
            transform: make_transform(0.1, 0.1, 0.8, 0.8),
            z: 0,
            timing: None,
            anim_in: None,
            anim_out: None,
            keyframes: vec![],
            props: None,  // groups have no props
        };
        let json = serde_json::to_string(&group).unwrap();
        let back: SceneNode = serde_json::from_str(&json).unwrap();
        assert_eq!(group, back);
    }

    #[test]
    fn json_round_trip_video_node() {
        let node = SceneNode {
            id: "v1".into(),
            r#type: SceneNodeType::Video,
            parent_id: None,
            transform: Transform::identity(),
            z: -1,
            timing: None,
            anim_in: None,
            anim_out: None,
            keyframes: vec![],
            props: Some(SceneNodeProps::Video(VideoProps {
                src: "/path/to/bg.mp4".into(),
                fit: Fit::Cover,
                r#loop: true,
                muted: true,
            })),
        };
        let json = serde_json::to_string(&node).unwrap();
        let back: SceneNode = serde_json::from_str(&json).unwrap();
        assert_eq!(node, back);
    }

    #[test]
    fn json_round_trip_sticker_node() {
        let node = SceneNode {
            id: "s1".into(),
            r#type: SceneNodeType::Sticker,
            parent_id: Some("g1".into()),
            transform: make_transform(0.5, 0.5, 0.2, 0.2),
            z: 2,
            timing: Some(Timing { start: 3.0, end: 8.0 }),
            anim_in: Some(AnimationClip { preset: AnimationId::ScaleIn, duration: 0.5 }),
            anim_out: Some(AnimationClip { preset: AnimationId::Fade, duration: 0.3 }),
            keyframes: vec![],
            props: Some(SceneNodeProps::Sticker(StickerProps { asset_id: "mic-wave".into() })),
        };
        let json = serde_json::to_string(&node).unwrap();
        let back: SceneNode = serde_json::from_str(&json).unwrap();
        assert_eq!(node, back);
    }

    #[test]
    fn json_round_trip_image_node() {
        let node = SceneNode {
            id: "i1".into(),
            r#type: SceneNodeType::Image,
            parent_id: None,
            transform: make_transform(0.0, 0.0, 1.0, 1.0),
            z: -2,
            timing: None,
            anim_in: None,
            anim_out: None,
            keyframes: vec![],
            props: Some(SceneNodeProps::Image(ImageProps {
                src: "/path/to/cover.jpg".into(),
                fit: Fit::Cover,
                shape: Some(ImageShape::Rounded),
            })),
        };
        let json = serde_json::to_string(&node).unwrap();
        let back: SceneNode = serde_json::from_str(&json).unwrap();
        assert_eq!(node, back);
    }
}
