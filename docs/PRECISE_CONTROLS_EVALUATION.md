# Precise controls integration evaluation

Evaluation completed across October 29–30, 2026. This report covers numerical
position/rotation, dimensions/resizing, live inspector synchronization, snapping,
projected-bounds spacing, history, persistence, and input behavior.

## Execution environment and results

macOS, Node **24.22.1**, dependencies installed with `npm ci`, Playwright 1.64.1
Chromium (revision 1248), Three.js 0.186.1. Browser tests use the production Vite
build at `/DeskSpacing.com/` with SwiftShader and one worker. Manual checks use
the Codex in-app browser and the same preview build. No dependency versions or
production assets were changed.

| Check                                               | Result                                                                               | Evidence                 |
| --------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------ |
| `npm run lint`                                      | Pass                                                                                 | `final-lint.log`         |
| `npm run format:check`                              | Pass                                                                                 | `final-format-check.log` |
| `npm test`                                          | **185 passed**, 19 files, 464 ms                                                     | `final-check.log`        |
| Targeted precision/responsive browser checks        | **3 passed**, 9.8 s                                                                  | `precision-final.log`    |
| Reviewed visual updates and native gizmo regression | **8 passed**, 41.2 s                                                                 | `targeted.log`           |
| Native-control visual baseline refresh              | **5 passed**, 27.2 s                                                                 | `visual-refresh.log`     |
| Final full `npm run check`                          | **Pass, exit 0**; 185 unit tests and **103 browser tests**, browser duration 5.6 min | `final-check.log`        |

All logs and browser artifacts are in
`/private/tmp/deskspacing-precise-evaluation/`. These are local execution
artifacts, not committed test fixtures. The final combined run does not update
snapshots. Its HTML report is `verified-html/index.html`; `verified-browser/`
contains a copy of the final per-test evidence from the repository's ignored
`test-results/` directory. Earlier
failure evidence remains under `initial-browser/`, `final-browser/`, and
`visual-recheck/`.

Reproduce with Node 24.22.1, `npm ci`, `npx playwright install chromium`, and
`npm run check`. Stop manual preview servers first; the suite owns port 4173.
This evaluation first ran the component commands separately, then reran the
complete combined command after baseline review:

```sh
PLAYWRIGHT_HTML_OUTPUT_DIR=/private/tmp/deskspacing-precise-evaluation/verified-html \
  npm run check
```

## Coverage and evidence

| Required behavior                          | Executed regression coverage                                                                                                                                                                                                                                                                       |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exact coordinates, negative/decimal values | `numerical-transforms.spec.js` commits X = −12.123456789 cm, Y = 80.987654321 cm, Z = −125.5 cm; stored coordinates must equal the unrounded JavaScript cm-to-inch conversion.                                                                                                                     |
| Degree rotation                            | `precise-controls-integration.spec.js` edits all three axes through 45°, 90°, 180°, −90°, 23.456789°, −360.125°, and 0°; stored radians are compared directly with the conversion.                                                                                                                 |
| Physical dimensions and resizing           | Unit/browser dimension suites cover box axes, uniform sphere diameter, custom desktop width/depth with locked height, read-only catalog models, import wrappers, rotation, scale, geometry replacement, and undo.                                                                                  |
| Live input synchronization                 | Numerical UI and native gizmo tests check dragged/snapped coordinates, native rotation, geometry changes, stale drafts, selection switches, focus/blur, and unit toggles without precision loss.                                                                                                   |
| Snapping compatibility                     | Grid, magnetic, surface, and native snapping suites run unchanged alongside numerical regressions. A focused draft commits before a native snapped drag. Exact numerical/spacing edits bypass snapping; subsequent gestures still snap.                                                            |
| Relative placement                         | Unit and browser cases cover all six world directions, rotated and nonuniformly scaled objects, reflected scale in unit fixtures, zero/negative measured clearances, and descendant transforms. Browser tests independently calculate the fixture mesh box gap.                                    |
| Undo/redo                                  | Numerical resizing, combined API edits, native rotation, and one-time spacing restore/reapply snapshots. Repeated spacing adds no extra history; invalid edits preserve state and redo.                                                                                                            |
| Save/load                                  | Real generated share links reopen with exactly equal position, rotation, and primitive dimension records. Spacing saves only its resulting position; reference choices are not persistent constraints.                                                                                             |
| Validation/usability                       | Empty fields, standalone minus, incomplete exponents, Infinity, coordinate overflow, nonpositive dimensions, unavailable references/bounds, locks, and active gestures are rejected. Enter/blur/Escape, draft preservation, 320/390/768 px controls, themes, and responsive layouts are exercised. |

The new evaluation regressions are in
`tests/e2e/precise-controls-integration.spec.js`; the native manipulation check
was strengthened in `tests/e2e/planner.spec.js`. A new unit case in
`tests/unit/precise-spacing.test.js` exercises 10 cm placement around origins
0 and ±999900 scene units, all six directions, and 100 repeated applications
per case. Repeated applications must be no-ops with bit-identical positions.
Parent conversion, allocation failure, resource ownership, history limits, and
legacy serialization are also covered by the existing unit suites.

## Numerical contract

One scene unit is **one inch, exactly 2.54 cm**, as established by the shared
conversion module, primitive dimensions, catalog dimension conventions, and
legacy records. Numerical position represents the authored root origin in
world space, with Y up. Rotation is parent-local XYZ Euler degrees in the UI
and radians in the engine. W/H/D use the authored object dimension frame,
including relevant descendant transforms and scale; they are not the size of
the world-aligned enclosing box.

Primitive parameter dimensions retain double precision. Render vertices use
Float32, so parameter dimensions and measured mesh bounds can differ slightly.
Spacing projects the existing authored geometry bounding box through the full
world matrix. It measures signed boundary separation along one chosen axis,
not Euclidean distance, penetration depth, or exact mesh-surface distance.

The 10 cm acceptance tolerance is **1e-8 cm absolute error** for the tested
fixtures, including near-limit coordinates. The browser fixture independently
measured the following rotated/scaled box gaps:

| Direction | Geometry gap (cm)  | Spacing API readout (cm) |
| --------- | ------------------ | ------------------------ |
| +X        | 10                 | 10                       |
| −X        | 10                 | 10                       |
| +Y        | 9.999999999999996  | 9.999999999999996        |
| −Y        | 10                 | 10                       |
| +Z        | 10.000000000000004 | 10.000000000000004       |
| −Z        | 10                 | 10                       |

Maximum observed error in that browser fixture: **3.552713678800501e-15 cm**.
The raw values are attached as `clearance-evidence.json` in the browser test
output. This tolerance concerns arithmetic on the selected bounds, not physical
accuracy of assets. Unfocused labels use six decimal places, with up to
0.0000005 cm display error; full precision remains in focused fields/tooltips
and is never replaced by rounded display text.

## Manual UI verification

Using visible controls in the in-app browser:

1. Added two boxes. Edited X to **−12.3456789 cm**, Y rotation to **45.125°**,
   and width to **32.123456789 cm** using Enter and blur.
2. Entered an incomplete minus sign, attempted a commit, and cancelled with
   Escape. The scene retained its previous valid transformation.
3. Switched objects, chose the other box as a reference, and applied **10 cm**
   along +X. The coordinate field and measured clearance updated immediately.
4. Used More → Undo and Redo. The coordinate and measured gap reverted and
   returned together.
5. Generated a Share link, reopened it, and selected the rotated box. Full
   coordinate/width precision and rotation survived. Measuring toward the
   other box along −X still showed **10 cm**.
6. Reviewed the phone inspector at 390 × 844. After the CSS correction below,
   spacing dropdowns were 16 px with 44 px control heights. Additional automated
   checks cover 320, 390, and 768 px viewport widths.

Screenshots are `manual-spacing-desktop.jpg` and `manual-spacing-phone.jpg` in
the evidence directory. Native dragging/rotation/snapping were exercised with
Playwright pointer input; they are not claimed as additional manual checks.

## Defects and corrections

- **Compact spacing dropdown typography:** a more specific spacing selector
  overrode the editor's 16 px compact-input rule, leaving dropdowns at 12 px.
  Corrected the responsive selector in `src/styles/responsive.css`. Manual
  verification and the new responsive regression confirm 16 px text, at least
  44 px target height, and no horizontal overflow at the tested widths.
- **Outdated visual baselines:** the initial full browser run had **95 passes
  and 5 failures**, all inspector snapshot mismatches caused by the new controls.
  Reviewed actual images and updated five inspector baselines. The intentional
  editing-help text also required four dialog baseline updates when those tests
  progressed past the inspector comparison. No screenshot thresholds were
  loosened.
- **Native-control snapshot differences:** a later full run had **98 passes
  and 5 visual failures**. An isolated recheck reproduced all five failures.
  Their reported differences were 19–23 pixels in native select arrows,
  including the unchanged home menu. Reviewed and refreshed nine menu/library
  baselines. Pixel analysis found arrow glyph differences and, in phone sheets,
  small border antialiasing differences. The precise host-rendering cause was
  not established; no application layout change was made to suppress it.
  `native-control-baseline-differences.json` records the exact pixel comparison.
  The refresh run passed all five visual tests; the subsequent full run uses
  the original strict comparison settings.
- **Formatting:** the first format check flagged eight implementation/test
  files. Formatted those files only; no bulk legacy/vendor reformatting.
- **Test synchronization:** the new multi-viewport regression initially read
  the panel state before the responsive layout transition completed. It now
  waits for the expected layout before deciding whether to open the panel.
  An interrupted run left a preview server behind; it was stopped before rerun.
  The blocked retry is not counted as a passing test.

No transformation or snapping algorithm defect was found in the executed
precision scenarios. The only production behavior correction during this
evaluation was the compact-layout CSS change.

## Limitations and readiness

The complete final `npm run check` exited successfully: lint, formatting,
185 unit tests, and all 103 browser tests passed with no retries or skipped
browser cases. The precise-control features are ready for the tested desktop
Chromium workflow, with responsive emulation and manual in-app browser evidence.
No unresolved precise-control functional failure was observed. This does not
establish a clean security bill of health or broad cross-browser/mobile release
certification; the following limitations remain.

- Chromium with software WebGL and responsive/touch emulation does not certify
  physical mobile devices, mobile keyboards, Safari, Firefox, or hardware GPU
  combinations. No comprehensive assistive-technology audit was performed.
- Native-control and font screenshot baselines are macOS-specific. Small native
  rendering differences required explicit review during this evaluation and
  may require another review on a different host.
- Bounding boxes can include empty space around irregular or curved models;
  the UI/documentation explicitly identify that measurement convention.
- The editor has no user grouping feature or general root-scale editor.
  Transformed-parent math is tested, but arbitrary parent hierarchies/root
  scales are not persisted by the existing legacy format. Supported editor
  resize operations persist geometry parameters normally.
- The known missing `drawerDesk` asset and legacy npm advisory remain open.
  This evaluation does not claim a fresh security audit or an asset audit.
- Existing missing Bootstrap source-map and GSAP missing-target warnings occur
  in the development-route test. They did not fail the checks and were not
  introduced by precise controls.
- No deployment was performed. Test results describe this working tree and
  the tested browser environment, not universal platform certification.
