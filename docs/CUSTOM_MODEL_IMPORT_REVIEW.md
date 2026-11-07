# Custom model import — Phase 3 engineering review

Reviewed 2026-11-04–05 using Node 24.22.1, the committed npm lockfile and Playwright
Chromium with SwiftShader on macOS. Scope: modern planner custom GLB/glTF imports,
their existing scene/history integration, browser-local projects and Import dialog.

## Corrections

1. **Incorrect picking/culling bounds.** GLTFLoader populated bounding spheres
   from accessor min/max metadata. The importer recomputed only bounding boxes,
   allowing valid triangle positions with incorrect metadata to remain unpickable
   or incorrectly culled. Both bounds now derive from actual vertex data. The
   regression raycasts a triangle whose authored sphere incorrectly had radius 0.
2. **Index budget applied as a vertex budget.** Accessor validation rejected index
   arrays above 250,000 entries despite the documented 750,000-index budget.
   Accessors now allow the larger budget; the existing scene traversal still
   independently enforces expanded vertex, index and primitive totals. Tests
   cover distinct small budgets, rejection above them, and a 300,000-index model.
3. **Dialog tests failed against the production build.** The old test replaced
   `src/main.js` with a mock importing unbundled UI modules, which are absent from
   `dist/`. This was reproduced before changing the test. Tests now load the real
   production application and replace only service methods for deterministic
   loading/error states. Real loading and cancellation are covered separately.
4. **Stale spacing-test history expectation.** The full suite expected Undo to
   become disabled after undoing one placement, although setup object creation
   already lives in the shared history. This test exercises only built-in boxes;
   the production changes in this review do not run on that path. The assertion
   now verifies that the earlier add can also be undone and redone, retaining
   the exact placement and save/reload checks. No history behavior was changed.
5. **Outdated visual baselines.** Five screenshot tests stopped at old references:
   the library did not include the Phase 2 Import footer, and native select-arrow
   rasterization differed in the current Chromium/macOS environment. Inspected
   expected/actual images and changed pixel regions, then refreshed nine affected
   library/menu images. Other page, inspector and dialog baselines were unchanged;
   screenshot tolerances and assertions were not relaxed.

No dependency, renderer, scene-state model, catalog identifier, asset URL or legacy
wire-format changes were needed. Production corrections are confined to the two
loader validation/bounds functions. No existing tests were disabled.

## Architecture and ownership findings

- Imports commit through the existing actions, object store and history. Root
  Three.js transforms remain authoritative; derived dimensions/snapping data do
  not introduce a second scene state. Built-in models keep first-root behavior;
  custom imports include all roots of the default glTF scene.
- Registry leases coalesce concurrent sources and protect independent instances.
  Shared geometry/materials/textures are immutable. History retains detached
  instances; clearing history or disposing the app releases final references.
  Tests verify exact disposal of geometry, material, texture and ImageBitmap
  resources over twelve import/delete cycles.
- Cancellation, reset, Undo, disposal and superseding project opens prevent stale
  publication. Late load/decode results are released. Failed imports and invalid
  project records preserve the existing scene and selection.
- Source/record validation remains independent of DOM/Three.js. The repository
  uses JavaScript, with no TypeScript sources/compiler/typecheck script. No new
  production dependency was introduced.

## Coverage and verification

Focused unit coverage includes local GLB and self-contained glTF; direct remote
GLB; redirected remote glTF dependencies; invalid model pages/JSON/headers;
missing resources; CORS-style failures; unsupported extensions; byte, texture and
geometry limits; timeout; cancellation during bitmap decoding; concurrent and
repeated imports; stale cache leases; selection; transforms and independent
duplicates; exact import/transform/duplicate/delete Undo/Redo; unit conversion;
saved metadata; shared local assets; missing-file relinking; interrupted project
opens; invalid-record rollback; and legacy empty setup restoration.

Ten focused production Chromium tests exercise:

- Real file import and IndexedDB reopen across page reloads, remote dependencies
  with generated PNG textures, remote failure placeholders and retry.
- Grid, magnetic and surface snapping after nonuniform scaling/rotation, derived
  world-space contact, coherent history and unit toggles without transform drift.
- Real corrupt/CORS-failed URL imports and cancellation without scene mutation.
- Two saved projects sharing local source data, one Blob per duplicated asset,
  deletion of one saved project, and simulated quota failure retaining the earlier
  IndexedDB snapshot and live scene.
- Six textured import/duplicate/delete/history-clear cycles. After the initial
  lazy renderer/gizmo warmup, geometry and texture counters return to the same
  baseline on every cycle. Final disposal leaves zero geometry and at most the
  existing engine-owned DFG lookup texture. Idle rendering stops again.
- Focus entry/return, forward/reverse Tab wrapping, Escape, validation, progress,
  retry and double-submit prevention. Light/dark screenshots at 1280, 375 and
  320 px verify the Import trigger and footer controls remain usable; representative
  desktop and narrow-phone captures were visually inspected.

Remote responses are mocked; there is no dependency on third-party model servers.
Generated fixture provenance and the new fixture contributions' CC0 dedication
are recorded in `THIRD_PARTY_NOTICES.md`. Test aliases exist only in browser tests,
not production globals. Quota exhaustion is injected at the real IndexedDB write
boundary, rather than filling the user's disk. GPU counters are renderer resource
counts, not measurements of process memory or physical VRAM.

Validation results:

- `npm ci` with Node 24.22.1: passed; lockfile and dependency versions unchanged.
- `npx playwright install chromium`: passed outside the filesystem sandbox.
- Focused importer unit tests: **29 passed**.
- Focused production Chromium tests: **10 passed**.
- Full lint, formatting and unit checks: **222 tests passed in 22 files**.
- Production build: passed.
- Final full Chromium run: **111 passed, 3 browser-operation timeouts**. All three
  failed cases passed unchanged on the targeted rerun (**3 passed in 10.8 s**).
  Every one of the 114 cases has a passing result with the final code/baselines,
  but the aggregate `npm run check` invocation exited nonzero due to those timeouts.
- `npm run assets:audit`: **107 catalog paths, 1 pre-existing missing asset**.
  No public assets were modified or optimized; optimization verification is not
  applicable.
- TypeScript check: not applicable to this JavaScript-only repository.

Initial environmental failures were sandbox denial of localhost:4173 and a stalled
browser-cache install; both were resolved with approved outside-sandbox execution.
New QA assertions were corrected to inspect snapping guidance before drag-end
clears it, and compare GPU counts after lazy engine/gizmo initialization. Neither
required a product workaround or relaxed disposal checks.

The first full browser run had **108 passes and 6 failures**: the stale spacing
history assertion and five visual-baseline tests above. All six passed in the
focused correction run and in the final complete run, without snapshot-update mode.

The final full run stalled in two existing magnetic-snapping cases and one
measurement case, at keyboard/mouse/navigation operations. Those paths use built-in
objects and do not execute the changed custom-loader functions. Reported test
durations were 9.9, 17.9 and 7.2 minutes despite 120-second timeouts; traces show
long browser-protocol gaps. This suggests a host/browser interruption, not a
demonstrated importer regression; the underlying interruption was not established.
The same cases passed in the first full run and all three passed unchanged in the
targeted rerun. No timeout was increased and no test was skipped. Raw timeout
artifacts were preserved locally under `/private/tmp/deskspacing-phase3-timeouts/`.

## Persistence, privacy and rights

Unsaved local files remain in memory. Explicit project saves atomically store
only referenced local Blobs with scene records. Remote projects store URLs and
metadata and fetch again on reopen, subject to CORS/availability and normal browser
HTTP caching. No importer upload, proxy or permanent global asset library exists.
Deleting a saved project removes its nested bytes without deleting another saved
project or live/history-retained resources. Existing catalog-only share links and
legacy setups retain their format; custom scenes receive an actionable sharing
error rather than losing assets silently.

License/attribution strings survive save/load as supplied metadata. A public URL
does not establish rights, and metadata is not license verification. The Import
dialog reminds users to obtain permission. Existing site analytics is unrelated
to model loading and remains repository debt; this review does not certify the
whole application's network/privacy policy.

## Remaining limits and merge assessment

The feature is limited to supported static glTF 2.0; Draco/Meshopt/KTX2, sparse
accessors, skinning, morphs, instancing, animation playback and alternate formats
remain unsupported. Local companion-file bundles are unsupported. Project
management, duplication, scaling and recovery remain API capabilities rather than
new UI flows; portable custom-model exports and attribution form fields are not
implemented. Imported objects are magnetic targets but not catalog support surfaces.

Per-asset budgets do not bound all active/history-retained assets together.
Parsing remains on the main thread, cancellation cannot preempt synchronous work
or image decoding, and the 30-second deadline is not a hard CPU preemption limit.
Large-index parsing and texture-budget safeguards were checked, but maximum-budget
interactive performance on real hardware is not certified. No speedup claim or
before/after performance benchmark is made.

Browser-local data may be evicted or cleared and is not portable across origins
or profiles. Viewport tests do not certify mobile touch, Safari, Firefox or real
GPU drivers. The missing `drawerDesk` asset, retained legacy npm advisory, upstream
asset-rights gaps and oversized static distribution remain open.

**Merge assessment:** ready for the documented static glTF import scope; no
reproducible importer blocker remains. Carry the browser-timeout qualification
above into review rather than claiming a single completely green aggregate run.
The platform, performance and product limitations above remain explicit follow-up
work, not implied guarantees from Chromium coverage.
