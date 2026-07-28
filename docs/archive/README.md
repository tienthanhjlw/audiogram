# Archive

Planning/review docs from Phases 1–4 of the wizard→Studio rebuild (completed, see
git log `p1-t*`…`p4-t14`). Kept for history, not maintained going forward — the
architecture they describe is now the shipped baseline, documented instead in
`CLAUDE.md` and (as of 2026-07-28) `SCENE_GRAPH_REBUILD_PLAN.md` for what's next.

| File | Why archived |
|---|---|
| `TECH_PLAN.md` | Original speculative stack doc (pnpm, Expo/React Native mobile, WebGL) — superseded entirely by the npm+Cargo monorepo actually built. Nothing in it matches the shipped structure. |
| `TECH_ARCHITECTURE.md` | Target architecture + Phase 1–4 roadmap for the frontend rebuild — fully executed. |
| `UI_REBUILD_PLAN.md` | Wizard→Studio UI rebuild plan — fully executed. |
| `FIGMA_IMPLEMENTATION_PLAN.md` | Superseded by `UI_REBUILD_PLAN.md` per its own header (tokens/dark theme kept, wizard model dropped). |
| `DESIGN_REVIEW.md` | UX audit of the old wizard UI — every finding was addressed by the rebuild. |
| `OPTIMIZATION_PLAN.md` | Post-Phase-1 tech debt list (parity, dead code, cancel/ETA wiring) — all items resolved except the optional `audiogram-cli` idea (F8), which was never started. |
| `PHASE1_TASKS.md` … `PHASE4_TASKS.md` | Execution logs for the rebuild, task-by-task. All tasks closed out. |
| `APP_BRIEF.md` | Designer brief describing the old fixed-template feature set (single title/avatar/waveform per layout) — superseded by the scene-graph goal in `SCENE_GRAPH_REBUILD_PLAN.md`. |
| `IDEA.md` | One-line placeholder, never expanded. |

Still living at root because they remain accurate to shipped code or upcoming
work: `UI_DESIGN_SPEC.md` (screen-by-screen spec, still cited by name in code
comments) and `PACKAGE_SPLIT_PLAN.md` (its "Đợt 3" — `@audiogram/renderer`,
`@audiogram/ui` — is exactly the package split the scene-graph renderer work
will need).

`_DELETE_ME_ZZZ_PROBE2.md` is a stray empty file created while testing file
permissions in this session — this sandbox can't delete files in the mounted
folder, only move them. Safe to delete by hand.
