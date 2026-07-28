# ADR 0008: Undo/redo scope and debounce strategy

**Status:** Accepted (Phase 4 T9)
**Date:** 2026-07-28
**Authors:** Audiogram team
**Context:** `UI_REBUILD_PLAN.md` §5/21 and `TECH_ARCHITECTURE.md` §2.5 call for ⌘Z/⇧⌘Z undo/redo, deferred at Phase 3's close as a Phase 4 item. The app's store (`store/index.ts`) is one flat zustand store composed from 6 slices covering project identity, Design mode, captions, playback, render, and UI-only state — not all of it is something a user would expect "undo" to touch.

## Decision

**Library:** [`zundo`](https://github.com/charkour/zundo)'s `temporal()` middleware, wrapped around the composed store creator, rather than a hand-rolled history stack. It's zustand-native (peer dep `^4.3.0 || ^5.0.0`, compatible with this repo's `zustand@^5.0.14`), ~700B, and its `partialize`/`equality`/`handleSet` options cover exactly the three problems below without extra plumbing.

**Scope — two groups, everything else excluded:**

1. **Design mode fields**: `layoutTemplate`, `waveStyle`, `waveColor`, `bgColor`, `coverImagePath`, `zones`, `titleColor`, `titleAlign`, `titleBold`, `titleItalic`, `fontSize`, `fontName`.
2. **Caption fields that are user edits**: `segments` (text edits, split/merge/delete), `showSubtitles`, `karaokeEnabled`, `karaokeColor`, `subtitleColor`, `subtitleYPct`.

**Explicitly excluded** (`partializeTemporal()` in `store/index.ts`):
- **Project identity** (`audioPath`, `audioName`, `title`) — opening a different audio file is a navigation, not an edit to the current project.
- **Playback/render state** (`currentTime`, `playing`, `isRendering`, `stage`, `progressPct`, `logs`, …) — transient/derived; undoing `isRendering: true` mid-export would desync the store from the actual ffmpeg child process.
- **UI-only state** (`selectedEl`, `exportSheet`, `scrollToActiveSegmentRequest`, …) — not user content, just which panel/overlay is showing.
- `srtPath`/`whisperModel` — write-once side effects of transcription, not something the user directly manipulates the way they manipulate `segments`' text.

**Debounce (`debouncedHandleSet`, 400ms trailing):** `<input type="range">`'s `onChange` fires on React's `input` event, not `change` — a `Slider` drag or an `Rnd` zone drag can fire dozens of `set()` calls per second. Without debouncing, one drag would produce dozens of undo steps instead of one. `debouncedHandleSet` remembers the state from *before the first call in a burst* and only commits it to history once the burst goes quiet, so a drag collapses to one entry. Discrete commits (`SegmentList`'s edit-commit-on-blur/Enter, a zone's `onDragStop`) already fire exactly one `set()` call, so they pass through unchanged, just delayed by one debounce window — not batched with anything else in practice, since nothing else fires within 400ms of a discrete commit.

**Keyboard wiring:** ⌘Z/⇧⌘Z are JS-keydown-only entries in `app/shortcuts.ts` (`when: 'notTyping'`), **not** given a native-menu `accelerator`. Tauri's Edit-menu `{ item: 'Undo' }`/`{ item: 'Redo' }` (`app/menu.ts`) are left as the OS's predefined role, which drives native text-field undo (e.g. undoing a keystroke inside a focused `<textarea>`); binding the same accelerator to our store's undo would have the two compete for the same keystroke. The `notTyping` guard already routes correctly: our listener skips (and doesn't `preventDefault()`) when a text field is focused, so the keystroke falls through to the browser/OS's own undo instead.

## Rationale

1. **A recognizable, small dependency beats a hand-rolled stack**: zundo's `partialize`/`equality`/`handleSet` map directly onto "which fields", "when did nothing meaningfully change", and "how do we batch a burst" — the three actual design questions here — instead of reimplementing them.
2. **Playback/render exclusion isn't a style choice, it's correctness**: those fields describe the state of a live `<audio>` element or a running ffmpeg child process; snapping them back to a stale value via undo would desync the store from reality with no way to recover except reloading.
3. **Debounce over `pause()`/`resume()`**: the alternative (explicitly pausing tracking on drag-start and resuming on drag-end) would require wiring drag-start/end callbacks into every interactive control (`Slider`, every `Rnd` zone, `SwatchRow`) individually. A single time-based debounce on `handleSet` is one change in one place that covers all of them, at the cost of a small fixed delay before a commit lands in history — acceptable since nothing here is undone at sub-second reflexes.

## Consequences

- `zundo` is a new npm dependency (`apps/desktop/package.json`); no Rust-side equivalent needed since undo/redo is a frontend-only editing convenience, not part of the render pipeline.
- `useAppStore.temporal.getState()` (`pastStates`/`futureStates`/`undo`/`redo`/`clear`) is the one new surface other code can reach for — e.g. a future "Edit > Undo Zone Move" menu label reading `pastStates.length` would come from here, not a new store field.
- A rapid sequence of *unrelated* discrete edits within the same 400ms window (unlikely in practice — e.g. two different zone drags finishing within 400ms of each other) would collapse into one undo step. Accepted as a minor UX rounding rather than added complexity to distinguish "same burst" from "coincidentally adjacent."
- `limit: 100` caps history depth; long editing sessions drop their oldest entries rather than growing `pastStates` unboundedly.

## Related ADRs
- ADR-0001 (Stack — zustand as the store; this extends it rather than replacing it)
