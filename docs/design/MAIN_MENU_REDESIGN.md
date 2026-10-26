# Main menu and homepage refinement

Implemented 26 October 2026. The modern editor is the visual authority; the
existing design reference remains unchanged.

## Delivered

- A warm, focused entry screen with the editor's wordmark, system typography,
  dark primary actions, olive accent, borders, radii and focus treatment.
- A prominent Setup Creator action, compact desktop navigation and a native
  disclosure on smaller screens. Menus support keyboard activation, Escape with
  focus return, and outside-pointer dismissal; short viewports scroll the menu.
- The five original setup images remain available through labeled, keyboard
  operable buttons. Selection updates the image description and live caption.
  Automatic cycling and the legacy loading overlay are removed from the homepage.
- The original planning message is condensed into one supporting row. The old
  editor screenshot is no longer displayed because it depicts the superseded UI;
  its source asset is preserved, as are all legacy scripts and asset mounts.
- Contact still goes to `about.html`. Email, GitHub, Twitter and attribution
  destinations remain available. `mainApp.html#tutorial` and `#controls` open the
  existing editor help dialogs through their original triggers and focus handling.
  Share URLs already strip fragments; scene state and codecs are unchanged.

## Files and reuse

| Files | Responsibility |
| --- | --- |
| `index.html` | Semantic homepage, navigation, examples and preserved footer destinations |
| `src/home.js` | Manual preview selection and shared menu binding |
| `src/styles/home.css` | Responsive entry-screen layout |
| `src/styles/tokens.css` | Extend existing token scope to the homepage; primary foreground/hover tokens |
| `src/styles/shared.css` | Extract existing reset, controls, brand, icons, focus, skip link and disclosure primitives |
| `src/styles/planner.css`, `mainApp.html` | Consume extracted styles without duplicating the editor design system |
| `src/ui/toolbarMenus.js` | Extract existing disclosure behavior with lifecycle cleanup |
| `src/ui/editorShell.js` | Reuse the menu binder and open explicitly requested help on entry |
| `vite.config.js` | Bundle the homepage module and shared menu code using the existing build |
| `tests/e2e/home.spec.js`, `tests/e2e/planner.spec.js` | Cover new navigation and previews; update the original homepage-to-editor test |
| `docs/design/MAIN_MENU_REDESIGN.md` | Implementation and verification record |

No UI framework, package version, binary asset, scene model, catalog or legacy
route was changed. Historical pages, including the Contact destination, retain
their existing designs. No dark-mode toggle is introduced.

## Verification

Verified with Node 24.22.1, `npm ci`, and `npx playwright install chromium`.

Executed successfully: `npm run lint`, `npm run format:check`, `npm test`
(54 tests), and `npm run test:e2e` (production build and 40 Chromium tests).
After a final homepage-only typography adjustment, the production build and all
seven homepage browser checks passed again, including hover and pressed states.
`git diff --check` also passed. Desktop, laptop, tablet and phone screenshots
were captured and visually inspected; no unexpected homepage JavaScript errors
or failed local resources were observed.

The browser suite covers production output under `/DeskSpacing.com/`, homepage
navigation at 1440, 1280, 834, 390 and 320 CSS pixels, local destinations, all five
images, native navigation without JavaScript, keyboard dismissal/focus, reduced
motion, 200% equivalent viewport reflow and the transition to existing help.
Screenshots are captured in `test-results/home-*` for visual inspection.
External URLs are checked for preservation and safe new-tab attributes; their
remote availability is not certified by the offline browser tests.

The existing suite also exercises development subpaths, actual model loading,
share/restore, catalog controls, lifecycle/disposal, idle rendering and editor
visual baselines. Screenshots verify the established editor appearance survives
the shared-style extraction.

Known limitations remain: the missing `drawerDesk` asset and legacy npm advisory.
The retained Contact page emits existing GSAP missing-target warnings, and its
legacy Bootstrap CSS references a missing source map in development. Chromium
viewport and gesture emulation does not certify physical mobile devices, Safari
or Firefox. No performance benchmark or speedup claim is made.
