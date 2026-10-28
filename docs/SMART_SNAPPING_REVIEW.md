# Smart Snapping integration review

Review date: 2026-10-28. Scope: stabilize grid, magnetic alignment and surface
contact together; retain the existing live Three.js scene, project codec and
measurement system. No new dependencies or product features were added.

## Readiness and coverage

| Area                                | Status                | Evidence and boundary                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared architecture and coordinates | Pass                  | One TransformControls adapter and pure resolver; world-space corrections flow through transform actions. Native local positions remain exact when no correction is needed. Rotated, mirrored, scaled and nested geometry has unit coverage.                                                                                                       |
| Mode combinations and precedence    | Pass                  | All eight grid/object/surface combinations have parameterized tests, including master-off and bypass. Native browser drags cover acquisition, release, toggles, Alt/Option, cancellation and exact history. Surface owns height; magnetic alignment takes horizontal priority; grid fills remaining axes.                                         |
| Real-object placement               | Pass with limitations | Browser checks use two monitors, keyboard, mouse and speakers. Edge/center alignment, independent movement, multiple desk elevations and boundary release pass. Six imported desk families, including both concave Bekant tops, are exercised. No arbitrary shelves, sloped supports, physics or attachment behavior is claimed.                  |
| Centimeters/inches                  | Pass                  | Canonical inch spacing survives display conversion, editing and repeated unit changes. Real-object transforms and dimensions remain unchanged through CM/IN changes and project reload.                                                                                                                                                           |
| 3D dimensions and guides            | Pass                  | Real speaker annotations and surface/magnetic feedback inspected at two camera angles and zoom levels. Existing annotation, camera and clipping checks pass. Guides stay outside scene membership and saved data.                                                                                                                                 |
| Undo/redo and persistence           | Pass                  | Grid, magnetic and surface gestures restore exact transforms; current and legacy codecs, reload and local preference migration are covered. No general parent/scale serialization was added to the legacy format.                                                                                                                                 |
| Responsive UI and accessibility     | Pass with limitations | Phone toolbar bounds, enlarged text, forced colors, keyboard focus and light/dark visual checks pass in Chromium. Screenshot review includes the updated Snap header and Controls help. Physical mobile devices, Safari and Firefox were not tested.                                                                                              |
| Lifecycle and performance           | Pass with limitations | Dense scene with 50 real catalog objects performs zero additional vertex reads over 40 steady drag updates after preparation; jitter stays below 0.01 inches, guide elements remain bounded and rendering settles after release. Existing GPU-resource/idle and disposal checks pass. This is not an FPS benchmark or exhaustive heap-leak audit. |
| Automated regression suite          | Pass                  | Final production build and all 90 Chromium end-to-end tests passed. No separate type-check script exists in this JavaScript repository.                                                                                                                                                                                                           |

## Issues resolved

1. Magnetic target preparation did not notice a child becoming hidden during a
   drag. Both strategies now share a per-update structural signature covering
   descendant transforms, visibility, material visibility and geometry versions.
   A regression verifies the stale target is released.
2. Unsnapped movement under a transformed parent took an unnecessary world/local
   round trip, changing the last bits of native coordinates. Corrections are now
   applied only when the resolver changes position; exact-coordinate coverage
   catches this regression.
3. The added Snap controls overflowed the phone header during resizing and with
   enlarged text. The narrow header now grows with its content and its actions
   wrap. Both affected browser checks pass.
4. Slightly uneven authored Bekant tabletop triangles were excluded by the
   original 0.001-inch coplanarity cutoff. Target planes now tolerate 0.01 inches
   (0.254 mm) and group nearby heights without rounding-bin seams. A regression
   covers uneven triangles, and both imported L-shaped desks pass browser checks.
   Contact on these meshes is approximate within that tolerance. Lowest-vertex
   accessory probing still uses 0.001 inches; genuine tilted-support rejection
   remains covered.
5. The catalog surface browser test imported unbundled implementation modules,
   making it incompatible with production output. It now independently probes
   rendered triangles with a raycaster and exercises the actual control adapter.
6. Help text now says Alt/Option bypasses all snapping. Reviewed visual baselines
   include the Snap header and shortcut additions. Modal captures first move the
   pointer away, eliminating incidental hover-state differences caused by the
   toolbar's changed button positions.

## Executed checks

All Node/npm commands used Node 24.22.1 from the configured runtime. Dependencies
were installed with the lockfile; dependency versions did not change.

| Command                                                                                                                                                                                                                                     | Result                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci --cache /private/tmp/deskspacing-npm-cache`                                                                                                                                                                                         | Passed after retrying outside the network sandbox; 145 packages installed. One existing high-severity legacy dependency advisory remains.                                                    |
| `npx playwright install chromium`                                                                                                                                                                                                           | Passed.                                                                                                                                                                                      |
| `npm run lint`                                                                                                                                                                                                                              | Passed, including after the final code fixes.                                                                                                                                                |
| `npm run format:check`                                                                                                                                                                                                                      | Passed, including after the final code fixes.                                                                                                                                                |
| `npm test`                                                                                                                                                                                                                                  | Final run: 139 tests passed across 16 files.                                                                                                                                                 |
| `npm run test:e2e -- --output /private/tmp/deskspacing-final-review`                                                                                                                                                                        | Initial production build passed; 78 of 86 tests passed. Eight failures identified the responsive issues, intentional visual changes and production-incompatible test import described above. |
| `npx playwright test responsive.spec.js theme.spec.js --grep 'target sizes\|visual regression\|visual baselines' --output /private/tmp/deskspacing-baseline-results --reporter=list`                                                        | Six checks passed against pre-snapping commit `b52a8ea` in an isolated temporary checkout, after its production build. This distinguished changed behavior from pre-existing failures.       |
| `npx vitest run tests/unit/surface-snapping.test.js`                                                                                                                                                                                        | 27 passed after the tabletop fix; included again in the final 139-test run.                                                                                                                  |
| `npx playwright test surface-snapping.spec.js snapping-review.spec.js --output /private/tmp/deskspacing-surface-final --reporter=list`                                                                                                      | Eight passed after a fresh production build, including real catalog geometry, dense placement and multiple elevations.                                                                       |
| `npx playwright test responsive.spec.js theme.spec.js snapping-review.spec.js --grep 'visual regression\|visual baselines\|real accessories' --update-snapshots=changed --output /private/tmp/deskspacing-reviewed-visuals --reporter=list` | Six passed. Eleven changed screenshots were visually reviewed; changes are limited to intended controls/help and neutral pointer states.                                                     |
| `npm run test:e2e -- --output /private/tmp/deskspacing-final-verified`                                                                                                                                                                      | Passed: production build and 90 tests in 5.2 minutes. This final broad run was warranted by changes to shared geometry preparation and responsive layout.                                    |

Additional affected checks were rerun during diagnosis: transform/surface units,
phone target sizes, Snap toolbar bounds and real-object browser placement. Early
failed iterations are retained in `/private/tmp/deskspacing-review-targeted` and
`/private/tmp/deskspacing-review-confirm`; they are not counted as passing checks.
The final browser log is `/private/tmp/deskspacing-final-verified.log`.

## Remaining boundaries

- Supports are catalog desks and floor geometry. There are no shelf products or
  shelf semantics; raised structures and several usable levels in one product
  would need explicit product regions. Partial overhang is allowed while the
  lowest-region center remains supported. There is no collision prevention.
- Drag preparation checks geometry versions and descendants, but runtime skinning
  or morph animation during a gesture needs further invalidation support.
- Shared geometry/textures remain immutable. No guide GPU meshes or persistent
  animation loop were introduced. Structural checks still scale with nearby
  registered roots; no comparative speedup or universal frame-rate claim is made.
- Missing `drawerDesk` assets and the legacy npm advisory remain open, independent
  of snapping. Development checks also emit existing missing source-map/GSAP
  diagnostics without failing the suite.
- Chromium responsive emulation does not certify mobile hardware, Safari or
  Firefox. Cross-browser/device verification remains separate follow-up work.

Merge recommendation: ready to merge within the supported scope. All final automated checks passed; no unresolved snapping regression was found. The documented
surface and browser boundaries are intentional limitations, not claims of wider
support.
