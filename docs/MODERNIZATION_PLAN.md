# DeskSpacing modernization plan

Audit date: 2026-10-24. Local baseline: `6e81179` (`Update README.txt`). This audit changes documentation only.

## 1. Scope, evidence, and current architecture

**Recommendation:** use Vite, vanilla JavaScript ES modules, and Three.js. First capture behavior and protect setup compatibility; then extract modules incrementally. There is no evidence that React, Next.js, server rendering, or a state-management framework would solve this application's main problems.

Evidence labels used below:

- **Verified:** observed in local source, tracked-file inventory, asset metadata, or the explicitly described isolated checks.
- **Inferred:** a consequence of the code that still needs browser reproduction or profiling.
- **Proposed:** future work or a target, not a measured result.

### Repository inventory

The audit inventoried all 8,470 tracked files, totaling **2,004,741,122 bytes (2.00 GB decimal)**, excluding Git history. Application entry points, local application scripts/styles, loader/control usage, catalogs, serialization, and page differences were inspected. Third-party source trees were inventoried and relevant APIs examined; this was not a line-by-line review of every vendor implementation or a visual inspection of every model.

| Area | Verified state | Implication |
| --- | --- | --- |
| `mainApp.html` | 229,381 bytes; 3,768 newline characters; main application script at lines 2284–3750 | HTML catalog, UI binding, scene, loading, manipulation, state, and persistence share a file |
| `mainAppMobile.html` / `mainAppOld.html` | 225,407 / 237,165 bytes; near-duplicate application implementations | Separate behavior and serialization must be characterized before consolidation |
| `three/` | 4,015 files; 447,004,503 bytes; package version 0.116.1 | Full library source/examples/docs/tests/models are checked in |
| `node_modules/` | 4,021 tracked files; 447,009,633 bytes | Another large dependency tree is committed; this is not an ignored local installation |
| `GLTFs/` | 197 files; 915,719,004 bytes | Main asset optimization opportunity |
| Other asset folders | `desks`, `keyboards`, `rooms`, `monitors`, `mousepads`, `mouses`, `lamps`, `16x9Monitors`, `ultrawideMonitor`, `desk0`, `3d`, `textures` | Asset organization spans old and new conventions |
| UI assets | 119 files in `Model thumbnails`; marketing images, fonts, tutorial images, several CSS families and SCSS | Preserve reference paths and attribution during migration |
| Tooling | Root lockfile v1 references `file:three` and `uniq@1.0.1`; no root `package.json`, app test suite, build config, or CI workflow found | No reproducible application build/test contract |
| Deployment | Relative HTML/script/asset links, `CNAME` containing `deskspacing.com`, hard-coded production sharing URL | Static hosting is plausible; actual host settings and deployment branch are unverified |

The upstream repository describes the same Three.js desk-planning application, but the local checkout is the audit authority: [upstream repository](https://github.com/cooperlappenbusch/DeskSpacing.com).

### Runtime and feature flow

`mainApp.html` loads classic global scripts: Three.js, OrbitControls, GLTFLoader, DragControls, TransformControls, and DRACOLoader twice. It then creates a camera, renderer, lights, controls, global object array, and catalog dictionaries. Inline HTML handlers and ID-derived form lookups invoke globally accessible functions.

`loadCustomSetup()` either reads `customSetup` or starts a default floor, desk, monitor, keyboard, mouse, and mousepad. Models load asynchronously through a shared GLTFLoader. `objectsArr`, object `userData`, current selection, desk-height dictionaries, and live DOM form values collectively serve as state. There is no separate serializable application model.

Selection recursively raycasts the array, takes an intersected mesh's immediate parent, and attaches TransformControls. OrbitControls is disabled while manipulating an object. Keyboard shortcuts delete, deselect, rotate/translate, resize the gizmo, and toggle axes. Desk changes shift existing non-furniture objects. Product names are constructed from dropdown values and stand options. Primitive boxes, reference spheres, textured floors, and custom desks have separate creation and restoration paths.

Sharing encodes object types, product IDs, positions, rotations, primitive dimensions, and texture names into a delimiter-based query string. Camera and selection are not serialized. Preserve that existing scope unless a separately specified feature expands it.

### Other pages and styles

- `index.html`, `about.html`, and `contact.html` use the marketing template, local Bootstrap/jQuery/Popper, ScrollMagic, TweenMax, and `js/main.js`. `index.html` also uses `js/imageLooper.js` for a four-second slideshow. Contact contains template placeholder content and social `#` links; no application backend was found.
- `services.html` includes legacy Three.js dependencies, but its large application block is inside an HTML comment (lines 114–991). `services - Copy.html` is another template variant. `testHTMLfile.html` is an interactive prototype, not an automated test suite.
- `app.js` is a standalone rotating-model demo loading `scene.gltf`. No root HTML reference was found. `dropDownLogic.js` is entirely commented out despite being loaded.
- `style.css`, `styleNew.css`, and `mobileOnlyCSS.css` duplicate many layout rules. Marketing CSS lives separately under `css/`, with an SCSS source but no root compile workflow. Avoid merging all styles indiscriminately: page-specific layouts differ.
- The desktop page warns mobile users through a user-agent alert; the mobile variant comments that warning out but largely retains mouse-based application code. A mobile filename is not evidence of complete touch support.

## 2. Most important technical problems

Priority: **P0** blocks safe modernization or exposes a serious correctness defect; **P1** high-value next work; **P2** follow-up; **P3** optional after profiling. Effort: **S** localized change, **M** several connected changes, **L** cross-cutting migration with regression checks. These are relative sizes, not calendar estimates.

| Finding and evidence | Status / consequence | Priority / effort |
| --- | --- | --- |
| Parser loop in `mainApp.html:3483` stops on `]` or a parser error; its 10,000-character check is after the loop | **Verified:** extracted function called with `[ ` exceeded a 100 ms VM timeout. Untrusted share input can hang execution | P0 / M |
| Restoration resets the scene before validation; catalog lookup, vector values, dimensions, object count, and input length are unchecked | **Verified source; inferred browser impact:** invalid links can destroy the current setup, throw, or allocate excessive resources | P0 / M |
| `parseURLParams()` calls `decodeURIComponent` and uses a normal object with `parms.hasOwnProperty()` | **Verified isolated checks:** `?customSetup=%` throws URIError; `?hasOwnProperty=x&customSetup=y` throws TypeError | P0 / S |
| `loadCustomSetup()` initializes defaults only when no query object exists | **Verified source:** unrelated `?utm_source=test` yields a query object but no initialization branch; empty scene consequence needs browser confirmation | P1 / S |
| Desktop primitive delimiters are `^`; mobile's are `*` | **Verified script diff:** the primary desktop/mobile application scripts differ at these three serialization/parser lines. Mobile still generates a desktop URL | P0 / M |
| `addDefault()` reads `pickHelper.pickedObject` inside the eventual load callback (`3238`) | **Verified source; inferred race:** changing selection before completion can replace the wrong object | P1 / M |
| `resetScene()` does not invalidate pending loads; desk replacement deletes the old desk before load success (`3311`) | **Verified source; inferred race:** old requests can repopulate reset scenes; failures can leave no desk | P1 / M |
| `deletePicked()` (`2444`) removes from scene/array without disposing geometry, material, or textures | **Verified:** no application disposal path. GPU resource growth is a profiling hypothesis, not a measured leak size | P1 / M |
| `coordinateDictionary` computes height-adjusted numbers once; `updateDeskHeightDiff()` later changes only existing objects and `heightDiff` | **Verified source; inferred defect:** subsequently added products retain initial catalog heights | P1 / M |
| Selection assumes immediate parent has `userData.type` (`2493`); model loader retains only `gltf.scene.children[0]` (`3270`) | **Verified:** catalog asset `mousepads/medium_rgb_mousepad.glb` has two scene roots. Root loss is structurally demonstrable; visible impact untested. Nested parents may lack metadata | P1 / M |
| Catalog references `desks/regular_desk_1.glb`, absent locally | **Verified:** one missing path among 109 model/texture literals in desktop dictionaries. Reachability through every UI variant not established | P1 / S |
| Global `scene`, `objectsArr`, `heightDiff`, controls and loader; undeclared `hemiLight`/`light`; implicit DOM global `rightSideContainer` | **Verified:** ES module strict mode will expose these dependencies instead of preserving classic-script behavior automatically | P1 / L |
| Global `keydown` uses `keyCode` without checking editable targets (`2774`) | **Verified source; inferred UX failure:** typing D/Backspace or shortcuts in fields can manipulate selected objects when picking is enabled | P1 / S |
| Duplicate IDs in active desktop HTML: `modernDesk`, `curved32x9MonitorStand`, `settingsButton`, `resetCameraButton`, `optionsRadios1`, `keybindLetter`, and leading-space ` exampleModalLabel` | **Verified static scan:** ambiguous bindings, invalid markup, unreliable labels/modal references | P1 / M |
| `style.css:2` suppresses outlines globally; repeated inline handlers/styles; canvas-centric controls | **Verified:** keyboard focus is hidden. Full keyboard/screen-reader operation, contrast and touch behavior require manual audit | P1 / M |
| Entire engine trees and examples are tracked alongside application assets | **Verified:** unnecessary repository/deployment bulk; repository size is not the same as browser transfer size | P1 / M |

Additional maintainability concerns:

- Type rules rely on substrings such as `Furniture`, `Desk`, `Primitive`, and `NoSelect`. Replace these gradually with explicit catalog capabilities while preserving legacy type strings at the compatibility boundary.
- `addDesk`, `addDeskCustom`, `addDefault`, and primitive counterparts duplicate replacement logic, naming, placement, and metadata assignment. Array scans and array reconstruction are simple enough at small scene sizes; correctness and ownership matter more than premature data-structure optimization.
- DOM IDs and concatenated dropdown values are effectively a hidden product schema. Catalog labels, dimensions, and model paths need validation. For example, `MXMaster3` declares a 43.5-inch width while its filename says 3.5; establish intended dimensions before correcting data.
- Loaded meshes all cast and receive shadows; errors are logged without user feedback, retry, or rollback. No explicit application cache, request deduplication, or completion barrier exists.
- Empty `keyup`, unused `dragControls`, unused-looking `render`, `textureLoader`, `getObjectByObjectName`, debugging counter `x`, and extensive console logging/commented blocks are cleanup candidates. Confirm callers across retained pages before removal.

### Security boundaries

The verified URL parser failures are client-side availability/correctness issues. This audit did **not** establish remote code execution, an exploitable DOM-XSS path, or a specific dependency CVE. Raw setup text is not evidence of XSS by itself.

Require an allowlisted catalog, finite bounded numbers, bounded payload/object counts, and validation before state mutation. Do not accept arbitrary model URLs in a future format. Use safe DOM text APIs for error/catalog rendering. Inline handlers complicate a strict Content Security Policy; extract them before introducing a tested policy. Some CDN scripts already have integrity attributes; inventory all external fonts, analytics, and scripts rather than assuming uniform protection. Query-string setups may appear in browser history, hosting logs, or analytics; consider a fragment-based versioned format only with compatibility tests and an explicit URL migration decision. Analytics identifiers are public configuration, not secrets.

## 3. Proposed architecture and folder structure

Vite fits a static multipage application and ES modules without adding a UI runtime. Its official documentation supports static output and multiple HTML entry points: [production build](https://vite.dev/guide/build). Preserve `/mainApp.html` and other retained page URLs. A router and backend are unnecessary for current sharing behavior.

Start with small modules and direct dependency injection. Do not build an event-bus framework, entity-component system, plugin system, or generalized repository layer. JSDoc types and optional `checkJs` can document data contracts without requiring an immediate TypeScript conversion.

```text
/
├── index.html                      # marketing entry
├── mainApp.html                    # stable planner URL, small HTML shell
├── about.html
├── contact.html
├── mainAppMobile.html              # compatibility entry until consolidation tested
├── package.json / package-lock.json
├── vite.config.js
├── src/
│   ├── main.js                     # planner entry
│   ├── app/createApp.js             # compose services; startup and teardown
│   ├── scene/
│   │   ├── createScene.js           # camera, lights, renderer
│   │   ├── renderLoop.js            # invalidation, resize, visibility
│   │   └── sceneObjects.js          # instance-ID to Three.js root mapping
│   ├── assets/
│   │   ├── modelLoader.js           # promises, cache, cloning, load errors
│   │   ├── textureLoader.js
│   │   └── resources.js             # shared-resource ownership and disposal
│   ├── interactions/
│   │   ├── selection.js            # raycast hit to owning instance
│   │   ├── transforms.js           # orbit/gizmo coordination
│   │   └── keyboard.js             # shortcuts with focus guards
│   ├── state/
│   │   ├── setupState.js           # serializable state and selection IDs
│   │   └── actions.js              # add/replace/remove/desk/reset operations
│   ├── catalog/
│   │   ├── products.js             # stable IDs, paths, labels, variants
│   │   ├── materials.js
│   │   └── placement.js            # units, offsets, desk-relative positioning
│   ├── sharing/
│   │   ├── legacyCodec.js          # bounded readers for ^ and * formats
│   │   ├── setupCodec.js           # versioned schema, validation, round trip
│   │   └── shareUrl.js             # URL parsing and host/base handling
│   ├── ui/
│   │   ├── catalogPanel.js
│   │   ├── objectControls.js
│   │   └── dialogs.js              # help, sharing, progress and errors
│   ├── marketing/main.js
│   └── styles/                    # base, planner, marketing, responsive styles
├── public/
│   ├── CNAME
│   ├── models/                    # published, optimized models
│   ├── textures/
│   ├── thumbnails/
│   ├── images/
│   └── fonts/
├── scripts/                       # catalog/path checks and asset reports
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── fixtures/                  # legacy URLs, state and screenshot baselines
└── docs/
    ├── MODERNIZATION_PLAN.md
    ├── DEVELOPMENT.md
    └── ASSETS.md                  # provenance, licenses and processing recipes
```

This is a target structure, not a requirement to create empty modules. Retain legacy asset folder names in the initial build; change paths through the catalog later. Archive prototypes outside the published artifact only after route/reference review. Keep source model masters outside `public/`; choose external asset storage or Git LFS only after verifying hosting and CI retrieval requirements.

### State and lifecycle contracts

- A setup contains `version`, desk configuration and object records with stable instance ID, product ID, position, rotation, and optional primitive parameters/material ID. Keep Three.js objects outside serializable state.
- Store immutable catalog defaults. Compute new-object placement from current desk configuration at action time; retain authored model origins, unit conventions, and exceptions explicitly.
- Resolve a raycast hit upward to an owned instance root. Use explicit selectable/movable/deletable flags rather than assuming one parent or matching type substrings.
- Capture replacement target ID before loading. Use a scene generation token to ignore stale completions after reset/restore. Load and validate a replacement before committing removal. Report failures and keep the previous setup usable.
- Deduplicate model requests, then clone owned instances safely. Shared geometry/material/texture lifetimes need reference counting or a bounded cache policy; never indiscriminately dispose resources used by other instances. Handle skinned models separately if present.
- Restore by decoding and validating into temporary state, resolving required assets, then committing coherently. Decide and test failure behavior for partial loads; a failed restore should retain the previous setup.
- Keep both historical delimiter readers. Preserve product identifiers and exact transform meaning. Introduce a new versioned writer only after old links have fixtures; do not silently reinterpret old records.
- During extraction a temporary, explicit `window` adapter can support existing inline handlers. Remove it after listeners move into modules. Keep engine upgrades separate from behavior-preserving extraction.

## 4. Dependencies to update or replace

| Dependency | Verified usage | Recommended action | Priority / effort |
| --- | --- | --- | --- |
| Three.js | `three/package.json` 0.116.1; root module revision 116; classic engine/addons | First reproduce existing engine behavior, then migrate core and addons together to a tested current release | P1 / L |
| OrbitControls, TransformControls, GLTFLoader | Copied globals plus addons from vendored tree | Import matching-version addons from the same pinned Three.js package; compare copied files before discarding potential modifications | P1 / L |
| DragControls | Script loaded; no active construction in desktop app | Remove after retained-page usage checks | P2 / S |
| DRACOLoader | Included twice; no `setDRACOLoader` hookup in planner | Remove unused includes; configure a matching decoder only when serving compressed assets | P2 / S–M |
| Bootstrap/Bootswatch | Root CSS Bootswatch/Bootstrap 4.5.0, planner CDN JS 4.0.0, marketing CSS/JS 4.0.0-beta | Stabilize UI baseline, then either migrate to supported Bootstrap or replace the small required widgets with native DOM/CSS | P1 / L |
| jQuery | 3.2.1 slim, local and CDN | Retain temporarily for legacy widgets; remove if no longer needed after UI migration | P2 / M |
| Popper | Planner CDN 1.12.9; local legacy copy | Upgrade with the chosen Bootstrap version or remove when tooltips no longer require it | P2 / M |
| TweenMax / ScrollMagic | 1.20.2 / 2.0.5 plus bridge/debug plugin on marketing pages | Remove debug helper; evaluate CSS/IntersectionObserver for simple reveals and reduced-motion behavior | P2 / M |
| `uniq` | Lockfile entry 1.0.1; no application import found | Confirm no tooling consumer and remove from new application manifest | P2 / S |
| Analytics/fonts | External UA-tag script and Google Fonts | Confirm actual analytics requirements and privacy configuration; test unavailable third-party services | P2 / S–M |
| Vite + checks | Not currently configured | Add pinned Vite, compatible supported Node release, ESLint, formatting, unit tests and browser tests | P1 / M |

Do not choose an exact “latest” version from this document months later. Resolve supported versions when implementing, review advisories and licenses, pin the lockfile, and test together. No dependency installation or vulnerability scan was performed during this audit.

Important migration hazards include `BoxBufferGeometry`/`OctahedronBufferGeometry` naming, obsolete `gammaOutput`, output encoding/color-space APIs, changed lighting defaults, control integration and WebGL compatibility. The official [Three.js migration guide](https://github.com/mrdoob/three.js/wiki/Migration-Guide) documents these breaking changes, including the move from `outputEncoding` to `outputColorSpace`. Capture appearance before changing them; mechanically renaming properties is insufficient.

The local Node executable reports **22.3.0**. The [Vite getting-started guide](https://vite.dev/guide/) currently specifies 20.19+ or 22.12+, so the observed executable does not meet the stated Node 22 minimum. Select a supported runtime explicitly before installing current tooling.

## 5. Performance improvement opportunities

### Measured asset sizes, not measured load times

The five default GLBs sum to **29,054,820 bytes (29.1 MB)**:

| Default product | Bytes |
| --- | ---: |
| Modern desk | 13,644,040 |
| 28-inch monitor | 2,085,140 |
| Mouse | 1,070,080 |
| 60% keyboard | 12,018,984 |
| Small QCK mousepad | 236,576 |

This excludes floor texture, thumbnails, JavaScript, CSS, fonts, and protocol overhead. Actual transfer depends on hosting compression/cache settings. The coffee-cup GLB is 24,876,716 bytes; some keyboard variants exceed 19 MB. All non-vendor GLB JSON headers were parsed for root/extension metadata; this is not a full glTF validator run. Two non-vendor assets declare Draco use, but no catalog model in the checked desktop list declared required extensions.

| Opportunity | Evidence and implementation approach | Priority / effort |
| --- | --- | --- |
| Optimize default and largest models | Measure triangles, materials, embedded image resolutions and decode cost; resize textures, deduplicate, simplify geometry, trial Meshopt/Draco and KTX2 separately with matching decoders and visual checks | P1 / L |
| Avoid continuous idle rendering | `animate()` (`3057`) updates projection, controls and renders every frame. Invalidate on controls/transforms, model/texture completion and resize; continue frames while damping/animation requires them | P1 / M |
| Bound rendering resolution | Full `devicePixelRatio`, antialiasing, and a 4096×4096 shadow map (`2589–2620`) increase work. Benchmark a DPR cap and quality presets; do not silently degrade all displays | P1 / M |
| Limit shadow work | Every loaded mesh casts/receives shadows. Mark eligible meshes and update shadows only when scene/light changes if profiling supports it | P2 / M |
| Reuse loaded resources | Cache in-flight promises and bounded reusable assets; texture reuse and explicit ownership reduce duplicate parsing/upload | P1 / M |
| Reduce selection work | Recursive raycast visits all scene objects, then selection loops over intersections. Resolve the nearest eligible owner once; consider BVH only if measured raycast time warrants it | P2 / M; BVH P3 |
| Improve catalog startup | Defer hidden thumbnails, use suitable image sizes and loading attributes, render sections incrementally only if DOM cost is measured | P2 / M |
| Reduce shipped code | Remove unused scripts, vendor examples and duplicate includes from published output; split planner from marketing entry points | P1 / M |
| Improve delivery | Hashed assets where practical, tested cache policy, compression, correct MIME types and base paths; public assets need explicit versioning because copied files are not automatically content-hashed | P2 / M |

GPU memory is not reliably described by compressed GLB bytes or JavaScript heap. Track `renderer.info` resource counts, browser traces, draw calls, frame timing and repeated lifecycle behavior. Repository cleanup mainly benefits clones, CI and deployment size; it does not automatically reduce page transfer.

## 6. Compatibility and implementation risks

1. **Existing links:** desktop/mobile delimiter differences, raw unencoded strings, repeated parameters, spaces, trailing commas, and older product IDs need fixtures. Generate links relative to the deployed origin/base instead of always sending fork users to `deskspacing.com`.
2. **Async ordering:** initialization and restoration complete in network order; screenshot and serialization comparisons must wait for settled loads. User actions during loading need explicit semantics.
3. **Authored model transforms:** preserving full glTF roots can change hierarchy and effective placement. Compare bounds, orientation and visible parts before changing root handling.
4. **Lighting and colors:** engine migrations can alter shadows, brightness and texture appearance even if loading succeeds. Use fixed-camera visual comparisons.
5. **Desk placement:** preserve custom dimensions, textures, monitor stands, chair/furniture exceptions and replacement X/Z behavior. Correct defects in separate, documented changes.
6. **Desktop/mobile/old differences:** `mainAppOld.html` contains distinct axis-selection logic and additional state. Treat it as a compatibility candidate until usage is decided, not automatically dead code.
7. **Deployment:** multi-entry output, domain `CNAME`, deep links, spaces/case in filenames, decoder paths, subdirectory hosting and external resource failure must be checked on production-like hosting.
8. **Cleanup:** absence of a literal reference does not prove an asset unused. Include dynamic catalog names, CSS URLs, glTF external buffers/images, older links, and direct public URLs in the inventory before deleting anything.
9. **Licensing:** preserve Three.js and template/library notices; model/image provenance was not established by this audit. Asset reprocessing does not establish redistribution rights.

Potential archive candidates include `app.js`, root `three.module.js`, `myDeskSETUP.gltf` (14,985,044 bytes), experimental scenes, old model folders and prototypes. The first three have no root-HTML literal references; that is a candidate signal only. `styleNew.css` is referenced by `mainAppOld.html`. The upstream Three.js tests are vendor tests, not evidence of planner test coverage.

## 7. Recommended testing strategy

### Characterization before restructuring

Capture a fixed-camera default setup plus representative products, desk variants, primitive box/sphere, texture variants, monitor stand options, multiple identical objects and mixed furniture. Record product IDs, transforms, default positions, available controls, sharing output and expected screenshots. Include both `^` and `*` historical strings and a representative old-page flow.

### Automated layers

- **Unit tests:** bounded legacy/new codecs, round trips, finite numbers and dimension limits, unknown IDs, empty/unrelated/malformed queries, repeated parameters, delimiter variants, truncated strings, URL encoding and deployment origin. Test malformed parsing under explicit timeouts. Test placement calculations independently of Three.js/DOM.
- **Integration tests:** deferred loaders completed out of order; replacement target remains captured; failed replacement retains old object; reset invalidates loads; restore commits consistently; shared resources survive deleting one instance and are released after final ownership ends. Include multiple-root and nested-root fixtures.
- **Browser tests:** Playwright flows for default setup, adding each product category, stand/color/size variants, selection, translation, rotation, deletion, desk changes, primitives, reset, sharing/reopening and UI dialogs. Verify input typing does not trigger destructive shortcuts. Test failed assets, third-party outages, resize and subpath deployment. Treat prototypes as separate routes until disposition is agreed.
- **Visual/manual tests:** fixed renderer settings and settled loads; tolerances for GPU differences; Chromium/Firefox/WebKit where WebGL works, plus real target devices for GPU/touch behavior. Check focus visibility/order, labels, modal focus, keyboard alternatives, reduced motion, zoom/reflow and screen-reader announcements. Headless screenshots alone cannot certify GPU performance or accessibility.
- **Asset checks:** exact-case path existence on Linux CI, catalog completeness, glTF validation, size budgets, thumbnail links, required decoder extensions and licenses. Serve emitted output and assert no required asset 404s.

Add `npm ci`, lint/format checks, unit/integration tests, build and a small production-preview browser suite to CI. Keep heavier visual/performance runs on a stable runner with stored environment details. Avoid snapshotting all markup or testing trivial implementation details.

## 8. Measurable success criteria

These are **proposed acceptance targets**, except the explicitly measured file sizes. Establish the baseline before claiming speedups.

| Dimension | Acceptance criterion |
| --- | --- |
| Compatibility | All characterized features pass; all legacy URL fixtures restore expected object data within 1e-5 transform tolerance; visual differences reviewed |
| Invalid input | Malformed/bounded payload suite returns or rejects within 50 ms per case on the recorded CI runner; no scene mutation before validation; no uncaught URL exceptions |
| Async correctness | Deterministic tests pass for reset, replacement and restore under reordered success/failure; no stale object reappears |
| Loading | Reduce default GLB bytes by at least 50% from 29,054,820, subject to approved visual fidelity; separately target at least 30% lower median time to usable default setup |
| Measurement protocol | At least five cold-cache runs before/after, same browser/device/viewport/DPR, fixed 20 Mbps down and 40 ms latency; report median/range and actual transferred bytes. Define usable as defaults settled and controls responsive |
| Frame time | On named reference hardware, representative 20-object setup targets p95 frame interval ≤16.7 ms during manipulation; report lower-end device behavior separately |
| Idle work | After settling, no recurring application render calls over 10 seconds unless an active animation requires them |
| Resource lifetime | After warm-up and 100 add/delete/reset cycles, geometry/texture counts return to documented baseline/cache bounds with no upward trend; retained scene objects and listeners remain bounded |
| Build/deploy | Fresh supported-Node checkout installs and builds reproducibly; no vendor examples, tests or `node_modules` in published output; all retained routes and required assets load |
| Maintainability | No business logic embedded in HTML; no implicit globals; catalog and codec independent of DOM; dependency changes covered by CI |
| Accessibility | No duplicate IDs in retained app pages; visible focus; primary flows complete by keyboard; no serious/critical automated accessibility findings, plus manual checks |

If model fidelity prevents the byte target, document the tradeoff and revise it using measured results rather than hiding degradation. Do not use Lighthouse alone as the readiness metric for a 3D editor.

## 9. Prioritized roadmap and phased implementation checklist

Each phase should be a small reviewable series of changes with a working app at every merge. Defect fixes are explicit behavior changes for future implementation; none are part of this audit.

### Phase 0 — Baseline and guardrails (P0, M)

- [ ] Confirm supported browsers/devices, retained public pages, hosting target and existing-link requirements.
- [ ] Capture visual/interaction baselines and representative legacy setup fixtures, including both delimiters.
- [ ] Create failing characterization tests for parser termination, malformed query handling and async races.
- [ ] Record cold-load/frame/resource baselines and asset provenance/inventory.
- [ ] Exit gate: baseline behavior is reproducible and compatibility cases are recorded.

### Phase 1 — Targeted correctness fixes (P0/P1, M)

- [ ] Bound and validate parsing before reset; handle malformed and unrelated query parameters.
- [ ] Support both historical primitive formats; use deployment-aware encoded links.
- [ ] Capture replacement targets, invalidate stale loads and retain previous objects on failure.
- [ ] Resolve missing catalog path and verify hierarchy/desk-height defects with fixtures.
- [ ] Guard shortcuts in editable controls; fix ambiguous IDs and visible focus.
- [ ] Exit gate: regression tests reproduce original defects and pass after localized fixes.

### Phase 2 — Reproducible tooling and modular extraction (P1, L)

- [ ] Choose supported Node/Vite versions; create application manifest, lockfile, scripts and ignore rules.
- [ ] Preserve static URLs through a multipage build; verify custom-domain and subpath output.
- [ ] Extract catalog and codecs first, followed by loaders, scene, interactions and UI.
- [ ] Replace implicit globals with explicit dependencies; retain temporary handler adapter only as needed.
- [ ] Consolidate duplicated application logic while keeping tested route-specific UI behavior.
- [ ] Add CI and development documentation; remove tracked dependencies only after replacement build works.
- [ ] Exit gate: fresh install/build and parity suite pass; preview serves all retained routes.

### Phase 3 — Engine and resource lifecycle (P1, L)

- [ ] Compare copied addons to vendor versions, then migrate core/addons together in tested increments.
- [ ] Address geometry, controls, color-space and lighting migration changes; review visual baselines.
- [ ] Introduce resource ownership, request deduplication, cloning and bounded cache eviction.
- [ ] Add capability detection and useful rendering/load failure messages.
- [ ] Exit gate: visual approval, supported-browser checks and lifecycle stress tests pass.

### Phase 4 — Measured performance work (P1/P2, L)

- [ ] Optimize the default desk/keyboard first; validate all transformed models before publishing.
- [ ] Add demand rendering, projection-on-resize and measured DPR/shadow settings.
- [ ] Optimize thumbnails and delivery/cache policy; benchmark startup and repeated manipulation.
- [ ] Keep BVH, instancing or more elaborate batching conditional on profiling evidence.
- [ ] Exit gate: published before/after measurements meet agreed budgets without feature loss.

### Phase 5 — UI dependencies and repository cleanup (P2, M–L)

- [ ] Migrate Bootstrap widgets or replace them; then remove unused jQuery/Popper dependencies.
- [ ] Simplify marketing animation dependencies and respect reduced motion.
- [ ] Consolidate styles with page scopes; complete accessibility and touch checks.
- [ ] Archive confirmed obsolete pages/assets, retain notices and document asset processing.
- [ ] Verify deployment and legacy-link redirects; retain a previous deploy artifact for rollback.
- [ ] Exit gate: production-like smoke checks and all compatibility tests pass.

**First implementation batch:** Phase 0 fixtures plus bounded URL parsing/validation and compatibility tests. Follow with async replacement/reset safety, then Vite and catalog/codec extraction. Do not combine dependency upgrades, asset re-exports and a UI redesign into that first batch.

## 10. Validation performed and remaining uncertainty

Performed: tracked-file count/byte inventory; page/script/style inspection; desktop/mobile/old main-script comparison; active-HTML duplicate-ID scan excluding comments; existence checks for 109 desktop dictionary model/texture literals; non-vendor GLB JSON metadata inspection; dependency headers/manifests; isolated Node VM tests with mocked scene dependencies for truncated parser and malformed query cases. VM tests exercise extracted original functions without running the renderer or changing source.

Not performed: interactive browser/WebGL testing, network waterfall or FPS/GPU/heap measurements, complete glTF geometry/texture validation, screen-reader checks, deployment or hosting configuration inspection, verification of every product option, exhaustive external-link checks, npm install/audit, or a full third-party source security review. No performance improvement or end-to-end feature preservation has been demonstrated yet. Risk statements derived from source are marked accordingly above.

Only this plan was added. No runtime behavior, dependency versions, assets, or deployment settings were changed.
