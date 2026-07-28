// P5-T3 temporary flag: switches PreviewCanvas/thumbnailer between the legacy
// `drawFrame` (6 hardcoded layouts) and the new `drawSceneFrame` node
// renderer, for side-by-side comparison while both paths coexist (T3–T10).
// Default OFF — never ships on. Deleted along with the legacy render path
// and the "Try new layers (beta)" entry point at T18 (PHASE5_TASKS.md §A.5).
export const useNodeRenderer: boolean = import.meta.env.VITE_USE_NODE_RENDERER === '1'
