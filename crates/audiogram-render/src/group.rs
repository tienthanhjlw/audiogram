//! Group/composite world-space resolution (P5-T10) — mirrors
//! `apps/desktop/src/domain/scene/group.ts` exactly. Depth-capped at
//! `MAX_GROUP_DEPTH` (3) as a defensive bound against accidental cycles.
use std::collections::HashMap;

use crate::timing::{effective_transform, is_visible_at};
use audiogram_core::entities::scene_node::Transform;
use audiogram_core::entities::SceneNode;

pub const MAX_GROUP_DEPTH: usize = 3;

pub type NodesById<'a> = HashMap<&'a str, &'a SceneNode>;

pub fn index_by_id(nodes: &[SceneNode]) -> NodesById<'_> {
    nodes.iter().map(|n| (n.id.as_str(), n)).collect()
}

/// True if `node` and every ancestor group up the `parent_id` chain is
/// visible at `t_sec` — a group's `timing` hides the whole subtree.
pub fn is_visible_with_ancestors(node: &SceneNode, nodes_by_id: &NodesById, t_sec: f64, dur: f64) -> bool {
    is_visible_with_ancestors_depth(node, nodes_by_id, t_sec, dur, 0)
}

fn is_visible_with_ancestors_depth(node: &SceneNode, nodes_by_id: &NodesById, t_sec: f64, dur: f64, depth: usize) -> bool {
    if !is_visible_at(node, t_sec, dur) {
        return false;
    }
    if let Some(parent_id) = &node.parent_id {
        if depth < MAX_GROUP_DEPTH {
            if let Some(parent) = nodes_by_id.get(parent_id.as_str()) {
                return is_visible_with_ancestors_depth(parent, nodes_by_id, t_sec, dur, depth + 1);
            }
        }
    }
    true
}

/// World-space transform for `node` — composes its own (possibly time-
/// animated) transform with every ancestor group's own transform, parent ⊗
/// child up the chain (Transform::compose, tested at T2).
pub fn world_transform(node: &SceneNode, nodes_by_id: &NodesById, t_sec: f64, dur: f64) -> Transform {
    world_transform_depth(node, nodes_by_id, t_sec, dur, 0)
}

fn world_transform_depth(node: &SceneNode, nodes_by_id: &NodesById, t_sec: f64, dur: f64, depth: usize) -> Transform {
    let own = effective_transform(node, t_sec, dur);
    if let Some(parent_id) = &node.parent_id {
        if depth < MAX_GROUP_DEPTH {
            if let Some(parent) = nodes_by_id.get(parent_id.as_str()) {
                let parent_world = world_transform_depth(parent, nodes_by_id, t_sec, dur, depth + 1);
                return Transform::compose(&parent_world, &own);
            }
        }
    }
    own
}

#[cfg(test)]
mod tests {
    use super::*;
    use audiogram_core::entities::scene_node::{AnimationClip, AnimationId, SceneNodeType, Timing};

    fn make_transform(x: f32, y: f32, w: f32, h: f32) -> Transform {
        Transform { x, y, w, h, rotation: 0.0, opacity: 1.0 }
    }

    fn group_node(id: &str, transform: Transform) -> SceneNode {
        SceneNode {
            id: id.into(), r#type: SceneNodeType::Group, parent_id: None,
            transform, z: 0, timing: None, anim_in: None, anim_out: None, keyframes: vec![], props: None,
        }
    }

    fn child_node(id: &str, parent_id: &str, transform: Transform) -> SceneNode {
        SceneNode {
            id: id.into(), r#type: SceneNodeType::Waveform, parent_id: Some(parent_id.into()),
            transform, z: 0, timing: None, anim_in: None, anim_out: None, keyframes: vec![], props: None,
        }
    }

    #[test]
    fn composes_parent_and_child() {
        let group = group_node("g", make_transform(0.2, 0.2, 0.4, 0.4));
        let child = child_node("c", "g", make_transform(0.1, 0.1, 0.5, 0.5));
        let nodes = [group, child.clone()];
        let by_id = index_by_id(&nodes);
        let world = world_transform(&child, &by_id, 0.0, 0.0);
        let eps = 1e-6_f32;
        assert!((world.x - 0.24).abs() < eps);
        assert!((world.y - 0.24).abs() < eps);
        assert!((world.w - 0.20).abs() < eps);
        assert!((world.h - 0.20).abs() < eps);
    }

    #[test]
    fn group_timing_hides_children_with_no_timing_of_their_own() {
        let mut group = group_node("g", make_transform(0.0, 0.0, 1.0, 1.0));
        group.timing = Some(Timing { start: 2.0, end: 5.0 });
        let child = child_node("c", "g", make_transform(0.0, 0.0, 1.0, 1.0));
        let nodes = [group, child.clone()];
        let by_id = index_by_id(&nodes);
        assert!(!is_visible_with_ancestors(&child, &by_id, 1.0, 0.0));
        assert!(is_visible_with_ancestors(&child, &by_id, 3.0, 0.0));
        assert!(!is_visible_with_ancestors(&child, &by_id, 6.0, 0.0));
    }

    #[test]
    fn group_anim_in_scales_child_opacity() {
        let mut group = group_node("g", make_transform(0.1, 0.1, 0.5, 0.5));
        group.timing = Some(Timing { start: 0.0, end: 10.0 });
        group.anim_in = Some(AnimationClip { preset: AnimationId::Fade, duration: 2.0 });
        let child = child_node("c", "g", make_transform(0.0, 0.0, 1.0, 1.0));
        let nodes = [group, child.clone()];
        let by_id = index_by_id(&nodes);
        let at_start = world_transform(&child, &by_id, 0.0, 0.0);
        assert!((at_start.opacity - 0.0).abs() < 1e-6);
        let at_end = world_transform(&child, &by_id, 2.0, 0.0);
        assert!((at_end.opacity - 1.0).abs() < 1e-6);
    }
}
