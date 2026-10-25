# DeskSpacing UI implementation plan

Stage 1 handoff · 25 October 2026 · baseline revision `d0ee00c`

This is an ordered checklist for future implementation. **No checklist item
below has been implemented by Stage 1.** The authoritative design decisions,
feature inventory, tokens, field mappings, responsive rules and acceptance
criteria are in [UI_UX_REDESIGN_SPEC.md](UI_UX_REDESIGN_SPEC.md). The visual
direction is [ui-reference.png](ui-reference.png).

Keep vanilla JavaScript, the current Three.js engine and its service boundaries.
Do not introduce editor capabilities, dependency upgrades, deployments, asset
cleanup, or retained-page rewrites while implementing this plan. Proposed new
filenames below are recommendations, not evidence that those modules exist.

## Working rules and checkpoints

- Use Node 24.22.1 from `.nvmrc`, `npm ci`, and the installed Chromium required by
  Playwright. Leave ports 4173 and 5176 available for automated verification.
- Begin each patch with a clean understanding of local changes. Preserve the
  supplied reference image and unrelated work.
- Prefer a sequence of small reviewable patches. Keep the editor usable at every
  checkpoint; do not land a shell whose cards or controls are inert.
- UI adapters read forms; actions mutate objects; the store owns membership;
  live Three.js transforms remain authoritative. Catalog/configuration/codecs
  remain free of DOM and Three.js imports.
- Preserve IDs, wire types/delimiters, authored transforms, filename case/spaces,
  first-root GLTF behavior, transactional replacements/restores, generation
  guards and exactly-once disposal. Do not add production test/debug globals.
- Keep the baseline behavior tests. Adjust selectors only when the represented
  UI deliberately changes. Add tests for user-visible behavior and integration
  risks, not assertions that simply repeat markup or private implementation.
- Run targeted tests during each patch, then `npm run check` at the Stage 2 and
  Stage 3 exits. Do not run performance benchmarks concurrently with tests.

## Stage 2 — Desktop UI implementation

### 2.1 Establish baseline and freeze UI coverage

**Files to inspect:** `mainApp.html`, `src/catalog/products.js`,
`src/catalog/configuration.js`, `src/ui/catalogPanel.js`,
`tests/fixtures/catalog-baseline.json`, `tests/e2e/planner.spec.js`,
`docs/PERFORMANCE.md`.

- [x] Confirm the working revision and the current suite results before editing.
- [x] Capture desktop screenshots at 1280 × 720, 1440 × 900 and 1920 × 1080:
      default scene, an expanded variation family, Share / Save and Help.
- [x] Use the specification's 11-category / 41-card / 103-choice inventory as the
      parity checklist. Preserve 104 catalog records, including the three
      non-card records (`drawerDesk`, `TKLKeyboardYGB`, `mediumRGBMousepad`).
- [x] Capture representative share links/scene snapshots using existing fixtures
      and the exported app in tests; include nonuniform Box dimensions, a custom
      desk material, a no-stand monitor and a keyboard style.
- [x] Record that startup may already have a selection. Do not hardcode a
      particular startup selected object in visual assertions.

**Done when:** every visible choice has a known destination and a baseline exists
for scene/sharing behavior. No runtime changes are needed for this checkpoint.

### 2.2 Extract presentation metadata without changing the product model

**Files:** new `src/catalog/presentation.js`; existing
`src/catalog/products.js`, `src/catalog/configuration.js`,
`tests/unit/catalog.test.js`; new focused presentation tests if useful.

- [x] Define ordered category and card records using existing product/family keys.
      Include display names, explicit thumbnail URLs, existing descriptions,
      option values/labels, preview mapping, and configuration kind.
- [x] Extract names and options from current HTML, not guesses based on ID casing.
      Preserve `YPGrad` / `YPGrade`, `31` / `43` option values and their fractional
      inch labels, Primary/Secondary audio options and all monitor NoStand values.
- [x] Keep technical data in `products.js`: do not duplicate model paths,
      positions, rotations, offsets or sharing types in presentation metadata.
- [x] Use `resolveProduct` to validate all exposed family choices. Explicitly
      distinguish compatibility-only records from addable cards; keep `floor`
      out of the library.
- [x] Preserve the custom desk's four explicit material preview mappings.
      Do not assume every thumbnail is `<productId>.jpg`.
- [x] Check referenced thumbnails via `siteSourcePath()` and identify a neutral
      fallback for missing images. Do not replace missing models or alter rights.
- [x] Add meaningful parity checks: all baseline UI choices resolve; option
      values produce their original product IDs; no expected category disappears.

**Done when:** the schema can generate the entire existing library without
changing catalog compatibility tests. The old UI may still render at this point.

### 2.3 Build the desktop shell and scoped visual foundation

**Files:** `mainApp.html`, `src/styles/planner.css`; optional new
`src/styles/tokens.css`; new `src/ui/editorShell.js`; `src/app/createApp.js`.

- [x] Add the `.planner-app` root, compact header, named library/workspace/inspector
      regions and CSS Grid shell. Implement ≥1440 and 1280–1439 widths from the
      specification, with independent panel scrolling.
- [x] Keep exactly one `#threeCanvas` inside `#rightSideContainer`; preserve that
      container as the renderer's measured host, excluding both sidebars.
- [x] Remove the canvas's 600px minimum, body-overflow assumptions that clip
      controls, duplicate canvas-fallback controls and the stray stand checkbox.
- [x] Put one Reset camera button and hints outside the canvas. Use actual
      buttons with names, not clickable glyphs.
- [x] Establish all tokens, type scales, borders, radii, focus styles, interactive
      states and local SVG icon treatment. Load scoped overrides after theme/
      compatibility CSS. Remove conflicting modern markup utility classes.
- [x] Retain shared Bootstrap/Popper/theme files and retained pages. Do not edit
      minified/vendor CSS or bulk-format the existing HTML.
- [x] Implement library collapse/reopen and initially hidden inspector layout.
      Ensure reopening does not recreate the renderer or reset the camera.
- [x] Build baseline semantic labels and focus-visible styles now; accessibility
      is not postponed entirely to Stage 3.

**Validation:** inspect default canvas bounds at desktop sizes and 720px height;
run relevant planner resize and performance tests. Confirm the center expands
when a panel closes, camera aspect tracks it, and the scene stops rendering idle.

**Done when:** the shell visually matches the reference hierarchy and the existing
catalog and controls still work inside it. Temporary migration markup must not
introduce duplicate IDs.

### 2.4 Generate the catalog and implement local discovery

**Files:** `src/ui/catalogPanel.js`, `src/ui/bindPlannerUI.js`,
`src/app/createApp.js`, `mainApp.html`, `src/styles/planner.css`,
`tests/e2e/planner.spec.js`.

- [x] Generate the 41 cards and their forms from presentation metadata before
      binding UI listeners. Keep one form per family and one shared options
      source for its Add/Replace actions.
- [x] Replace handwritten catalog markup with generated lists, a labeled search
      field, native category selector, result count and no-results state.
- [x] Implement two-column cards and full-row inline Options areas. Keep fixed
      products directly addable; use Options for families and primitives.
- [x] Preserve `data-action`, `data-product`, `data-family`, `data-replace` and
      form IDs during migration. Filter visibility without rebuilding inputs or
      losing values, focus, pending state or event listeners.
- [x] Match names/category/variation labels and IDs locally, without changing a
      selected variation when a query happens to match another option.
- [x] Preserve monitor stand, keyboard preview and custom-desk preview behavior.
      If adopting checkbox `.checked`, migrate reading/binding/tests together.
- [x] Label every existing dimension in inches; preserve the specification's
      ID-to-geometry mapping and the custom desk's 1-inch thickness.
- [x] Show Use desk with replacement helper text. Keep Add and Replace distinct
      for other cards; explain unavailable replacement when selection is null.
- [x] Implement per-card busy/error treatment, retry through the same action,
      stale-result handling (`null` is not success), and missing-thumbnail fallback.
- [x] Use safe text insertion; do not interpolate a query or error into HTML.
- [x] Remove superseded handwritten card markup only after generated parity is
      verified. Keep asset files and compatibility product records intact.

**Validation:** category/variant coverage, filter/clear behavior, retained values,
preview changes, repeated add, replacement while selection changes, load failure,
and primitive share/restore. Use unequal Box values to catch axis swaps. Update
accordion-specific test helpers to the new category/Options flow while retaining
their scene assertions.

**Done when:** every old exposed configuration can be added/replaced and saved;
the library is compact, searchable and driven by data.

### 2.5 Connect the selected-object panel to the existing selection service

**Files:** `src/interactions/selection.js`, `src/interactions/keyboard.js`,
optional new `src/interactions/commands.js`, new `src/ui/selectionPanel.js`,
`src/ui/bindPlannerUI.js`, `src/app/createApp.js`,
`tests/unit/selection.test.js`, `tests/e2e/planner.spec.js`.

- [x] Add a minimal selection subscription returning cleanup; notify for changed
      pick/unselect/delete state. Initialize subscribers from current selection.
      Do not add a general event bus or frame polling.
- [x] Derive inspector name/variation/thumbnail from `pickedObject` and metadata;
      provide sensible fallback text for restored compatibility-only products.
- [x] Close the panel when selection is null. Its Close button calls deselect;
      it does not maintain another hidden selected-object state.
- [x] Preserve programmatic `NoSelect` selection behavior. Hide movement tools
      for it without silently making it pickable or deleting its record.
- [x] Share existing move/rotate, axis visibility and gizmo-size commands between
      keyboard and buttons. Replace closure-only mode bookkeeping with actual
      TransformControls mode so R and button presses remain synchronized.
- [x] Keep mode-specific axis behavior and the 0.1 minimum gizmo size. Do not add
      numeric transforms, scale, snap or new drag controls.
- [x] Route Remove through `actions.remove` for the current selected root; keep
      existing keyboard deletion and deselection semantics.
- [x] Preserve library focus after adding. Return focus to the workspace if the
      focused inspector disappears; selection by pointer must not steal focus.
- [x] Suspend scene shortcuts in dialogs and editable controls; scope character
      shortcuts to workspace focus. Document this deliberate safety/usability
      change in Help and update tests to focus the workspace before shortcuts.
- [x] Defer panel geometry changes until an active gizmo drag ends/cancels.
- [x] Unsubscribe and remove listeners on app disposal/HMR. Guard late async UI
      completions against detached elements and disposed controllers.

**Validation:** actual pointer pick, Add, Replace, C, D/Delete/Backspace, reset/
restore lifecycle, empty-space click, `NoSelect`, failed replacement, and panel
open/close during interaction. Test mode buttons interleaved with R and axis keys.
Verify keyboard input in forms and open dialogs never deletes objects.

**Done when:** the inspector reflects actual selection through every existing
path, adds no new manipulation capability, and reserves no width when empty.

### 2.6 Consolidate header, sharing and help

**Files:** `mainApp.html`, `src/ui/bindPlannerUI.js`, `src/ui/editorShell.js`,
`src/ui/feedback.js`, `src/app/createApp.js`; desktop-local help setup if needed.
Inspect `src/legacy/ui.js` but avoid changing behavior shared with retained pages.

- [x] Keep DeskSpacing branding; add only static Desk setup context.
- [x] Move existing navigation destinations to More. Keep Contact → `about.html`
      and the existing Twitter URL; mark the current editor route.
- [x] Keep one Share / Save action, generating a fresh link when opened. Preserve
      active origin/path URL creation and the current codec.
- [x] Correct share/dialog heading IDs, field labeling and read-only link field
      type. Explain manual copying and new-link generation after edits; no saved
      badge, export menu or fake Copy button.
- [x] Move Keybinds, Beginner Tutorial and Welcome / Updates into Help. Remove
      auto-show only from the modern startup modal; preserve access to its content.
- [x] Correct help text for C (deselect), Replace (X/Z preserved; no enforced
      same-type restriction), existing inch inputs and OS-level screenshots.
- [x] Preserve all seven tutorial topics with visible text. Stop auto-advance,
      avoid nested modals, and supply text-first reduced-motion presentation.
- [x] Keep unsupported settings hidden/absent; do not wire imperial/metric radios.
- [x] Style loading/errors consistently with the new surfaces and expose status
      without blocking the rest of the scene or swallowing pointer events.

**Validation:** Share after live translation/rotation, reopen generated link,
historical mobile primitive payload, empty setup, invalid initial link fallback,
failed later restore, modal Escape/focus return, tutorial next/previous, and
unchanged static destinations. Keep tests for retained Bootstrap tooltips/routes.

**Done when:** the header is restrained, every action works, and saving/help copy
matches repository capabilities.

### 2.7 Verify appearance, performance invariants and desktop completion

**Files:** `src/scene/createScene.js` only for deliberate background presentation;
`src/styles/planner.css`, `tests/e2e/planner.spec.js`,
`tests/e2e/performance.spec.js`, design documentation.

- [x] Apply/review the proposed warm scene background, with explicit invalidation.
      Do not alter light, fog, camera, materials, tone mapping or geometry to
      imitate the drawn reference.
- [x] Compare the same scene/camera with default models, a dark and light keyboard,
      no-stand monitor, desk materials, primitives and a chair. Keep original
      model appearance and distinct gizmo axes legible.
- [x] Verify canvas bounds and raycasting after each sidebar change. Ensure
      controls do not overlap focused elements or intercept the canvas broadly.
- [x] Confirm DPR cap, demand rendering, hidden-tab suspension, resource ownership,
      failed/stale operation cleanup and disposal still pass existing checks.
- [x] Run `npm run check`; inspect screenshots at the three desktop sizes and
      short laptop height. Compare against the specification's Stage 2 criteria.
- [x] Record intentional visual changes, test evidence and any remaining issues.
      Do not claim speedups without the documented benchmark.

**Stage 2 gate:** desktop feature parity, truthful controls, functional contextual
panel, accessible basic DOM semantics and all required regression checks pass.
Do not proceed by leaving unsupported placeholder buttons for later work.

## Stage 2 implementation record — 25 October 2026

Implemented against baseline `c730477`. Runtime remains vanilla ES modules, the
existing Three.js engine and the original actions/store/sharing boundaries.
No model, texture, thumbnail, dependency or retained-page files changed.

### Delivered components and ownership

- `mainApp.html`: compact toolbar, Help/More disclosures, named library/workspace/
  inspector regions and refreshed sharing, controls, welcome and tutorial dialogs.
- `src/styles/tokens.css` and `planner.css`: scoped warm surfaces, type, reusable
  controls, focus states, desktop proportions, scrollable panels and restrained
  error/loading treatments.
- `src/catalog/presentation.js`: the 41 extracted cards in eleven categories,
  all original options, explicit thumbnail/material mappings and identity lookup.
  All 103 exposed choices resolve; the three compatibility-only records stay out
  of the add library. The technical catalog/configuration and codec are unchanged.
- `src/ui/catalogRenderer.js`, `catalogPanel.js`, `bindPlannerUI.js`, `dom.js`:
  stable generated controls, local search/category filtering, one expanded options
  area, native dimension validation, preview changes, thumbnail fallbacks and
  isolated pending/error state. Stand reading now uses checkbox `.checked`.
- `src/interactions/selection.js`, `commands.js`, `keyboard.js`, `pointer.js`:
  changed-selection subscription, shared existing manipulation commands, actual
  control state, workspace focus and dialog/editable-field shortcut guards.
- `src/ui/selectionPanel.js` and `editorShell.js`: derived identity and thumbnail,
  existing commands/removal, no-width empty inspector, library disclosure,
  deferred geometry changes during gizmo drags and lifecycle cleanup.
- `src/app/createApp.js`: composition and cleanup of these adapters. The existing
  ResizeObserver and canvas-relative pointer math handle changing panel widths.
  `createScene.js` changes only background to `#E7E7E1`, explicitly invalidating
  the scene. Lights, materials, fog, camera, models and resource rules remain intact.

See [ARCHITECTURE.md](../ARCHITECTURE.md#desktop-ui-state-and-canvas-integration)
for extension guidance and the actual data/selection/canvas lifecycle.

### Deliberate deviations and visual differences

- An expanded card occupies a full library row, with a compact preview above its
  options, rather than inserting a separate options row after a paired card row.
  This preserves logical DOM/focus order and makes the selected configuration
  unambiguous. The form remains mounted when collapsed or filtered.
- Shell rows use CSS Grid; the three variable-width body regions use flex sizing.
  The specified desktop widths and measured canvas-host contract are unchanged.
- Existing thumbnails contain baked backgrounds and mixed framing. They are
  contained in consistent neutral wells without modifying the source files.
- The live scene retains its original textured desk, floor, camera, lighting and
  colored gizmo. It intentionally differs from the reference's illustrated desk,
  grid and selection outline. No grid, invented numeric properties, import/export,
  autosave, undo/redo, units conversion or settings controls were added.
- The known implausible MX Master width stays in historical library copy but is
  omitted from inspector details; no dimensions were inferred from meshes.
- Opening a Help dialog closes the disclosure; dismissal restores focus to the
  visible Help summary. This avoids returning focus to a hidden menu item.
- Desktop default selection remains dependent on asynchronous startup completion;
  it is not forced to the monitor to imitate the reference.
- Compact/mobile policies remain Stage 3 work. The current small-width fallback
  does not constitute the planned drawer/sheet implementation or touch support.

### Verification record

- Node 24.22.1, `npm ci`, and pinned Chromium installation verification completed.
- Before edits: lint, formatting, 50 unit tests, production build and all 18
  Chromium browser tests passed. Baseline screenshots captured default scene,
  expanded keyboard family, sharing and controls at 1280 × 720, 1440 × 900 and
  1920 × 1080. Existing browser tests established primitive/material/stand/style
  share-and-restore behavior; a default snapshot/link was also captured.
- After integration: all original 18 browser behaviors passed after intentional
  selector changes. Seven added UI tests passed for all-category filtering and
  retained options, selection commands/focus/shortcut safety, actual raycasting
  after panel/viewport changes, renderer identity and camera preservation, deferred
  drag layout, unequal primitive axes and reduced-motion tutorial topics, plus
  stale replacement cleanup. Presentation/selection additions bring unit coverage
  to 53 passing tests.
- No production debugging globals, dependency/lockfile drift, original asset
  changes, model substitutions, hosting changes or deployment were introduced.
  Asset audit/optimization and performance benchmark runs were not needed; no
  speedup claim is made. Existing idle-render/cache/DPR regressions passed.

Visual review used Chromium 156.0.8078.4 at 1600 × 900, 1440 × 900 and 1366 × 768,
plus 1280 × 720 and 1920 × 1080. Reviewed default setup, selected monitor, no-stand
monitor, All White/Nightrunner keyboards, all four custom-desk materials, a
nonuniform box, chair, sharing and tutorial. Models, text, sidebars and controls
remain legible and aligned; baked thumbnail backgrounds and authored no-stand
monitor height/custom-desktop geometry are retained intentionally. The capture
run reported zero JavaScript errors, HTTP failures or duplicate IDs.

Visual artifacts are local under `/private/tmp/deskspacing-ui-baseline/` and
`/private/tmp/deskspacing-ui-stage2/`. They are unmodified browser screenshots,
not approved golden files.

**Final aggregate result:** `npm run check` passed on the completed implementation:
lint, formatting, all 53 unit tests, production build, and all 25 Chromium browser
tests (1.9 minutes). The design implementation plan also passed its explicit
Prettier check with `--ignore-path /dev/null`; `git diff --check` passed. Original
assets, dependency files, technical catalog/configuration, models, state actions
and sharing codecs have no diff. All temporary preview servers were stopped.

Verification exposed and corrected two focus-return edges (closed Help disclosures
and a closed library). A gizmo test that projected before the inspector's resize
settled now waits for the camera aspect/render and confirms the X handle before
dragging; three consecutive runs passed. Primitive field validation shares the
codec's existing maximum and accepts every positive size without inventing a
minimum. A regression exercises a 0.0001 × 7 × 11 inch box through share/restore.

### Stage 3 attention

Complete the 1024–1279 single-docked-panel policy, tablet/phone sheets, short-screen
and virtual-keyboard behavior. Review physical touch, Safari/Firefox, screen
readers, forced colors, contrast and 200% zoom. The modern mobile warning remains.
The canvas still lacks complete keyboard object discovery and non-drag transform
alternatives; full WCAG conformance is not claimed. Historical tutorial GIFs show
the old UI, with current text explaining the revised controls. The missing
`drawerDesk` asset and retained legacy npm advisory remain open. Non-fatal retained
marketing GSAP/missing CSS source-map warnings are unchanged.

## Stage 3 — Responsive behavior, accessibility and polish

### 3.1 Adapt panel presentation to available space

**Files:** `src/ui/editorShell.js`, `src/ui/selectionPanel.js`,
`src/ui/catalogPanel.js`, `src/styles/planner.css`, `mainApp.html`.

- [ ] Implement the 1024–1279px one-docked-panel policy. Objects and Selected
      switch presentation without clearing selection or form choices.
- [ ] Implement tablet modal library drawer and compact non-modal selected bar;
      implement phone bottom sheets and the same compact selected bar.
- [ ] Use one controls subtree per feature; do not duplicate forms/IDs for desktop
      and mobile. Close obsolete backdrops when crossing breakpoints.
- [ ] Ensure at most one expanded modal surface is open. Restore focus and normal
      canvas interaction when it closes; prevent click-through on the backdrop.
- [ ] Keep canvas-mounted resize behavior for docked/compact bars; overlays leave
      its geometry unchanged. Never unmount/reinitialize the renderer for layout.
- [ ] Implement 320px one-column cards, short-height dialog adaptation, safe-area
      padding, dynamic viewport height and scrollable virtual-keyboard forms.
- [ ] After a successful phone Add, reveal the scene; leave the sheet open on
      error and do not announce a stale discarded completion as success.
- [ ] Preserve pending operations and entered options while resizing or rotating
      the viewport. Check that a pending action finishing cannot reopen an old
      sheet or move focus unexpectedly.

**Validation:** 1024 × 768, 768 × 1024, 390 × 844, 320 × 568 and 844 × 390;
also transition between breakpoints with selection, pending loads and errors.

### 3.2 Verify touch and pointer coexistence

**Files:** `src/interactions/pointer.js` and `src/scene/createScene.js` primarily
for verification; `src/ui/editorShell.js`, `src/styles/planner.css`,
`tests/e2e/planner.spec.js`; dedicated responsive browser test file if clearer.

- [ ] Keep OrbitControls' current one/two-touch interactions and TransformControls.
      Do not add document-wide touch suppression or change drag conventions.
- [ ] Verify library scroll and sheet actions never rotate/pick the scene behind
      them. Touch targets are at least 44px; screen space around the gizmo remains
      sufficient with the compact inspector.
- [ ] Exercise pointercancel and interrupted gizmo drags; confirm camera controls
      re-enable and deferred panel layout changes flush safely.
- [ ] Check actual touch-device orbit, pan/zoom, selection, add/replace, gizmo and
      share flows in portrait and landscape. Record device/browser versions.
- [ ] Remove the modern desktop-only user-agent alert in `src/app/pageSetup.js`
      only after these checks establish usable responsive behavior. Do not alter
      retained `mainAppMobile.html` routing or behavior.

**Done when:** responsive UI and physical touch evidence agree. If physical
devices are unavailable, record that verification gap explicitly and keep the
mobile-support decision open; Chromium emulation is insufficient certification.

### 3.3 Complete accessibility review

**Files:** modern `mainApp.html`, `src/ui/*`, `src/interactions/keyboard.js`,
`src/styles/planner.css`, UI behavior tests and Help content.

- [ ] Audit landmarks, headings, labels, unique IDs, accessible names, native
      controls, state attributes and focus order. No filtered/hidden control
      remains tabbable.
- [ ] Test keyboard-only library search/options, add/replace, contextual buttons,
      share dialog, Help and More. Verify field editing/browser shortcuts remain
      untouched; scene shortcuts require workspace focus and pause for modals.
- [ ] Verify modal focus containment, Escape, visible Close, return focus,
      non-modal bar behavior and focus after removal/deselection.
- [ ] Measure token contrast in normal/hover/pressed/error states. Review focus
      ring clipping and forced-colors behavior. Decorative light borders must
      not be the only identifying boundary of a control.
- [ ] Review with a screen reader: selection changes, counts, loading, invalid
      input, failed add/restore, fallback defaults and fresh-link status. Avoid
      announcing every pointer frame or every intermediate loading object.
- [ ] Verify positive/finite dimension validation on paste as well as typing;
      maintain the old dimensions mapping and provide associated error messages.
- [ ] Check 200% zoom, text enlargement, 320px reflow, virtual keyboard and
      focused controls near sticky headers/footers.
- [ ] Verify reduced motion disables transitions/auto-advance and does not load
      animated tutorial GIFs in the text-first mode. Retain all tutorial topics.
- [ ] Document remaining keyboard scene-navigation/non-drag manipulation barriers.
      Do not claim full WCAG 2.2 AA conformance or silently implement a new
      manipulation system to close them during this scope.

**Done when:** all specified DOM accessibility requirements are met and verified;
remaining canvas limitations are clearly recorded, not concealed by a generic
“accessible” claim.

### 3.4 Polish loading, empty, error and transition states

**Files:** `src/ui/feedback.js`, `src/ui/catalogPanel.js`,
`src/ui/selectionPanel.js`, `src/ui/editorShell.js`, `src/styles/planner.css`.

- [ ] Review fresh startup, successful empty setup, search with no results,
      failed GLB/texture, missing thumbnail, invalid dimensions and bad URL.
- [ ] Keep loading labels stable in width, field values intact after error and
      retry obvious. No invented progress percentage or blank white canvas state.
- [ ] Verify errors remain readable inside an open drawer without duplicate
      assertive announcements in both drawer and workspace.
- [ ] Confirm inspector updates do not flash obsolete objects during transactional
      replacement and that stale async completions cannot change hidden UI.
- [ ] Review long names/categories, all 14 family forms, all materials and every
      compact toolbar with no hover-only essential affordance.
- [ ] Confirm transitions honor reduced motion and sidebar resizing does not
      animate camera or add continuous renders.

### 3.5 Final verification and handoff

**Files:** `tests/e2e/planner.spec.js`, `tests/e2e/performance.spec.js`,
`tests/e2e/development.spec.js`, relevant `tests/unit/*`,
`docs/ARCHITECTURE.md`, these design documents as necessary.

- [ ] Run `npm run lint`, `npm run format:check`, `npm test`, and
      `npm run test:e2e` (or `npm run check`) using Node 24.22.1.
- [ ] Preserve root/subpath links and assets, both primitive delimiters, all
      categories/options, failed/stale transactions, raycasting, resources,
      idle rendering, tutorials and retained routes in regression coverage.
- [ ] Explicitly format/check design Markdown using Prettier with
      `--ignore-path /dev/null`; existing ignore rules do not include this folder.
- [ ] Review final desktop/tablet/mobile screenshots against the reference's
      hierarchy, not its unsupported controls or illustrated 3D objects.
- [ ] Record real browser/device and assistive-technology testing separately from
      automated Chromium results. List any unavailable coverage honestly.
- [ ] If assets changed, run `npm run assets:audit`; optimized copies also require
      `npm run assets:optimize` verification and visual inspection. Preserve
      originals and document rights in `THIRD_PARTY_NOTICES.md`.
- [ ] If performance changed materially, use the documented isolated harness;
      compare like-for-like scenes/viewports and avoid unsupported speedup claims.
- [ ] Update architecture documentation for the generated catalog, selection
      subscription, shared commands and UI lifecycle ownership actually shipped.
- [ ] Confirm no dependency/lockfile drift, production globals, CNAME/deployment,
      unrelated cleanup, or new editor capability slipped into the diff.
- [ ] Keep the missing `drawerDesk` asset and legacy npm advisory explicitly open.
      Passing Chromium does not certify mobile, Safari or Firefox.

**Stage 3 gate:** the specification's responsive/UI accessibility criteria pass,
functional compatibility remains intact, and remaining canvas/device limitations
are documented with evidence. Publishing is a separate task.

## Suggested review boundaries

1. Presentation metadata and parity coverage.
2. Desktop shell/tokens plus generated library and existing actions.
3. Selection notifications, contextual controls and shared command handling.
4. Header/share/help migration and desktop verification.
5. Compact layouts and touch interaction verification.
6. Accessibility, state polish, full regression checks and documentation.

Review scene/sharing snapshots independently of visual screenshots. A good-looking
shell is insufficient if it changes authored placement, hides a variation or
breaks a legacy setup link.
