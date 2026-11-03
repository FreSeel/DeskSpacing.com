# Undo/redo focused QA — 2026-11-03

Node 24.22.1; existing Vitest and Playwright infrastructure. No new dependencies.

## Unit coverage

Added `history.test.js` and `history-ui.test.js`: empty availability, mixed add /
move / rotate / resize / delete sequences, twenty complete undo/redo cycles,
identity and serialized values, bounded retention, abandoned-redo disposal,
nested transactions, rollback, no-ops, cancellation, return-to-origin gestures,
separate gestures, resize allocation failure, deselection, setup restore and
stale asynchronous loads. UI adapters cover availability, listener cleanup,
editable shortcut isolation and default prevention only after successful history.

Updated numerical-transform and precise-spacing fixtures to clear their setup
history explicitly. Their cleanup now disposes actions, releasing retained
history resources. Existing assertions assuming restore clears history were
updated to the new contract. These were obsolete tests, not production defects.

Commands executed:

- `npx vitest run tests/unit/history.test.js tests/unit/numerical-transforms.test.js tests/unit/precise-spacing.test.js tests/unit/transform-snapping.test.js tests/unit/state-actions.test.js tests/unit/selection.test.js tests/unit/snapping.test.js tests/unit/magnetic-snapping.test.js tests/unit/surface-snapping.test.js`: 116 passed before the final extra async test.
- `npx vitest run tests/unit/history.test.js tests/unit/history-ui.test.js`: final 8 passed. Together with neighboring checks, 119 distinct unit tests passed.
- `npm run build`: passed.
- Targeted ESLint, Prettier and `git diff --check`: passed.

## Browser coverage

Added `history.spec.js` for UI shortcuts (including Meta and Ctrl variants),
delete/undo/redo cycles, retained scene/camera/renderer/canvas identity, camera
and canvas stability, button availability and text undo isolation. Camera values
use a tight tolerance for ordinary OrbitControls floating-point drift.

The first focused browser run passed 16 of 19 tests, including all six existing
camera/deletion cases. Failures identified old fixture/cancellation assumptions
and the new test's overly strict floating-point camera comparison. Updated
cancellation expectations to restoration of the initial transform, not retention
of the cancelled movement. Browser rerun results are recorded below.

## Limits

No duplicate operation or continuous resize slider exists. No manual visual
review, Safari, Firefox or real mobile-device validation was performed. Chromium
phone-sized viewport checks do not certify mobile devices. Unit disposal checks
and idle-render assertions are not a GPU-memory profile or performance benchmark.
Deleted instances retain resources until history eviction; the action limit is
not a GPU byte limit. Future editable metadata must extend snapshot capture.
Missing drawerDesk and the legacy npm advisory remain open.

## Final browser results and assessment

Executed with the repository's localhost/WebGL permissions after the sandbox
blocked the Playwright browser-cache lock. `playwright install chromium` then
succeeded with the required access.

- `playwright test tests/e2e/history.spec.js tests/e2e/camera-deletion.spec.js tests/e2e/snapping.spec.js tests/e2e/numerical-transforms.spec.js`: initial 16/19 passed, failures described above.
- `playwright test tests/e2e/history.spec.js tests/e2e/numerical-transforms.spec.js tests/e2e/snapping.spec.js tests/e2e/magnetic-snapping.spec.js tests/e2e/surface-snapping.spec.js`: 20/22 passed. Remaining failures were a test that closed the already-open More menu, and magnetic cancellation's obsolete extra Undo.
- `playwright test tests/e2e/history.spec.js tests/e2e/magnetic-snapping.spec.js`: final 6/6 passed after those test corrections.

All 28 distinct targeted Chromium cases have passing final results across these
runs. No complete suite was run. These are automated browser results, not manual
visual certification. Existing magnetic checks exercise dark mode, but history
button visual contrast in both themes has not been manually reviewed.

No production defect was confirmed during this pass. Changes are restricted to
new regression coverage, baseline/contract assertions, and test cleanup. Ready
for integration within the tested Chromium scope, with the limits above retained.
Desk replacement height shifting has neighboring action coverage but does not yet
have a dedicated browser undo/redo sequence; add that and real-device/theme visual
review in subsequent QA. No heap/GPU growth claim is made from these runs.
