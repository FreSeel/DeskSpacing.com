# Final engineering audit

Date: 2026-10-24. Scope: the maintained FreSeel/DeskSpacing.com checkout, including
modern application modules, tests/tooling, retained page references, asset-copy
boundaries, dependency usage and documentation. Historical vendor trees and model
binaries were inventoried rather than rewritten. This is not a certification of
every historical demo, third-party source file or catalog material.

## Follow-up: repository layout refactor

Static models and sidecars now live under `public/models/`; textures, images,
fonts and retained CSS live under their corresponding `public/` directories.
Only `index.html` and `mainApp.html` remain as root HTML entrypoints. Retained
pages/scripts/SCSS moved to `legacy/`, maintained shared scripts to `src/legacy/`,
and historical third-party code/notices to `vendor/`.

All 4,451 relocated files were SHA-256 checked against their pre-move contents;
none changed. Existing public URLs are preserved through `scripts/site-layout.js`,
shared by development routing, production copying, asset tooling and path tests.
This avoids duplicate asset copies in the distribution. New declared mounts fail
the build if their source is missing. The original catalog and share format did
not change. The historical sections below describe the earlier audit; the README
and development guide contain the current filesystem layout.

Verification after relocation: the complete `npm run check` passed with 50 unit
and 17 production-browser tests. A subsequently added development-routing test
also passed, bringing browser coverage to 18 tests. That test checks marketing
pages, CSS-relative fonts and model loading/sharing under `/LayoutCheck/`.
Asset inventory is unchanged (102 present, one known missing); regeneration of
all five optimized models passed decoded equivalence checks and reproduced the
same file hashes. Lint, formatting and patch whitespace were checked again after
the new test. Existing development CSS source-map and absent GSAP-target warnings
remain; no uncaught page errors or failed first-party HTTP responses were observed
in the new routing test. No performance gain or smaller distribution is claimed.

## 1. Improvements

- Fixed default startup readiness: an early model failure no longer settles
  initialization while other default requests are still running. Successful
  objects remain usable; the first load error is reported after requests settle.
  A delayed-load regression test covers this failure path.
- Consolidated nested hit-to-root resolution so production picking uses the
  function exercised by unit tests. Retained Set membership for picking.
- Removed unused pointer-binding arguments and obsolete script inclusions.
- Replaced the short README with installation, commands, architecture, deployment,
  product-authoring and known-limit guidance. Added repository-specific AGENTS.md.
- Corrected architecture documentation that still described the old global
  engine startup, and development text predating the engine/asset modernization.
- Added a third-party inventory and unresolved provenance register, preserved
  attribution, and copied that notice into production with regression coverage.
- Added a browser regression check for canvas bounds and share-dialog usability
  across common desktop viewport sizes.

## 2. Resulting architecture

The modern planner is a small vanilla ES-module application composed by
`src/app/createApp.js`. Catalog/configuration and serialization are plain-data
boundaries. Actions orchestrate asynchronous changes; the object store owns scene
membership; Three.js transforms remain authoritative. Model loading owns shared
immutable geometry/textures, independent instance materials, a bounded idle cache,
and explicit release/disposal. UI and interaction adapters connect DOM events to
those services. Rendering is demand-driven with explicit invalidation.

Vite bundles the modern planner and legacy share bridge; `scripts/legacy-site.js`
serves/copies retained pages and stable asset paths. Marketing and old/mobile
planners remain separate implementations. The large `products.js` is declarative
catalog data, not an oversized behavioral module; splitting it without a concrete
need would make compatibility review harder. Modern behavioral modules remain
small and focused. Details: [ARCHITECTURE.md](ARCHITECTURE.md).

## 3. Removal and consolidation decisions

Removed `dropDownLogic.js`, which contained only a block comment, and its three
legacy-page script tags. Removed obsolete `README.txt`, whose direction to find
application code inside `mainApp.html` was wrong for the modern planner. Removed
the original-domain `CNAME`; the build continues to exclude any CNAME supplied to
its input. Consolidated duplicate root-picking logic and unused binding inputs.

No direct dependency was removed: Three.js/addons, the legacy alias, Bootstrap,
Popper and GSAP all have runtime consumers; the development dependencies support
linting, formatting, tests, bundling, model verification and profiling. No modern
application console debugging or debugger statements were found.

Original GLBs, textures, thumbnails, legacy HTML, prototype models and historical
vendor code were preserved. Some files such as the rotating-model demo `app.js`
and root engine copies have no active modern consumer, but direct historical
URLs/provenance have not been exhaustively established. Retired vendor scripts
remain excluded from production. The complete `three/` source/examples/tests tree
is also excluded; only mapped npm addons/licenses are copied. Generated build and
browser-report folders are Git-ignored. No speculative asset purge was performed.

## 4. Performance evidence

This audit does not introduce or claim a new runtime speedup. Its changes address
correctness and maintainability. The final planner bundle is approximately 873.06
kB uncompressed / 197.15 kB estimated gzip; the pre-audit build was 872.95 / 197.14
kB. The small increase is consistent with waiting for all startup requests.

Existing measurements in [PERFORMANCE.md](PERFORMANCE.md), with retained raw JSON,
report five startup GLBs shrinking from 29,054,820 to 14,606,836 bytes (49.7%),
median usable time from 1,822 to 1,285 ms, and zero idle renders versus 11 in two
seconds. These are the earlier modernization's software-WebGL measurements,
not measurements attributable to this cleanup. The final browser suite rechecks
idle rendering and duplicate-resource sharing. No new before/after latency,
real-GPU, VRAM or mobile benchmark was performed.

The asset inventory was regenerated: 103 catalog paths, 102 present original
GLBs totaling 635,039,056 bytes, and one missing historical path. The preserved
production distribution is approximately 1.126 GB. License notices add a few kB;
removing the commented script does not materially change distribution size.

## 5. Verification and outstanding failures

Final checks use Node 24.22.1 on macOS with Chromium software WebGL, production
output served under `/DeskSpacing.com/`:

- ESLint and Prettier pass.
- 50 unit tests pass across nine files.
- Production build succeeds.
- All 17 browser tests pass across the final full run (16 existing tests) and
  a focused rerun of the corrected new viewport test. Browser checks cover real
  optimized startup GLBs, representative products from
  every category, camera orbit/reset, actual gizmo translation/rotation, selection,
  deletion, replacement, custom desk textures, variants, tutorial/menu/navigation,
  legacy URLs, save/share/restoration, malformed payloads, failed loads, rendering
  lifecycle, DPR limiting and desktop resize behavior.
- `assets:audit` completes. The known absent `desks/regular_desk_1.glb`
  (`drawerDesk`, not exposed by the desktop catalog) remains unresolved. An
  inventory/path check is not a rendering certification for all 102 models.
- `npm audit` exits 1 with one high-severity advisory in `three-legacy`
  (GHSA-fq6p-x6j3-cmmq). No other findings were returned. Do not apply an automatic
  major engine replacement to the retained inline planners.
- `git diff --check` verifies patch whitespace.

An initial run used the shell's unsupported Node 22.3.0 and could not start the
sandboxed preview server. Verification was rerun with the pinned Node and explicit
localhost/browser permission. A missing timer import in the new regression test
was caught by lint and corrected before final verification. The first viewport
test attempted Escape during Bootstrap's opening transition; it was corrected to
wait for dialog focus and passed on rerun. Lint, formatting and patch whitespace
were checked again afterward. The full combined command was not rerun after this
test-only correction; no application source changed after the successful build.

No uncaught JavaScript errors or failed first-party HTTP responses were recorded
by the startup/share and desktop-size checks. Optional external analytics/fonts
are deliberately blocked in browser tests; their network errors are expected.
This does not certify all browser console output or those external services.
The suite covers 1280×800, resized 1100×760, DPR 3, desktop 1024×768/1440×900/
1920×1080, plus existing narrow marketing navigation and legacy-mobile tooltip
checks. These are automated layout/interaction checks, not a complete visual or
accessibility audit. Real touch devices, Firefox/WebKit and hardware GPUs remain
unverified. Linux CI has not been observed from this local audit.

Git origin points to `git@github.com:FreSeel/DeskSpacing.com.git`. CI has only read
permissions and verification steps; no deployment workflow or upstream hostname
is configured. The root upstream CNAME is removed and build exclusion is tested.
GitHub Pages settings, DNS and live hosting were not changed or inspected, and no
site was published. Confirm the chosen host's size limits before deployment.

## 6. Remaining technical debt

- Legacy r116 advisory, large inline planners and their less defensive parsers.
- Missing historical drawer desk model and incomplete original asset provenance.
- Full original distribution size, high-detail optional meshes/textures and large
  tutorial GIFs. Five optimized copies do not solve overall hosting size.
- Bootstrap 5 JavaScript with compatibility CSS for the retained older theme.
- Upstream analytics ID, contact details and template placeholders still exist;
  make an explicit fork ownership/privacy/content decision before public launch.
- No blanket repository license established, incomplete font/template/model
  evidence, and no certification that every inherited asset may be redistributed.
  [Third-party notices](../THIRD_PARTY_NOTICES.md) identifies evidence and gaps.
- WebGL 2 is required; startup failure on unsupported devices needs a dedicated
  user-facing fallback. Historical mobile code is not modern touch support.
- URL-only persistence has browser/transport length constraints; camera/selection
  and undo history are not saved by the compatibility format.

## 7. Recommended follow-up

1. Resolve asset provenance and hosting size, then verify a staging deployment on
   the fork's actual host with cache/compression headers and share links.
2. Migrate the legacy routes deliberately or agree on their retirement; remove the
   legacy engine only after behavior and old-link compatibility are covered.
3. Add real-device Firefox/WebKit and GPU visual checks, keyboard/accessibility
   coverage, and a WebGL-unavailable fallback before broadening supported devices.
4. Optimize further models only with decoded equivalence checks; evaluate modern
   tutorial video and GPU-compressed textures against visual references.
5. Consider undo/redo, local autosave and import/export for large setups as product
   features, with explicit format/version and recovery designs. They are outside
   this cleanup's behavior-preserving scope.
