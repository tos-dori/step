# Step architecture

## Stable entry files
- `index.html`: fixed DOM shell, PWA/icon links, one stylesheet link, and the app loader only. Normal feature patches should not modify it.
- `site.webmanifest`: PWA metadata.
- `styles/app.css`: the complete current visual cascade, extracted byte-for-byte from the former inline style block. CSS cleanup is intentionally separate from this structural refactor.
- `src/app.js`: ordered loader for classic app modules, followed by the Firebase sync module.

## JavaScript responsibilities
- `src/config.js`: app version, storage key, task/status/timer constants.
- `src/dom.js`: fixed DOM references and selector helpers.
- `src/state.js`: base state, local persistence, normalization, cloud-state conversion, shared utilities, and runtime variables.
- `src/feedback.js`: toast, celebration, textarea auto-grow.
- `src/task-model.js`: task lookup, status calculation, type metadata.
- `src/memo.js`: memo guides, Unicode check tokens, memo editing and token toggling.
- `src/step-flow.js`: checklist wording, piece kinds, Step construction.
- `src/timer.js`: focus/break timer state, rendering and hold behavior.
- `src/task-actions.js`: create, select, progress, put away, done-shelf and delete actions.
- `src/editor.js`: edit drafts and edit-time Step count changes.
- `src/render.js`: current/add/done/editor rendering and current-card bindings.
- `src/library.js`: library and finished-task list rendering.
- `src/events.js`: static input, button and hold-event bindings.
- `src/bridge.js`: stable `window.StepSyncApp` interface exposed to synchronization.
- `src/bootstrap.js`: visible version and final startup calls.
- `src/sync/firebase.js`: Firebase Auth, Firestore synchronization, conflict handling, and `window.StepSyncBridge`.

## Invariants
- Keep storage key `step_live_v1` unchanged.
- Keep both `window.StepSyncApp` and `window.StepSyncBridge` contracts unchanged.
- Keep the module order in `src/app.js` unless dependency testing proves a change is safe.
- Do not move bootstrap calls ahead of bridge creation.
- Do not combine structural refactoring with UX, copy, timer, task-model, or CSS-result changes.
- Routine patches should touch only the responsible source file; visual patches should normally touch only `styles/app.css`.
