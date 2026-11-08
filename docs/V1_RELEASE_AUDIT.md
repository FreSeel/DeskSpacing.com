# DeskSpacing v1.0 release audit

Date: 2026-11-07. Audited commit:
`4936418f30add3a39e2908c4e8899de8ce7f570e`.
Related deliverables: [feature inventory](FEATURE_INVENTORY.md) and
[v2 requirements baseline](V2_REQUIREMENTS.md).

## Readiness decision

**NOT READY** for a stable public release of the current complete distribution.

The modern editor has credible architecture and substantial functional coverage.
This audit's five focused unit files passed **74 tests**. Three small probes also
established defects: malformed setup strings do not terminate in both published
legacy planners; normal catalog creation can exceed the save limit; and two desk
loads started without an existing desk can both commit. Separately, the repository
explicitly records unresolved redistribution provenance. The shipped legacy hang
and publication-rights evidence are P0 release gates for the current package.

This conclusion is not a claim that the modern editor is generally broken. Its
transactional editing, resource ownership, numeric controls and snapping are
strong. It is also not a claim that inherited assets are unlicensed: permission
is **unestablished in this checkout**. Publication requires evidence/authorization
or appropriately cleared replacements, not an invented license.

After the P0 gates are closed, release is conditional on resolving or explicitly
accepting the P1 items below, obtaining a current clean release-candidate check,
and validating the chosen host. No feature implementation or deployment occurred
during this audit. Version `1.0.0` in `package.json` is not release evidence.

## Scope, method and evidence boundaries

Read the active app composition, catalog/configuration/presentation, actions,
membership/history, model factories/import validation/cache, measurements,
snapping, renderer, interaction/UI adapters, themes/styles, HTML entrypoints,
project/sharing services, tests, build mappings and CI. Inspected retained legacy
parser/rendering paths and distribution boundaries. Reviewed recent Git history,
including `19e2dc5` (shared history), `81b6f8e` (imports/projects), `b4a3123`
(Import dialog) and HEAD's loader/QA changes. No file-by-file certification of
historical vendor archives or visual inspection of every binary asset is claimed.

The user requested a read-only, resource-conscious audit. That instruction narrows
the repository's usual full-check/install workflow: no dependency installation,
production/test edits, broad fixes, full suite, build or browser installation was
performed. Existing dependencies and the already-present exact Node 24.22.1
binary were used. No current registry version/advisory claim is made.

Evidence labels used below:

- **Confirmed source:** directly traceable implementation/configuration fact.
- **Reproduced:** focused tests or disposable probes executed during this audit.
- **Historical:** results recorded by earlier work, not independently rerun here.
- **Unverified:** a runtime/device/operational outcome requiring more validation.

Missing coverage alone is never treated as proof of broken behavior. Existing
documents are dated evidence: for example, the old modernization plan's proposed
undo/redo is now implemented, while the menu refinement's historical statement
that it introduced no dark mode does not describe today's theme support.

## Architecture and maintainability assessment

| Area               | Evidence and assessment                                                                                                                                                                                                                                                                                           |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Actual stack       | `package.json`: vanilla JavaScript, Three.js `0.186.1`, legacy alias `0.116.1`, Bootstrap `5.3.8`, Popper `2.11.8`, GSAP `3.15.0`; Vite/Vitest/Playwright/ESLint/Prettier. Versions are repository facts, not claims of current latest releases.                                                                  |
| Composition        | `src/main.js` exports one app from `src/app/createApp.js`; services receive collaborators explicitly. There is no React lifecycle, hook or reconciliation layer to audit.                                                                                                                                         |
| State authority    | `src/state/objectStore.js` owns membership; live Three transforms are authoritative. Snapshot records, UI drafts and geometry caches are derived data, not a competing scene-state store. Preserve this boundary.                                                                                                 |
| Mutations          | DOM adapters read forms; actions validate and commit. `actions.restoreRecords` stages loads before replacement and releases failed/stale objects. `state.invalidate()` provides generation-based cancellation.                                                                                                    |
| History            | `src/state/history.js` retains instance identities and bounded before/after values, prepares fallible resize geometry before restoring and coalesces gestures. Raw membership changes invalidate history. One history serves imports and built-ins.                                                               |
| Resource ownership | Catalog loader shares immutable geometry/textures but clones materials/skeletons; imported registry shares static immutable resources with leases. `resources.js` deduplicates disposal and closes ImageBitmaps. History deliberately keeps detached instances alive. No reproduced leak found in reviewed paths. |
| Renderer lifecycle | Demand scheduler, visibility suspension, resize observer, camera-only versus scene invalidation and explicit teardown are substantial strengths. `createScene` creates one WebGL renderer; panel/theme edits preserve it.                                                                                         |
| UI state           | Selection subscriptions, history notifications and rendered-frame reads synchronize fields. Focused drafts preserve text/caret and reject stale edits. Browser tests exercise camera and layout stability. A renderer-frame-driven UI read is still work on every active frame; measure before replacing it.      |
| Complexity         | Long catalog files are declarative data, not reasons to split. Behavioral complexity is concentrated in snapping gesture coordination, numeric/spacing draft adapters and the restricted importer. Those boundaries have meaningful tests. Avoid a new generic event bus/state framework.                         |
| Type safety        | No TypeScript/compiler/typecheck script. Runtime guards protect record, URL, numeric and imported-file boundaries; internal contracts are informal JavaScript. Incremental JSDoc/checkJs is a reasonable proposal, not a reason to rewrite.                                                                       |
| Engine coupling    | `src/scene/appearance.js` modifies a Three shader chunk by matching source text. `src/models/importLoader.js` wraps GLTFLoader parser methods for validated resource assembly. Pinned versions limit drift, but upgrades require focused compatibility/cleanup/visual tests.                                      |
| Duplication        | Old/mobile planners duplicate rendering, input and serialization behavior in HTML. Modern fixes do not automatically reach them. Bootstrap 5 JS coexists with retained older CSS/compatibility rules. Treat legacy retirement/migration as explicit work.                                                         |
| Startup failure    | Feedback is created after renderer construction; a constructor failure escapes `createApp` before normal feedback/cleanup registration. Context-loss handling is not owned by the app. See A-006.                                                                                                                 |

There is no justification in the inspected code for a React/TypeScript rewrite,
renderer migration or state library as a v1 stabilization prerequisite.

## Findings and prioritization

Complexity: **S** = localized change/verification; **M** = several boundaries or
workflow work; **L** = broad migration, external evidence collection or substantial
product work. These are relative estimates, not delivery commitments.

### P0 — release blockers

#### A-001 — Published legacy parsers can hang on malformed shared input (M)

- **Evidence: Reproduced.** `legacy/pages/mainAppMobile.html`,
  `parseShareableString` at line 3536, and `legacy/pages/mainAppOld.html` at line
  3605 loop until `]` without checking end-of-string. Their `index > 10000`
  checks are after the loop. `loadCustomSetup` passes the URL parameter directly.
  `scripts/site-layout.js` and `scripts/legacy-site.js` still publish both routes.
- **Trigger/result:** extract each actual parser into a Node VM, stub only
  `THREE.Vector3`, selection/reset and console, call `parseShareableString('[ ')`.
  Both hit `ERR_SCRIPT_EXECUTION_TIMEOUT` under a 100 ms execution limit. The
  extracted loop has no termination path after input exhaustion. This safely
  establishes the parser defect without hanging a live browser.
- **Impact:** a malformed link can lock the page's main thread; the parser also
  clears the existing scene before validating input. The modern bounded codec is
  unaffected, but it does not protect these published routes.
- **Resolution:** add bounded validation before legacy mutation, preferably
  reusing the modern compatibility codec through a deliberate adapter. Preserve
  historical route and delimiter behavior. Add timeout/rollback regressions for
  truncated, oversized and malformed links. Route removal is not authorized by
  this audit and would require a separate compatibility decision.
- **Release condition:** both retained routes reject malformed inputs promptly
  without scene destruction, with valid historical-link fixtures still passing.

#### A-002 — Publication provenance is incomplete (L)

- **Evidence: Confirmed source.** `THIRD_PARTY_NOTICES.md` records missing blanket
  application-license evidence and incomplete provenance for inherited models,
  textures, template imagery and icon/font assets. Newer model entries do not
  clear the entire inherited collection. `copySite` publishes broad asset mounts.
- **Impact:** there is no complete evidence-based authorization ledger for the
  exact proposed public release. Technical success cannot close this gate.
- **Resolution:** release owner inventories the distributed files and records
  acquisition/permission, exact license, required notices and modifications;
  obtain appropriate review and replace unresolved material when needed. Preserve
  originals and historical compatibility while preparing cleared alternatives.
- **Release condition:** an accountable publication decision and complete rights
  evidence for what ships. This is a repository-evidence gate, not a legal finding
  about ownership or infringement.

### P1 — resolve before v1 or record explicit acceptance

| ID / complexity                                                                | Problem, evidence and user impact                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Proposed resolution and release acceptance                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A-003 / M — Import persistence is not an end-user workflow**                 | **Confirmed source.** `src/projects/localProjects.js` implements save/open/list/delete, but `src/app/createApp.js` returns these services without a project UI. `src/ui/bindPlannerUI.js` invokes `sharing.createLink()`; `src/sharing/createSharing.js` rejects imported records. `mainApp.html` tells users local saves can reopen, but supplies no way to do so. The error is sent to workspace feedback while the Share modal opens with an empty field. Imports can become significant unsaved work. | Before advertising persistent imported scenes, expose a minimal explicit Save/Open project flow and useful inline Share error/recovery. A narrower v1 may explicitly label imports session-only and remove implications of accessible saving; record this acceptance. Rich recovery/export can follow in V2-002/V2-003. Verify import → save → reload → reopen through UI, plus quota failure retaining prior save. |
| **A-004 / S — Catalog capacity exceeds persistence capacity**                  | **Reproduced.** `src/state/actions.js:add` validates one record, but never caps total membership. `addImported` does check the count. `legacyCodec.js` and `projectRecords.js` reject more than 500 records. Probe: add 501 `defaultMouse` instances with lightweight factory groups; all commit, then `sharing.createLink()` throws `Invalid setup: too many objects`. This proves action/codec mismatch, not real-GPU performance at 501 meshes.                                                        | Enforce one capacity policy at commit across add/import/duplicate/restore, with replacement permitted at capacity and pending-load races covered. Show feedback before users create an unsaveable scene. A conscious small-scene v1 limitation needs explicit acceptance, not a claim the boundary is already enforced.                                                                                             |
| **A-005 / M — Concurrent desk creation violates the single-desk model**        | **Reproduced.** `actions.add` captures the current desk before awaiting load. If none exists, two requests capture no target and both commit. Probe: `Promise.all([add('modernDesk'), add('standingDesk')])` leaves both desks and one shared `deskOffset` (`-0.62`). `bindPlannerUI.js` disables only the same card, so it does not serialize desk cards. Possible after deleting the desk or during initial loading.                                                                                    | Serialize desk intent or revalidate a desk-specific request/version at commit; preserve failed-replacement rollback and dispose superseded loads. Test both completion orders, empty/initial scenes, failure and undo. Define latest-intent behavior rather than whichever request happens to finish first.                                                                                                         |
| **A-006 / S–M — Renderer startup failure has no usable fallback**              | **Confirmed source; browser outcome unverified.** `createScene.js` constructs `WebGLRenderer` synchronously; `createApp.js` creates feedback afterward; `main.js` has no catch. HTML canvas fallback text does not handle a failed WebGL context in a canvas-capable browser. There is no app context-loss/recovery UI.                                                                                                                                                                                   | Catch unsupported/failed startup, release partially initialized services and show a readable retry/support message. Verify disabled WebGL2 and simulated context loss/restoration without asserting that Three's internal restoration always fails. At minimum define/retest the supported desktop-WebGL2 contract.                                                                                                 |
| **A-007 / M — Clean release-candidate verification is still required**         | **Historical + Unverified.** `docs/CUSTOM_MODEL_IMPORT_REVIEW.md` records 222 unit passes, successful build and 111/114 browser passes followed by three passing reruns, but explicitly says the aggregate command exited nonzero. This audit ran only 74 selected units. No current hosted CI result, clean-install reproducibility or release browser run was inspected.                                                                                                                                | On the release candidate, run the repository checks under Node 24.22.1 with the lockfile, capture one complete result and investigate repeatable timeouts. Review hosted Linux CI and supported-device smoke checks. Earlier passing reruns are valuable evidence but do not equal a green final aggregate run.                                                                                                     |
| **A-008 / S–M — Fork ownership and external-service configuration unresolved** | **Confirmed source.** `index.html`, `mainApp.html` and `src/app/pageSetup.js` retain `UA-172455339-1`; homepage/contact/footer links still lead to upstream email/social/repository destinations. Browser tests block external requests. No inference is made that the analytics service currently accepts data.                                                                                                                                                                                          | Make an explicit owner-approved analytics/contact/attribution decision; test the actual allowed production network behavior and publish accurate disclosures/support links. Preserve required creator attribution separately from fork support destinations.                                                                                                                                                        |
| **A-009 / M–L — Shipped legacy engine advisory remains open**                  | **Historical advisory + confirmed pinned package.** `package.json` keeps `three-legacy@0.116.1`; build maps it to classic routes. `docs/DEPENDENCIES.md` records high-severity GHSA-fq6p-x6j3-cmmq and an intentionally failing audit. This task did not refresh npm advisories or establish exploitability.                                                                                                                                                                                              | Refresh the dependency/security scan at release, document exposure and accountable acceptance if retained; upgrade/adapt legacy routes with compatibility tests. Do not suppress the advisory or substitute the modern engine blindly. A-001 is a separate application parser bug, not this advisory.                                                                                                               |
| **A-010 / S–M — Missing historical drawerDesk asset**                          | **Confirmed source/filesystem.** `products.drawerDesk.modelPath` maps through `siteSourcePath()` to absent `public/models/desks/regular_desk_1.glb`; only this declared model path was missing in the current probe. `tests/unit/catalog.test.js` allows the exception. It is hidden from the visible catalog, but older links can fail.                                                                                                                                                                  | Recover the authorized original or define an explicit compatibility fallback preserving intended dimensions/meaning. Alternatively accept the exact unsupported historical ID in release notes. Do not substitute a differently sized product silently.                                                                                                                                                             |
| **A-011 / M — Global measurement preference is incomplete**                    | **Confirmed source/intended local contract.** `measurementUI.js` and annotations follow CM/IN; `numericalTransformPanel.js` hard-codes cm reads/writes/labels, and `preciseSpacingPanel.js` hard-codes cm. Help explicitly documents that choice. This is a product consistency gap, not evidence of conversion drift.                                                                                                                                                                                    | Prefer sharing the measurement preference while preserving canonical drafts/positions, exact spacing and degree rotations. If deferred, label the scope of the selector and accept the cm-only inspector limitation explicitly. Validate repeated switching while editing, undo/redo and serialization.                                                                                                             |
| **A-013 / M — Keyboard-only scene access remains incomplete**                  | **Confirmed source; assistive-technology outcome unverified.** `selection.js`/`pointer.js` select existing objects by raycast, with no DOM scene list. Numeric controls improve editing after selection, but do not provide a complete object-navigation workflow. Responsive focus and shortcut coverage is substantial. `pageSetup.js` also retains a desktop-only alert despite touch-oriented help.                                                                                                   | Define v1 accessibility/device scope and disclose limitations; preferably provide an accessible object list with select/deselect/delete and visible focus. Perform keyboard/screen-reader review and reconcile mobile messaging. A full compliance claim is not supported by current tests.                                                                                                                         |
| **A-015 / M — Hosting/package release has not been demonstrated**              | **Historical + Unverified.** `scripts/site-layout.js` copies originals and legacy collections; `README.md` and prior audit report a distribution exceeding 1 GB. No fresh build-size measurement or live hosting check here. CI verifies but does not deploy.                                                                                                                                                                                                                                             | Build the release package, measure its actual size, confirm chosen-host limits and validate root/subpath assets, compression/cache headers and share links on fork staging. Publish only `dist/`; do not restore upstream CNAME. Any asset exclusions require reference/sidecar/rights review.                                                                                                                      |

### P2 — improvements normally deferred to v2

| ID / complexity                                                                          | Problem, evidence and user impact                                                                                                                                                                                                                                                                                                                                                                                           | Proposed resolution and verification                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A-012 / S–M — Monitor diagonal policy absent**                                         | **Confirmed source.** `catalogRenderer.js` marks every option as measurement text; `measurementUI.js` converts it generically. `tests/e2e/measurements.spec.js` explicitly expects `31.5"` to become `80.01 cm`. No always-inch monitor exception exists, despite the investigation target. Product IDs are preserved.                                                                                                      | Decide the product policy explicitly, then distinguish nominal inch diagonals from physical W/D/H and other measurements. Update search, inspector copy and tests together (V2-001). Do not classify a previously unapproved exception as a broken delivered promise. |
| **A-014 / M–L — Aggregate resource and interaction cost unbounded by per-asset limits**  | **Confirmed design; performance impact Unverified.** `history.js` captures all objects for each edit and retains instances up to 100 entries; `modelLoader.js` limits only idle templates. `importLoader.js` limits each asset but parses on the main thread. `interactions/snapping.js` scans structural signatures; surface preparation expands real vertices, and numeric/spacing adapters read on active render frames. | Benchmark representative many-object scenes, unique assets and sustained edits on real hardware, then add aggregate budgets/warnings and targeted optimizations. Avoid claiming a leak or a speedup without measurements (V2-005/V2-006).                             |
| **A-016 / M — Linux CI is not pixel-regression approval**                                | **Confirmed source.** `responsive.spec.js` explicitly skips its macOS pixel test elsewhere; `theme.spec.js` captures screenshots without comparing on non-darwin. `.github/workflows/ci.yml` runs Ubuntu. This avoids missing-baseline failures, but a green Linux run cannot certify appearance.                                                                                                                           | Add approved Linux baselines or a macOS visual job, with stable browser/fonts and deliberate image review. Keep geometry/interaction checks on Linux; do not loosen assertions to get green results.                                                                  |
| **A-017 / M — Internal contracts and engine-extension coupling need upgrade protection** | **Confirmed source.** No static typecheck; `appearance.js` string-replaces shader code and `importLoader.js` wraps parser methods. A dependency upgrade could bypass assumptions without a helpful type/compiler failure.                                                                                                                                                                                                   | Add incremental JSDoc/checkJs at service/record boundaries and focused shader/import contract tests when upgrading. Retain the current renderer and state ownership unless a measured need justifies a change (V2-011).                                               |
| **A-018 / S — Product/release copy is inconsistent**                                     | **Confirmed source.** `mainApp.html` welcome says Update 1.03, tutorial specifies inches, and `presentation.js` retains an implausible MX Master width that `selectionPanel.js` explicitly suppresses in the inspector. `README.md` still tells authors to add cards directly to HTML although cards are generated from presentation data.                                                                                  | Align release/help/contributor copy with actual behavior and validate product specifications before presenting them as authoritative. Keep historical notes dated; do not silently rewrite old validation results.                                                    |

### P3 — optional cleanup

| ID / complexity                                                           | Problem, evidence and user impact                                                                                                                                                                             | Proposed resolution and verification                                                                                                                                                   |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A-019 / S — Reference documentation is scattered across phase records** | **Confirmed source.** `docs/MODERNIZATION_PLAN.md`, UI design docs and prior engineering/QA records mix past proposals with later updates. Readers can misinterpret old checklists as current feature status. | Use this inventory/audit as the dated current baseline and add an index/archive convention in later documentation work. Preserve useful history rather than deleting earlier evidence. |

## Critical-workflow conclusions

| Workflow            | Established behavior                                                                                                                                          | Remaining qualification                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Add/replace/delete  | Captured replacement target, staging, failed-load preservation and stale release have focused passing coverage. Removal uses shared history.                  | A-004 capacity and A-005 concurrent empty-scene desks. Authored Y/rotation replacement semantics are intentional.                                |
| Numeric edit/resize | Validates a complete candidate before mutation; exact canonical transforms, read-only capability guards, primitive resize ownership and rollback are covered. | Arbitrary catalog resizing/import scale UI is absent; cm-only UI is A-011.                                                                       |
| Selection/camera    | Nested root selection, locked desk inspection and accessory priority; camera/renderer identity stability have existing coverage.                              | Empty clicks retain selection; no multiselect/scene list. Browser evidence not rerun here.                                                       |
| History             | Mixed edits, bounded retention, discarded redo release, rollback and stale load cancellation passed focused tests.                                            | Camera/preferences not undoable; history is not persisted; memory is entry-count bounded, not byte bounded.                                      |
| Snapping            | Grid, magnetic and surface strategies compose through one adapter; Alt, gesture cancellation and exact numeric bypass have extensive existing tests.          | No general physics/collision/stacking. Surface support uses contact center, allowing overhang; real-hardware interaction performance unverified. |
| Units               | Canonical inches, cm conversion at UI boundaries and draft preservation protect scene dimensions; numeric no-op tests passed.                                 | Monitor inch exception absent; numeric/spacing preference mismatch is intentional but incomplete product behavior.                               |
| Save/restore/import | Modern codec rejects malformed records; project imports have guarded loads, missing placeholders and atomic storage services.                                 | Most project/recovery tests call APIs directly; end-user persistence UI is missing. Legacy parsers remain separately broken.                     |
| Keyboard/dialogs    | Native input undo, composition guards, workspace edit scoping and modal isolation are implemented and tested.                                                 | Full non-pointer scene navigation and assistive-technology acceptance remain open.                                                               |

## Performance evidence and limits

No benchmark was run and no new speedup, FPS, startup time, VRAM use or maximum
scene-size guarantee is claimed. Historical `docs/PERFORMANCE.md` and raw
`docs/performance/baseline.json`, `after.json`, `baseline-vs-after.json` report
earlier optimization work, including five startup GLBs shrinking from 29,054,820
to 14,606,836 bytes and demand rendering eliminating the measured idle work.
Those artifacts predate recent editor/import features and do not certify HEAD's
large-scene performance. Model bytes are not decoded GPU memory.

Current source retains useful safeguards: DPR cap 2, explicit shadow invalidation,
hidden-tab suspension, cached bounds/resources, import byte/geometry/texture
budgets and exact cleanup. The 4096² shadow map, detailed optional assets,
main-thread parsing, all-object history snapshots and support-geometry preparation
are investigation targets. Optimize only after the documented harness and
representative hardware workloads identify the actual bottleneck.

## Validation ledger

| Check                    | Execution/evidence                                                                                                                                                                               | Result and limits                                                                                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Worktree baseline        | `git status --short`, `git log`, HEAD diff/stat                                                                                                                                                  | Clean before documentation; audit tied to commit above.                                                                                                                                                |
| Runtime                  | `/private/tmp/node-v24.22.1-darwin-arm64/bin/node --version`                                                                                                                                     | `v24.22.1`. Existing binary; no install. Default shell Node was not used for validation.                                                                                                               |
| Focused unit checks      | Exact command below using existing node_modules                                                                                                                                                  | **5 files / 74 tests passed**. Relevant to transactional editing, units and import safety, not the whole application.                                                                                  |
| Legacy nontermination    | Extracted real parser source from each retained HTML into `node:vm`; 100 ms timeout; input `[ `; stub reset/Vector3/console only                                                                 | Both returned `ERR_SCRIPT_EXECUTION_TIMEOUT`. No browser frozen and no source changed.                                                                                                                 |
| Capacity boundary        | Real `createActions`, store and sharing; async factory returned lightweight Three Groups; history limit 1; 501 `defaultMouse` adds                                                               | 501 present, share rejected `Invalid setup: too many objects`; disposed afterward. Functional boundary reproduction, not GPU benchmark.                                                                |
| Concurrent desk boundary | Same lightweight service harness; default history; concurrent modern/standing desk adds into empty store                                                                                         | Both desk IDs present, shared offset `-0.62`; disposed afterward. Native UI click timing not exercised.                                                                                                |
| Catalog/filesystem       | Imported catalog metadata; checked `existsSync(siteSourcePath(modelPath))`                                                                                                                       | 45 cards, 11 categories, 108 product definitions; one missing declared model path: `drawerDesk`. No asset audit regeneration or visual certification.                                                  |
| Packaging/CI             | Read configs, mounts, copy script, build test and screenshot platform guards                                                                                                                     | Confirmed dist-only relative-path packaging and intentionally limited Linux visual coverage. No fresh production build or hosted run.                                                                  |
| Historical broad QA      | `docs/CUSTOM_MODEL_IMPORT_REVIEW.md`                                                                                                                                                             | Reports 222 unit passes, successful build, 111 browser passes plus 3 unchanged passing reruns; aggregate failed due to timeouts. Kept as qualified historical evidence.                                |
| Documentation validation | Scoped formatter, Markdown link/status/ID checks and `git diff --check` at delivery                                                                                                              | Only the three requested Markdown files changed. Full lint/format suite not rerun.                                                                                                                     |
| Not performed            | npm ci/install/upgrade, Chromium install, full unit/e2e suite, lint, production build, npm audit, asset optimizer/audit writers, performance harness, live app visual review, staging deployment | Intentionally omitted under this task's rules. Current full green build, external services, real GPU, Safari/Firefox, physical mobile, storage eviction and forced graphics failure remain unverified. |

Focused command:

```sh
/private/tmp/node-v24.22.1-darwin-arm64/bin/node node_modules/vitest/vitest.mjs run \
  tests/unit/state-actions.test.js \
  tests/unit/history.test.js \
  tests/unit/numerical-transforms.test.js \
  tests/unit/model-imports.test.js \
  tests/unit/legacy-codec.test.js
```

The inline probes are described precisely above for reproduction; they were not
added as tests because this task prohibits test-source edits. Future fixes should
add permanent regressions for the demonstrated failures.

## Minimum release checklist

1. **Close P0:** repair/validate both shipped legacy parsers (A-001), and complete
   the release owner's rights/publication decision for distributed material
   (A-002). Do not solve these by silently breaking legacy routes or declaring an
   unsupported license.
2. **Stabilize editing:** fix the catalog/save capacity mismatch and concurrent
   desk commits (A-004/A-005), with focused regressions and retained transaction,
   compatibility and resource-release behavior.
3. **Make the supported scope honest:** resolve or explicitly accept import
   persistence UI, graphics fallback, cm-only panels, keyboard/mobile limits and
   the missing historical drawer desk (A-003/A-006/A-010/A-011/A-013). If imports
   stay session-only in v1, make that unavoidable in the relevant save/import UI.
4. **Close operational decisions:** refresh security findings and record any
   accepted legacy advisory exposure; set fork-owned support/analytics behavior;
   confirm package/host capacity (A-008/A-009/A-015).
5. **Validate the release candidate:** from the pinned toolchain/lockfile, run
   lint, formatting, full unit tests, build and Chromium e2e; inspect a current
   hosted CI result, reproduce actual deployment-path sharing on staging and
   perform the documented supported-browser/accessibility smoke review (A-007).
   Record any remaining P1 acceptance with owner, scope and follow-up ID.

Defer walls, Photo Mode, WebGPU, richer product integration, cloud services and
framework migration to [v2 planning](V2_REQUIREMENTS.md). They do not close the v1
gates above and should not inflate the stabilization scope.
