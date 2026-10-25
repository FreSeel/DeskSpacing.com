# DeskSpacing UI/UX redesign specification

Stage 1 · 25 October 2026 · audited revision `d0ee00c`

This document specifies the next two implementation stages. **Stage 1 changes
documentation only.** It does not implement the design, change the renderer, or
authorize deployment. Follow [UI_IMPLEMENTATION_PLAN.md](UI_IMPLEMENTATION_PLAN.md)
for the ordered work.

## 1. Evidence, scope, and current UI assessment

### Evidence and confidence

- **Verified in source:** the modern entrypoint, service interfaces, catalog,
  HTML controls, styles, handlers, sharing codec, resource lifecycle, routing,
  tests, and build configuration cited below were inspected directly.
- **Visually verified:** [ui-reference.png](ui-reference.png) was inspected. The
  current planner was opened locally in the in-app browser at 1280 × 720;
  the startup dialog, default rendered setup, category accordion, and expanded
  keyboard catalog were inspected. The cramped card layout and crowded header
  described here were visible, not inferred from the old website.
- **Proposed:** all new layouts, tokens, UI modules, notification interfaces,
  search behavior, and breakpoints below are design decisions, not existing APIs.
- **Not yet verified:** the redesigned UI, physical touch devices, Safari,
  Firefox, screen-reader usability, and complete WCAG conformance. Proposed
  dimensions require implementation-stage visual review; the reference is not
  a measured CSS specification. This is an expert audit, not a user study.

Stage 1 verification used Node 24.22.1, `npm ci`, the pinned Chromium installation,
and `npm run check`: lint and formatting passed, all 50 unit tests passed, and
all 18 Chromium browser tests passed. These results establish the unchanged
application baseline, not validation of the proposed redesign. Existing
non-fatal source-map/marketing GSAP warnings appeared during development-route
testing. No runtime source, dependencies or assets were changed for this audit.

Repository orientation: [ARCHITECTURE.md](../ARCHITECTURE.md),
[DEVELOPMENT.md](../DEVELOPMENT.md), [PERFORMANCE.md](../PERFORMANCE.md), and
[ENGINEERING_AUDIT.md](../ENGINEERING_AUDIT.md). Source inspection takes precedence
over historical test counts in those documents.

### Current architecture and routes

| Area              | Verified implementation                                                                                                                                                                                                                                                                                  | Implication for the redesign                                                                                                       |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Application       | Vanilla JavaScript ES modules; no React/Vue/etc. `src/main.js` initializes page services and exports `app`; `src/app/createApp.js` composes injected services.                                                                                                                                           | Keep this architecture. Use small DOM adapters, not a new framework or state library.                                              |
| Modern editor     | `mainApp.html` → `src/main.js`; Vite 8.3.5, Three.js 0.186.1 and matching OrbitControls/TransformControls.                                                                                                                                                                                               | The actual canvas stays mounted throughout panel changes.                                                                          |
| UI dependencies   | Bootstrap 5.3.8 behavior and Popper 2.11.8; legacy Bootstrap 4 visual theme at `public/styles/bootstrap.min.css`, `src/styles/planner.css`, and `public/styles/css/bootstrap-compat.css`. Raleway is linked in HTML, but the theme's body stack is a system sans-serif. Icomoon supplies existing icons. | Retheme the modern page; preserve shared assets and retained pages. No dependency upgrades are required.                           |
| Routing           | Vite uses `appType: 'mpa'`, not client routing. `index.html` is the marketing entry; `mainApp.html` is the modern editor.                                                                                                                                                                                | Preserve both entrypoints and relative links.                                                                                      |
| Retained pages    | `scripts/site-layout.js` maps `mainAppMobile.html`, `mainAppOld.html`, `testHTMLfile.html`, `about.html`, `contact.html`, `services.html`, and `services - Copy.html` to `legacy/pages/`. Their scripts/styles are separate; older planners retain Three r116.                                           | Do not redesign or redirect these routes in this work. Responsive modern UI remains at `mainApp.html`.                             |
| Publishing/assets | `scripts/legacy-site.js` copies HTML, mounted assets and `src/styles/` into `dist/`; `publicDir: false`. The JS entry is emitted at stable `src/main.js`.                                                                                                                                                | New CSS under `src/styles/` is already copied. Public asset URLs are not filesystem paths. Never turn on automatic public copying. |

### Current experience

The header combines branding, Home, Setup Creator, Contact, Twitter, Share / Save,
Keybinds, and Beginner Tutorial. The left Bootstrap column is about one third of
the page, capped at 600px. Eleven accordion sections contain handwritten cards,
large thumbnails, centered dimensions, variation forms, and Add/Replace buttons.
There is no catalog search. The remaining column contains the dark 3D workspace,
camera reset, and feedback overlays. There is no selected-object sidebar.

The editor opens a welcome/update modal on every page visit through
`src/legacy/ui.js`. Help is a keybind dialog and a seven-slide animated-GIF
tutorial. Existing settings markup contains imperial/metric radios, but its
buttons are hidden and the modern UI has no unit-setting handler.

The canvas uses OrbitControls for camera interaction and TransformControls for
selected-object manipulation. UI selection is not a separate record of the
scene: `selection.pickedObject` refers to a live owned Three.js root. Startup
loads six defaults asynchronously: floor, modern desk, 28-inch monitor, mouse,
60% All Grey keyboard, and QCK Small mousepad. Startup/restore can leave an object
selected; the final selected startup object can depend on load completion order.
Do not assume the initial inspector must always be closed.

### Existing responsiveness

The modern page uses Bootstrap `col-md-*`, `col-xl`, and `navbar-expand-lg`, but
has no complete compact editor layout. The navigation collapse lacks a modern
page toggler. Global hidden overflow and a 600px canvas/scene minimum height make
short screens risky. `pageSetup.js` shows a desktop-only alert based on mobile
user agent. Separate mobile HTML is a retained implementation, not a responsive
version of `createApp`. Existing Chromium coverage at 1024 × 768, 1440 × 900, and
1920 × 1080 verifies some desktop geometry and the share dialog, not mobile use.

## 2. Problems and improvement opportunities

| Priority      | Finding and evidence                                                                                                                                                             | Required response                                                                                                                       |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| High          | At 1280 × 720 the accordion headings consume most of the left column. Expanded keyboard cards crowd thumbnail, name, dimensions and selectors.                                   | Replace large accordion rows with filters and compact cards. Keep configuration readable in an expanded card area.                      |
| High          | `* { outline: none !important; }` in `planner.css`; multiple unassociated form labels, duplicate IDs, and invalid dialog label references in HTML.                               | Remove focus suppression on the modern page; use semantic labels, unique IDs and correct dialog names.                                  |
| High          | Selection is visible primarily through the gizmo; delete and mode changes depend on shortcuts. `createSelection` has no subscription API.                                        | Add contextual UI around existing selection/commands and a minimal notification boundary.                                               |
| High          | The canvas/container contract coexists with absolute positioning, a minimum height, duplicated reset controls and a stray monitor checkbox inside the workspace.                 | Give the canvas one bounded host and move all HTML tools outside the canvas element.                                                    |
| High          | Save wording can suggest persistence, but `createSharing` only returns a URL snapshot.                                                                                           | Explain “Keep this link to reopen this setup. After edits, generate a new link.” No saved-state badge.                                  |
| Medium        | Product display names, categories, thumbnails and option labels live in HTML, while stable product data lives in JS.                                                             | Extract presentation metadata and generate cards while retaining catalog IDs and the resolver.                                          |
| Medium        | `readProductChoice` requires exact form IDs and preview binding assumes every family form exists.                                                                                | Preserve the contract during migration, then make binding explicit and compatible with filtering.                                       |
| Medium        | Global keyboard listeners ignore editable fields and modifiers, but do not check modal state. Numeric inputs disable picking on click until a canvas press/add enables it again. | Keep editing guards; scope shortcuts to the workspace and suspend them for dialogs. Separate UI focus from intentional object commands. |
| Medium        | Welcome/update copy blocks entry; tutorial captions disappear below Bootstrap's medium breakpoint and GIFs animate independently of CSS.                                         | Make welcome/help available on demand; maintain tutorial topics and provide text-first reduced-motion help.                             |
| Medium        | Bright green/blue buttons, gradient theme, text shadows and strong dark surfaces compete with the scene.                                                                         | Use warm light surfaces, restrained dark primary actions, thin dividers and consistent type.                                            |
| Compatibility | Descriptive dimensions are incomplete/inconsistent; some records are not visible in today's catalog.                                                                             | Preserve data and exposed choices. Never infer measured geometry or silently expose all product keys.                                   |

## 3. Visual direction and reference interpretation

Use the reference's calm horizontal header, left library, dominant center canvas,
and conditional right inspector. Retain **DeskSpacing** branding. The image's
“FORM”, “Untitled workspace”, “Home Office” and “OBJ 03” are illustrative; there
is no current workspace-name or document-ID model. Use “Desk setup” as static
context text, not an editable project title.

| Reference area        | Adopt                                                                                | Adapt or omit                                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header                | Compact height, quiet wordmark, clear primary action, thin bottom border.            | One Share / Save action, Help and navigation disclosure. Omit undo/redo, autosave status, CM/IN toggle, Export and unsupported settings gear.           |
| Library               | Heading, search, compact filters, two-column image cards, generous internal spacing. | Use all 11 existing categories rather than the mockup's All/Tech/Furniture alone. Actual thumbnails replace illustrative line icons.                    |
| Canvas                | Largest available area; unobtrusive lower toolbar and control hints.                 | Render the existing scene. No illustrative desk replacement, fake grid, selection-box renderer, view-mode dropdown, or unexplained diamond/share icons. |
| Inspector             | Object heading, thumbnail, quiet sections and restrained destructive action.         | Show existing identity/variation and controls. No XYZ fields or editable model dimensions. Hide entirely when selection is null.                        |
| Footer/library extras | Quiet spacing and alignment.                                                         | No Import or online-library placeholder, including “Coming soon” controls.                                                                              |

A warm canvas background can be applied as a deliberate presentation change to
`scene.background` in `createScene.js` (proposed `#E7E7E1`). CSS alone cannot
replace the current opaque scene background. Keep lights, fog, materials,
tone-mapping compatibility, floor, camera pose, model transforms and shadows
unchanged. Compare real models before accepting the background; do not retune
the engine to reproduce the mockup illustration. Keep the existing colored gizmo
and avoid adding mesh outlines/material effects in this stage.

## 4. Proposed desktop layout and interaction

### Layout contract

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ DeskSpacing  · Desk setup                 Help  More  [Share / Save]     │ 64px
├───────────────────┬─────────────────────────────────┬────────────────────┤
│ Objects       [×] │                                 │ Selected       [×] │
│ [Search objects]  │                                 │ Product / variation│
│ [All categories▾] │       LIVE THREE.JS CANVAS       │ Thumbnail          │
│ results count     │                                 │ Existing controls  │
│ ┌──────┐ ┌──────┐ │                                 │ Read-only details  │
│ │ card │ │ card │ │                                 │                    │
│ └──────┘ └──────┘ │ [Objects]  Camera hints [Reset]  │ Remove object      │
│ scrollable grid   │                                 │                    │
└───────────────────┴─────────────────────────────────┴────────────────────┘
```

At ≥1440 CSS px, use a 360px library, a flexible center (`minmax(0, 1fr)`), and
a 288px inspector. At 1280–1439px use 320px / flexible center / 256px. Inspector
width is zero when no object is selected; the DOM subtree is hidden/inert and
removed from tab order. The library is initially open on desktop and can be
collapsed with a labeled button. Keep a visible Objects trigger to restore it.
No draggable sidebar resizing is required; the existing observer must handle
all width changes. At 1280px the center remains about 704px with both panels open.

Use a shell grid with `grid-template-rows: 64px minmax(0, 1fr)` and height
`100dvh` with `100vh` fallback. All grid children need `min-width: 0` and
`min-height: 0`. Panels scroll independently. The workspace host is
`position: relative; overflow: hidden`; the canvas fills it, with no 600px
minimum. Never position the inspector inside `#rightSideContainer`.

### Header

- DeskSpacing remains a link to `index.html`; add static “Desk setup” where space
  permits. No synthetic file name, account menu or saved indicator.
- **Share / Save** is the single primary action. Keep `saveModalButton`,
  `saveModal`, and `customLinkForm` initially for compatibility. Generate the
  link when opening the dialog, not once at startup. Use a labeled, read-only
  text/URL field, with full selectability and clear manual-copy instructions.
  Clipboard automation is not required for parity; never show an unimplemented
  Copy action. Do not label this as cloud or file saving.
- **Help** exposes Controls / Keybinds, Beginner Tutorial and Welcome / Updates.
  Move the automatic welcome content here, retaining useful instructions and
  access to its historical update information. Changing startup presentation is
  intentional; do not add local-storage onboarding tracking.
- **More** is a simple disclosure containing the existing Home (`index.html`),
  Setup Creator (`mainApp.html`, marked current), Contact (`about.html`, despite
  the separate `contact.html` route), and Twitter URL. Preserve destinations;
  do not silently redirect Contact. Explain that navigation leaves the editor
  and that users can retain a share link. External navigation keeps its current
  new-tab behavior with appropriate `rel` attributes.
- No Settings button until there are implemented settings. Hidden units markup
  is not a working feature to expose.

### Library and product cards

Use an Objects heading and close button, a permanently labeled search field,
and a native category selector containing All plus the eleven categories in
existing order. This compact selector handles long names better than eleven
crowded tabs. It is the baseline at all widths; category chips are unnecessary.
Under it, show the result count and a two-column CSS grid. Use ordinary list
semantics, not an ARIA grid requiring spreadsheet navigation.

The default All view has 41 card definitions, representing 103 reachable product
or primitive choices after variations are resolved. Each card contains an actual
thumbnail (`object-fit: contain`, about 4:3), product name, optional trustworthy
existing descriptive subtitle, and a named action. Avoid truncating full product
names; reserve room for two or more lines. Do not create fabricated specs.

- Fixed accessories: **Add**; when an object is selected, show **Replace selected**
  as a secondary action. Replacement remains allowed across existing types; do
  not invent type restrictions based on the tutorial's “same type” wording.
- Family products: **Options** expands an inline configuration area spanning
  both grid columns, immediately after that card's row. It contains labeled
  native selects/checkboxes and Add/Replace actions. Only one configuration area
  is open; collapsing it retains its in-memory values. Focus stays on Options
  unless the user moves into the form. `aria-expanded` and `aria-controls` make
  the relationship explicit.
- Desks: show **Use desk**, with helper text “Replaces the current desk.” Preserve
  `actions.add` desk semantics, even though the old button says Add. Custom Desk
  exposes its existing width/length/material creation form here.
- Basic Shapes: show **Options** for existing dimensions and radius, followed
  by Add/Replace. These are creation/replacement parameters, not live editing.
- Replace is unavailable without a current selection, with a clear explanation.
  This intentionally removes the confusing UI case in which Replace silently
  adds; the underlying `actions.add(..., { replace: true })` fallback can remain.
- Card highlighting indicates an open configuration area. It must not imply
  that every instance of that product is selected. The inspector names the
  selected scene instance separately.

Search is local UI filtering over presentation labels, category names, family
names, variation labels and stable IDs. Trim/case-fold the query; combine it with
the category filter. A matching variation reveals its family and the matching
option text; it does not silently change the user's chosen variation. No remote
search, fuzzy-search dependency, new product download, or 3D thumbnail rendering.
Changing filters never mutates the scene or clears configuration values. Preserve
focus in the search field, announce the count politely, and provide “No objects
match your search” plus Clear filters when empty.

Pending actions disable the initiating action and conflicting Add/Replace actions
for that card, reserve label width, and expose `aria-busy`. Keep the rest of the
library usable. A failed load leaves the current object and form values intact;
show a readable error and allow retry through the same action. `actions.add`
returning `null` means a stale completion was discarded, not a successful add.
Avoid success announcements for that case. Missing thumbnails use a neutral
category placeholder and visible product text without disabling a valid model.

### Workspace and inspector

Keep the existing camera, drag and gizmo behavior. Use a small bottom-right Reset
camera button outside the canvas, with an accessible name and tooltip. Use a
quiet bottom-left hint on wide screens: “Drag to orbit · Shift-drag to pan ·
Scroll to zoom.” Move full help to Help on smaller screens. A static
“Perspective” label is unnecessary; do not turn it into an unsupported selector.

The inspector reads `selection.pickedObject`. Show:

1. “Selected”, a catalog display name and resolved variation. An instance label
   can use the existing `object.name`; it is not an editable name or new ID.
2. The existing thumbnail or fallback; no separate WebGL preview renderer.
3. Move / Rotate buttons that invoke the same modes as the existing R shortcut;
   an optional Controls disclosure exposes existing X/Y/Z visibility toggles
   and smaller/larger gizmo buttons. Read pressed states from TransformControls.
4. Existing descriptive dimensions as read-only text where reliable. Do not
   infer dimensions from a mesh bounding box or turn legacy strings into fields.
   Omit missing/misleading dimensions rather than displaying made-up values;
   existing library copy remains available pending a separate data correction.
5. **Remove object**, visually separated and named for the current object.
   Invoke `actions.remove(currentObject)` through the UI adapter. Do not add
   an undo toast. The existing immediate-delete behavior remains available.

The inspector close button means **Deselect object** and invokes
`selection.unselectPickedObject()`; it is not a second hidden-selection state.
The C shortcut does the same, even though old help calls it “Hide controls”.
An empty-space canvas click currently leaves selection unchanged; preserve that
behavior. No inspector placeholder consumes space when selection is null.

Important exception: `NoSelect` prevents raycast picking and gizmo attachment,
but `selection.pick` can still remember such a root after a model add/restore.
If it is the actual selected root, show its identity and existing remove action,
omit transform controls, and explain “This object has no movement controls.” Do
not make desks/floor newly raycast-selectable or infer capability from category.
Primitive desks/floor are not automatically picked during their creation.

Keep keyboard focus on the initiating library control after Add. Pointer
selection updates the inspector without stealing focus. If removal or deselection
hides the focused inspector, return focus to the canvas's labeled focus target.
No empty inspector should flash during transactional replacement.

## 5. Responsive layout strategy

Breakpoints are proposed CSS pixels, independent of legacy Bootstrap breakpoints.
Use available width and height, not user-agent detection, to choose presentation.

| Viewport                                    | Layout and panel policy                                                                                                                                                                                                                                    | Canvas policy                                                                                                                                                                                  |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Large desktop ≥1440                         | 64px header; 360px library; 288px conditional inspector. Two-column cards.                                                                                                                                                                                 | Remaining width; both panels can close.                                                                                                                                                        |
| Standard laptop 1280–1439                   | 64px header; 320px library; 256px conditional inspector.                                                                                                                                                                                                   | At 1280px, about 704px available with both panels open.                                                                                                                                        |
| Compact laptop / landscape tablet 1024–1279 | 56px header; one 304px docked panel at a time. Objects/Selected controls switch between library and inspector; Selected is available only with a selection.                                                                                                | At least about 720px at 1024. Selecting a scene object shows its inspector; Add keeps the library open and offers Selected for inspection. Switching panels retains selection and form values. |
| Tablet 768–1023                             | 56px header; canvas-first. Objects opens a 320px modal drawer. Selection opens a non-modal, compact bottom inspector; explicitly expanding details opens a sheet. Only one expanded surface at a time.                                                     | Drawer temporarily blocks canvas interaction; closing restores the full canvas. Compact inspector occupies a separate layout row, not an invisible hit-testing overlay.                        |
| Phone <768                                  | 56px header: wordmark, Help, More, compact Share action. Objects trigger below/on the canvas chrome. Library is a modal bottom sheet, up to 80dvh; selection has a 56px compact bar with name, Controls and Deselect. Expanded inspector is a modal sheet. | Keep the canvas mounted. Use full width; close a successful add's library sheet to reveal the result, unless the operation was cancelled/stale. Errors keep the sheet/form open.               |
| Short viewport <600px high                  | Collapse optional hints and secondary header text. Sheets/dialogs can use full available height. A user can close every panel.                                                                                                                             | Never enforce a 600px canvas minimum; keep toolbar/close buttons reachable. Prefer an expanded dialog over an unusably short split view.                                                       |

At 320px width use one card column if two would yield cards narrower than 140px.
At 375–430px, two columns are suitable with 12px margins/gaps. Form content can
use the full sheet width. Use safe-area padding for bottom/side controls and
`scroll-padding` so focus is not covered by sticky headers/footers. With a virtual
keyboard open, scroll the sheet's fields into view; do not move or recreate the
canvas and do not lock the whole document in an unscrollable state.

Modal sheets have a backdrop, focus containment, Escape and a visible Close
button. No swipe-to-dismiss or drag handle is required. Outside pointer events
must not reach the canvas. Non-modal compact bars do not trap focus. On breakpoint
changes, transfer the same controls between presentation modes without duplicate
IDs/listeners; close obsolete overlays and restore focus to a valid element.

The inherited OrbitControls configuration supports one-finger rotation and
two-finger dolly/pan; the modern pointer adapter uses Pointer Events and restores
camera controls on `pointercancel`. Preserve that behavior and let only the
canvas own its gesture suppression. Library scrolling uses normal touch scrolling.
Do not add whole-page touch interception or a new gesture/manipulation system.
Physical-device tests must check picking during orbit, gizmo dragging, gesture
cancellation, and sheet scrolling. Remove the modern desktop-only alert only in
Stage 3 after responsive/touch verification; keep retained mobile routes intact.

## 6. Design system specifications

The following are proposed initial tokens, derived visually from the reference.
Use CSS custom properties scoped to `.planner-app`; do not recolor retained
marketing/mobile pages. Exact values may be adjusted for measured contrast and
real-model legibility, with the decision recorded.

| Token / role             | Value                                                                      | Usage                                                                 |
| ------------------------ | -------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `--font-ui`              | `ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` | Primary text, headings, controls; no new network font.                |
| `--font-mono`            | `ui-monospace, SFMono-Regular, Consolas, monospace`                        | Secondary typography for shortcuts/instance identifiers only.         |
| `--color-bg`             | `#F6F6F2`                                                                  | App background.                                                       |
| `--color-surface`        | `#FAFAF7`                                                                  | Header and panels.                                                    |
| `--color-card`           | `#FFFFFF`                                                                  | Cards, fields and dialogs.                                            |
| `--color-surface-muted`  | `#ECEDE7`                                                                  | Thumbnail wells and selected-filter fill.                             |
| `--color-workspace`      | `#E7E7E1`                                                                  | Canvas host; proposed matching Three.js background.                   |
| `--color-text`           | `#242723`                                                                  | Primary text and dark buttons.                                        |
| `--color-text-muted`     | `#62675E`                                                                  | Secondary text; do not copy low-contrast pale labels from the mockup. |
| `--color-border`         | `#DADDD4`                                                                  | Decorative panel/card dividers, not the sole control affordance.      |
| `--color-border-control` | `#7B8175`                                                                  | Required input/control boundaries.                                    |
| `--color-accent`         | `#4F6240`                                                                  | Active category/pressed states, with text/icon indication.            |
| `--color-focus`          | `#4F57C8`                                                                  | Focus ring; distinct from 3D selection/gizmo colors.                  |
| `--color-danger`         | `#A33A30`                                                                  | Remove/error text.                                                    |
| `--color-danger-bg`      | `#FFF3F0`                                                                  | Error and destructive-action hover surface.                           |
| `--color-success`        | `#3D603B`                                                                  | Successful operation text; never an autosave indicator.               |

Typography: body 14px/20px (0.875rem/1.25rem), card names 14px/20px at weight
600, section headings 18px/24px at 600, brand 20px/24px at 600. Supporting labels
and shortcut chips are at least 12px/16px. Use 16px input text on touch devices.
Reserve restrained uppercase with 0.08em tracking for short section eyebrows;
do not use it for product names. No global centered headings or text shadows.

Spacing scale: 4, 8, 12, 16, 20, 24, 32px (`--space-1` through `--space-8`).
Desktop panel padding 16px; section gap 24px; grid gap 12px; card padding 12px;
compact control group gap 4–8px. Border radii: 4px for shortcut chips, 8px for
fields/buttons, 12px for cards/dialogs, 16px for top corners of mobile sheets.
Use a 1px border. Panel surfaces are flat; reserve elevation for floating tools
and dialogs: `0 4px 16px rgb(36 39 35 / 8%)` and
`0 16px 48px rgb(36 39 35 / 16%)` respectively.

Buttons/fields: 36px default height; search 40px; pointer-coarse/touch targets
44 × 44px minimum (including invisible padding around small icons). Primary
button uses white on `--color-text`; secondary uses neutral surface and dark
text; destructive is outlined with dark red text, not a large red fill. Use
clear labels beside icons for primary actions. Small icons are 16px, normal
icons 20px, all on a 24px viewBox with approximately 1.75px strokes and rounded
ends. Prefer a tiny local inline-SVG set authored for these controls; no icon
package or new external font. Decorative SVGs have `aria-hidden="true"`.

States: hover darkens a boundary or surface; active/pressed adds a persistent
fill plus `aria-pressed`; selected category also has a textual label. Disabled
controls retain readable labels and state explanation, without relying solely on
opacity. Busy actions keep their footprint and expose status. Focus-visible uses
a 2px `--color-focus` outline with 2px offset and must not be clipped. Inputs show
inline validation text and `aria-invalid`/`aria-describedby`, not just red borders.

Motion: 120–160ms opacity/color transitions; up to 180ms for sheets. Do not animate
canvas size or camera when a selection changes. Panel column changes are instant
to avoid repeated expensive resizing and moving raycast targets. Honor
`prefers-reduced-motion: reduce` by removing nonessential transitions and
auto-advancing help. No perpetual loading animation when a static status suffices.

## 7. Component inventory

Paths marked **new** are proposals; they do not exist at Stage 1.

| Component                           | Responsibility                                                                                   | Reuse / proposed location                                                                                              |
| ----------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| App shell                           | Header, layout regions, responsive presentation and panel focus return.                          | Replace modern markup in `mainApp.html`; CSS in `src/styles/planner.css`; **new** `src/ui/editorShell.js`.             |
| Header / Help / More                | Branding, static context, real links, dialog triggers.                                           | `mainApp.html`; existing Bootstrap modal/disclosure behavior where suitable.                                           |
| Catalog presentation data           | Ordered categories, labels, explicit option values and thumbnail mapping. No scene state or DOM. | **new** `src/catalog/presentation.js`, referencing `products.js` and `configuration.js`.                               |
| Catalog renderer                    | Generate 41 cards/forms; filter locally; manage expanded option UI and loading labels.           | Extend `src/ui/catalogPanel.js`; separate a renderer only if the module becomes unwieldy.                              |
| Product options                     | Family/stand/style/material and primitive creation controls.                                     | Preserve `readProductChoice` responsibility; adapt generated forms and previews.                                       |
| Workspace                           | One canvas, reset tool, hints, feedback.                                                         | Reuse `#threeCanvas`, `#rightSideContainer`, `createScene` and `bindPointer`.                                          |
| Selected-object panel               | Derived identity/capabilities, existing mode/axis/size/remove/deselect commands.                 | **new** `src/ui/selectionPanel.js`; injected `selection`, `actions`, `view.transformControls`.                         |
| Shared manipulation command adapter | One implementation of existing R/X/Y/Z/+/- behavior used by buttons and keyboard.                | Small extraction within `src/interactions/keyboard.js` or **new** `src/interactions/commands.js`; no new scene model.  |
| Share dialog                        | Fresh deployment-aware URL snapshot, selectable field, instructions and errors.                  | Reuse `createSharing`, `bindPlannerUI` and modal IDs; correct HTML semantics.                                          |
| Help/tutorial                       | Existing topics, revised copy, explicit navigation and reduced-motion content.                   | Modern `mainApp.html` help markup plus desktop-local initialization; retain shared `src/legacy/ui.js` for other pages. |
| Feedback                            | Initial loading, field/action errors, success/status announcements without blocking gestures.    | Extend `src/ui/feedback.js`; retain `.planner-feedback` / `.planner-loading` if tests depend on them.                  |

Keep Bootstrap/Popper for dialogs initially. Retain the existing theme stylesheet
on the modern page during the first migration, but load scoped planner overrides
last and replace obsolete dark/text utility classes in modern markup. Explicitly
reset gradients, shadows, text-white utilities and global theme assumptions on
the new components. Do not edit the shared minified theme. Any later removal of
the modern page's theme link requires equivalent tested dialog/carousel styling;
it is not necessary for this redesign.

## 8. Existing feature mapping and compatibility inventory

### Catalog coverage

`src/catalog/products.js` has **104 product records**; `configuration.js` has
**14 families**, defaults and primitives. The current desktop HTML exposes **41
cards across 11 categories**, resolving to **101 catalog products plus Box and
Sphere** (103 choices; material combinations are additional configuration).
The floor is a startup/restore primitive, not a library card.

The new presentation metadata must preserve the following exact keys/option
values. Labels can improve clarity, but option values must not be normalized.

| Category                     | Existing cards and variation values                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Desks                        | `customDesk` (Light Alderwood, Dark Walnut, Italian Oak, Zebrano Wood); `modernDesk`; `standingDesk`; `linnmonDesk` → `39`, `47`, `59`; `alexDesk` → `61`, `67`, `79`; `bekantLShaped` → `Left`, `Right`.                                                                                                                                                                                                   |
| Monitors                     | `small16x9Monitor` → `22`, `23`, `24`, `25`, `27`, `28`, `31` (31.5-inch label); `largeCurved16x9Monitor` → `25`, `27`, `31`, `34`; `flat21x9Monitor` → `25`, `29`, `34`; `curved21x9Monitor` → `30`, `34`, `38`; `curved32x9Monitor` → `43` (43.4-inch label), `49`. Every family supports `NoStand`.                                                                                                      |
| Keyboards                    | `default60PercentKeyboard` → `AllGrey`, `AllWhite`, `Minimalist`, `Nightrunner`, `WGR`, `OBW`, `YPGrad`; `75PercentKeyboard` → `AllGrey`, `AllWhite`, `Minimalist`, `Nightrunner`, `WGR`, `OBW`, `8008`; `defaultFullKeyboard` → `AllGrey`, `AllWhite`, `Nightrunner`, `WGR`, `OBW`, `YPGrade`; `TKLKeyboard` → `AllGrey`, `AllWhite`, `WGR`, `OBW`, `YPGrade`, `8008`. Preserve `YPGrad` versus `YPGrade`. |
| Mouse                        | `MXMaster3`, `defaultMouse`.                                                                                                                                                                                                                                                                                                                                                                                |
| Mousepads                    | `QCKSmall`, `QCKMedium`, `QCKLarge`, `QCKXXL`.                                                                                                                                                                                                                                                                                                                                                              |
| Speakers and Audio Equipment | `deskSpacingSpeaker` → `Primary`, `Secondary`; `deskSpacingSoundBar`; `studioMonitorSpeaker` → `Primary`, `Secondary`; `yetiUSBMic`; `audioInterface`; `MIDIKeyboard`.                                                                                                                                                                                                                                      |
| Laptops                      | `modernLaptop13`, `modernLaptop15`, `modernLaptop17`.                                                                                                                                                                                                                                                                                                                                                       |
| Computer Towers              | `modernComputerTower`, `miniITXTower`.                                                                                                                                                                                                                                                                                                                                                                      |
| Basic Shapes                 | `referenceBox`, `referenceSphere`.                                                                                                                                                                                                                                                                                                                                                                          |
| Chairs                       | `modernOfficeChair`, `simpleChair`, `gamingChair`.                                                                                                                                                                                                                                                                                                                                                          |
| Miscellaneous                | `regularBook`, `coffeeCup`, `basicLamp`, `modernLamp`.                                                                                                                                                                                                                                                                                                                                                      |

`drawerDesk`, `TKLKeyboardYGB`, and `mediumRGBMousepad` are catalog records absent
from current desktop cards/options. Preserve their compatibility records and
restoration behavior, but do not expose them merely by iterating all products.
`drawerDesk` has a known missing asset. Its failure must be reported, not hidden
by substituting a different desk. A restored non-card product still needs a
readable inspector name/fallback; this does not require a new add card.

Thumbnails currently live under `public/images/Model thumbnails/` with public
URLs `Model thumbnails/...`; tutorials use `Click Through Tutorial/...`.
Do not derive all filenames from IDs: many have spaces and different names.
Keyboard preview families deliberately use `<family><option>.jpg`; custom desk
material previews use explicit `data-image` values. Preserve those mappings and
file case. Asset checks use `siteSourcePath()` rather than literal URL-to-disk
concatenation. No asset deletion or optimization is part of this stage.

### User action to source/API map

| Existing user-facing behavior | DOM / interface and source                                                                                                                    | Redesign destination                                                                                       |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Browse categories             | `#accordionExample`, `#heading*`, `#collapse*` in `mainApp.html`; Bootstrap collapse.                                                         | Generated library + category selector; update tests that currently target accordion IDs.                   |
| Add fixed/family product      | `[data-action="add"]`, `data-product` / `data-family`; `bindPlannerUI` → `readProductChoice` → `actions.add(product, options)`.               | Card/option form actions; same action boundary.                                                            |
| Replace selection             | `data-replace="true"` → `actions.add(..., {replace:true})`. Captures target and X/Z before async loading; new Y/rotation are authored values. | Secondary card action; never promise full transform preservation.                                          |
| Change desk                   | `isDesk` / `deskOffsets`; `actions.add` replaces current desk and shifts existing non-furniture objects.                                      | Use desk action; preserve height behavior and failed-load transaction.                                     |
| Monitor stand option          | `<family>Stand`, current `value` toggles `off/on`; `resolveProduct(family, variation, noStand)`.                                              | Explicit No stand checkbox; adapter can read `checked` only as an intentional atomic migration with tests. |
| Keyboard preview              | `<family>Form` change → `<family>Image.src`; `bindCatalogPreviews`.                                                                           | Preview updates before adding, without scene mutation.                                                     |
| Custom desk                   | `customDeskL`, `customDeskW`, `customDeskForm`, `customDeskImage`.                                                                            | Existing inch-based creation dimensions and four materials.                                                |
| Box/sphere                    | `referenceBoxL/W/H`, `referenceSphereRadius`; adapter → `createRecord` → factory.                                                             | Existing creation/replacement forms, explicitly labeled inches.                                            |
| Select object                 | Canvas `pointerdown`; canvas-relative NDC → `selection.mouseSelect`; nested hit → registered root; `selection.pick`.                          | Same picking/gizmo; inspector follows selection.                                                           |
| Deselect                      | C → `selection.unselectPickedObject()`. Empty-space picking does not deselect.                                                                | Deselect button and C.                                                                                     |
| Delete                        | D, Delete, Backspace → `selection.deletePicked` → injected store removal. `actions.remove` also exists.                                       | Remove button via actions plus existing shortcuts.                                                         |
| Move/rotate                   | R toggles translate/rotate and axis visibility; actual manipulation uses TransformControls.                                                   | Inspector mode buttons share this command logic; no numeric transforms.                                    |
| Axis/gizmo size               | X/Y/Z toggle visible axes; +/= and -/_ change size by 0.1 (minimum 0.1).                                                                      | Controls disclosure plus shortcuts. Preserve the mode switch's axis reset behavior.                        |
| Orbit/pan/zoom                | `createScene` OrbitControls; left drag rotates, Shift-left/right drag pans, wheel/middle interaction zooms. One/two-touch defaults inherited. | Canvas and truthful Help; no new camera modes.                                                             |
| Reset camera                  | `[data-action="reset-camera"]` → `view.resetCamera`.                                                                                          | One workspace toolbar button; does not reset objects.                                                      |
| Share/save                    | `saveModalButton` fills `customLinkForm` via `sharing.createLink`; fresh `state.objects.map(objectToRecord)` snapshot.                        | Same capability, clearer dialog.                                                                           |
| Open saved setup              | `customSetup` query → `readSetupParameter` → codec → `actions.restore`. First parameter wins; absent query initializes defaults.              | Same route/codec; preserve empty setup and invalid-initial-link fallback.                                  |
| Loading/errors                | `createApp` sets initial canvas `aria-busy`; `feedback` creates status/alert in workspace; add buttons have busy states.                      | Non-blocking scene status plus local form/action feedback.                                                 |
| Help/welcome                  | `exampleModal`, `tutorialModal`, `carouselExampleControls`, `starterModal`; shared `src/legacy/ui.js`.                                        | Help menu and modern dialogs; preserve all seven teaching topics.                                          |
| Site navigation               | Header links in `mainApp.html`; static route mapping in `scripts/site-layout.js`.                                                             | More disclosure and unchanged destinations.                                                                |

### Non-negotiable form/serialization details

| Visible field      | Current ID              | Data mapping to preserve                 |
| ------------------ | ----------------------- | ---------------------------------------- |
| Custom desk Width  | `customDeskL`           | Box width/X; dimensions `[L, 1, W]`.     |
| Custom desk Length | `customDeskW`           | Box depth/Z; thickness is always 1 inch. |
| Box Width          | `referenceBoxL`         | Geometry width/X, dimensions element 0.  |
| Box Height         | `referenceBoxW`         | Geometry height/Y, dimensions element 1. |
| Box Length         | `referenceBoxH`         | Geometry depth/Z, dimensions element 2.  |
| Sphere Radius      | `referenceSphereRadius` | Radius, saved as `[radius, -1, -1]`.     |

Do not “correct” field names by rearranging values. Scene coordinates use inches;
rotations use radians. Authored model origins are not necessarily geometric
centers. Current desk changes shift existing non-furniture items; new GLB additions
retain baseline Y, while new primitives use the current desk offset. Preserve
this characterized behavior rather than silently fixing it in a UI redesign.

The sharing writer retains `^` primitive separators; the reader accepts both
`^` and historical mobile `*`. Product IDs, type strings, commas, pipes and
floating-point values are compatibility contracts. The URL uses the active
origin and pathname, removes old query/hash values, and encodes `customSetup`.
There is no backend save, browser-storage save, named workspace, exported file,
camera persistence or selection persistence. A later restore failure retains the
current scene; an invalid initial URL reports the error and loads usable defaults.

## 9. Functionality explicitly excluded

| Capability                           | Verified status / decision                                                                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Centimeter/inch conversion           | Metric display strings and hidden radios exist, but no modern conversion handler. Do not implement or expose a unit toggle.                       |
| Numeric position/rotation editing    | Absent. No inspector XYZ fields.                                                                                                                  |
| Numeric dimensions                   | **Preserve existing custom-desk/box/sphere creation inputs.** Do not add live resizing or model dimension editors.                                |
| Grid/snapping                        | Absent from exposed UI and handlers. No snap toggle or decorative grid implying scale/snapping.                                                   |
| Undo/redo                            | Absent. No buttons, keyboard promises or “Undo” notification.                                                                                     |
| Autosave                             | Absent. No “All changes saved” status or local-storage persistence.                                                                               |
| Export                               | No app export. Tutorial describes operating-system screenshots; preserve that distinction.                                                        |
| Custom model import / online library | Absent. No upload/drop zone or disabled teaser.                                                                                                   |
| New manipulation systems             | No multi-select, drag-from-library placement, scale gizmo, alignment, bounding-box controls, or replacement engine.                               |
| Workspace naming/settings            | No implemented title/settings model. Static context only; hidden unfinished controls are not functional requirements.                             |
| New reset/setup command              | `actions.reset` exists for lifecycle operations, but no current user-facing scene-reset command. Do not add a destructive New/Reset setup button. |

Search, panel disclosure and accessible HTML buttons for existing commands are
UI improvements within this scope. Reserve inspector section containers and
presentation metadata extension points for later features, with no empty or
disabled speculative controls now.

## 10. Accessibility and usability requirements

Target WCAG 2.2 AA for the implemented UI. Relevant thresholds include text
contrast of 4.5:1 (3:1 for large text), 3:1 for required non-text control cues,
visible unobscured focus, and the AA 24 × 24 CSS px target-size criterion with
its exceptions. DeskSpacing's proposed 44px touch target is a stronger design
target, not a claim that WCAG AA mandates 44px everywhere. Reflow, keyboard
access, status announcements, and alternatives to dragging also require review.
See [WCAG 2.2](https://www.w3.org/TR/WCAG22/).

- Use header/nav/main/aside landmarks with names and a Skip to workspace link.
  Give the canvas a focusable, descriptive label and linked control instructions;
  do not indiscriminately assign `role="application"` to the whole page.
- Every field has a persistent visible label and associated `for`/ID. Image-only
  buttons have accessible names; redundant thumbnails use empty alt text next to
  the same product name. Never use placeholder text as the only label.
- Tab order follows header → library → workspace tools → inspector. Hidden
  panels and filtered cards have no focusable descendants. Enter/Space activates
  buttons; native selects/inputs retain native keyboard operation. No positive
  tabindex values or invented arrow-key grid behavior.
- Scope character shortcuts to workspace focus (canvas or its contextual object
  tools), leaving text inputs, selects, contenteditable, browser shortcuts and
  other UI navigation alone. Dialogs/sheets suspend scene shortcuts. Preserve
  their commands and document the focus requirement in Help; do not leave D
  globally destructive while typing/searching or reading a modal.
- Dialogs need a correct accessible title, initial focus, contained Tab sequence,
  Escape and a visible close button. Return focus to the trigger, or the nearest
  surviving logical control. Use `aria-modal` only when the background is truly
  inert; avoid stacked welcome/tutorial modals. Follow the
  [WAI-ARIA dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
- Selection feedback combines inspector text, existing gizmo and active command
  labels. Announce a newly selected/removed object once, politely; never announce
  every drag frame. UI color alone must not communicate state.
- Initial loading is indeterminate with “Loading your setup…” and `aria-busy`;
  do not invent progress percentages. Pending Add is local to its card. Keep an
  empty valid setup usable with “Choose an object from the library” guidance.
  No-results search and missing-thumbnail states are distinct from load errors.
- Report validation errors adjacent to the field and in a suitable live region;
  keep entered values. Preserve codec validation (positive primitive sizes,
  finite values and existing bounds) as the authoritative boundary. Handle
  pasted values, not only `keypress`. Move focus to the first invalid field on
  submission and describe inches explicitly.
- Announce failures without stealing focus. An initial bad share link must make
  clear that the displayed defaults are a fallback, not the saved setup.
  Successful link creation means a snapshot link is ready, not durably saved.
- At 200% zoom/text enlargement, controls remain usable; at narrow reflow widths,
  all surrounding UI reflows without two-dimensional page scrolling. A spatial
  canvas can need two-dimensional interaction; that does not exempt its header,
  forms or dialogs. Do not hide essential help copy at small widths.
- Disable tutorial auto-advance. Provide readable text for every GIF topic.
  Reduced-motion help must avoid loading/playing animated GIFs, using text-first
  content instead; CSS transition overrides alone cannot pause a GIF. Preserve
  original tutorial assets. Any later static derivatives need rights review.
- Verify forced-colors focus/borders, system font fallback, scrollbar access,
  pointer-coarse targets, and contrast in all hover/pressed/error states.

**Conformance limitation:** the current 3D system has no complete keyboard-only
object-discovery/navigation and non-drag transform alternative. Buttons for modes
and deletion improve access but do not solve those gaps. Do not claim the entire
editor is WCAG 2.2 AA compliant after styling. Record remaining canvas barriers
in Stage 3 testing and scope their remedies separately if they would require new
selection/manipulation capabilities. The UI acceptance criteria below remain
mandatory; the limitation is not a waiver for inaccessible forms or dialogs.

## 11. Technical integration strategy

### Ownership and update flow

```text
Presentation metadata ─→ catalog DOM ─→ UI reads form ─→ actions.add/remove
                              ↑                           │
                    local search/panel state             ↓
                                                     objectStore
                                                        │
Canvas pointer ─→ selection.pick/unselect ─→ inspector   Three.js roots
                          │                             │
                          └─→ TransformControls ────────┘
                                                        │
Share dialog ─→ sharing.createLink ─→ snapshot live roots ─→ legacy codec
```

The diagram's selection-to-inspector notification is **proposed**, not an
existing event bus. Add a small `selection.subscribe(listener)` method returning
an unsubscribe function (or equivalent injected callback) to `createSelection`.
Notify after a changed `pickedObject` and after deselection/deletion. Initialize
the panel from the current getter; handle both initial async loads and restores.
Do not poll every animation frame and do not add production globals.

The store still owns membership/identity. Actions still own add/replace/remove
and transactional restoration. The UI may keep ephemeral search text, category,
expanded card, form choices, drawer presentation and pending action status; it
must not store another set of mutable object transforms, recreate a selected
mesh, or mutate the scene directly to mirror the panel.

Use the existing `app` composition boundary to inject `selection`, `actions`,
`sharing`, `resetCamera` and needed control references. Keep the lifecycle export
used by tests. Wire new modules into the `cleanup` list; unsubscribe and remove
DOM listeners on disposal/HMR. UI async completions need a disposed guard so a
late load does not write into a detached card or resurrect a hidden panel.

### Catalog generation and event contracts

Create a single presentation schema describing categories, card keys, product or
family references, labels, thumbnails, ordered option values/labels and existing
descriptive text. It supplements the technical product records; it does not copy
model URLs, authored positions, rotations or desk offsets into UI data.
`resolveProduct` remains the family validator. Do not split the large declarative
catalog incidentally or reinterpret inconsistent dimensions.

Render all card forms once, then filter/hide and expand their presentation. This
keeps current ID-based adapters usable and avoids losing choices. At 41 cards no
virtualization dependency is warranted. Ensure generated controls exist before
binding `bindPlannerUI`/`bindCatalogPreviews`, or switch the relevant listeners to
delegation on the stable library root. Do not leave the old one-time
`querySelectorAll` binding attached to removed nodes. A card rerender cannot
create a second listener or duplicate ID. Read shared options from the one form
per family, not separate copies for Add and Replace.

Preserve `data-action="add"`, `data-product`, `data-family`, `data-replace` and
form IDs during the first migration. Explicitly replace these old hazards:

- Two `curved32x9MonitorStand` checkboxes: retain one correctly labeled catalog
  checkbox; remove the stray workspace duplicate.
- Duplicate `resetCameraButton`/`settingsButton` in canvas fallback and external
  markup: one real reset tool outside the canvas; no unsupported settings tool.
- Duplicate `modernDesk`, `keybindLetter`, `optionsRadios1`, and whitespace-prefixed
  ` exampleModalLabel`: use classes for repeated styling and unique semantic IDs.
- `saveModal` points to `saveModalLabel` but the heading is `shareModalLabel`:
  fix the reference. Replace the link field's `type="email"` with appropriate
  read-only text/URL semantics.

Any switch from stand-checkbox `value` toggling to `.checked`, or from DOM ID
lookups to explicit form references, must update reading, preview binding and
tests together. Native input validation supplements, never replaces, codec
validation. Keep `Number` conversion semantics for supported decimals and reject
invalid/empty submissions with clear feedback.

### Selection commands and renderer sizing

Extract existing mode/axis/size operations so the keyboard and inspector call the
same functions. The current closure-local `rotateActive` flag would become stale
if new buttons called `setMode` independently; use the actual control mode as the
source when toggling. Preserve R's behavior of switching to Y-only rotation and
X/Z translation, and keep X/Y/Z plus size operations available. Subscribe to
control `change` for button state, without mirroring object positions.

`#threeCanvas` and `#rightSideContainer` are hard dependencies of `createApp` and
feedback. Keep them unless the entire injection/test contract is deliberately
changed in one patch. `createScene.resize` already observes the host through
ResizeObserver, reads its client dimensions, updates camera aspect/projection,
caps pixel ratio at 2, calls `renderer.setSize`, and invalidates a frame. Window
resize is also handled. Reuse that pipeline for dock changes and compact bars;
do not measure total browser width or subtract fixed sidebar widths in JS.

Raycasting already uses the current canvas bounding rectangle in `pointer.js`.
Keep the rect-relative normalization for both axes; never replace it with
window-based coordinates. Overlay tools must be sibling elements with deliberate
hit areas, not invisible full-canvas interceptors. Changes in panel state during
a live gizmo drag should wait until pointerup/cancel so resizing does not change
the target rectangle mid-drag. Selection text can update immediately; defer only
the layout transition. Always restore OrbitControls after cancellation.

Store changes and `objectChange` already call `view.invalidateScene()` to refresh
shadows; camera-only updates use `view.invalidate()`. A background presentation
change must explicitly invalidate the scene. Do not create a permanent render
loop for inspector updates. Keep hidden-tab suspension, idle behavior and disposal
guards. Never mutate shared cached geometry/textures to style a selected object;
the inspector uses HTML feedback instead. Retain first-root GLTF loading and
exactly-once resource release for failed/stale async operations.

### Bootstrap and build boundaries

Do not modify `src/legacy/ui.js` globally to suppress startup modals on retained
routes. Remove the modern page's `starterModal` auto-show class and provide a
desktop trigger; use desktop-local tutorial initialization for motion behavior.
Keep only one Bootstrap modal open at a time and ensure backdrop/tool z-index
ordering is explicit. A new local module under `src/ui/` is bundled through
`createApp`; CSS files under `src/styles/` are copied by the existing build.

Keep asset URLs relative and deploy only `dist/`. A genuinely new asset collection
requires a `siteMounts` entry; files inside existing collections do not. Do not
add CNAME, change hosting, delete original thumbnails/models, or rewrite retained
HTML as a side effect. New asset rights must be documented in
`THIRD_PARTY_NOTICES.md`; never infer a license from repository presence.

## 12. Implementation risks and mitigations

| Risk                                                           | Mitigation and proof                                                                                                                                                                                                 |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lost product/variation during generation                       | Freeze the 41-card/103-choice UI inventory above; test coverage against explicit presentation choices and stable catalog records, including unusual keyboard suffixes and all monitor stands.                        |
| “Corrected” primitive axes or model origins                    | Preserve field mapping table, codec fixtures and authored transforms; use unequal box dimensions in regression tests.                                                                                                |
| Stale inspector after keyboard/delete/restore                  | Notify centrally in selection, initialize from current selection, test every selection path and unsubscribe on dispose.                                                                                              |
| R shortcut and buttons disagree                                | One command implementation; derive mode from TransformControls, not an independent UI flag.                                                                                                                          |
| Sidebar causes stretched canvas or wrong picking               | Use existing ResizeObserver and canvas-relative pointer math; test opening/closing each panel with real nested meshes and preserve camera/scene snapshots.                                                           |
| Failed replacement removes working object                      | Keep actions' load-before-remove transaction and click-time target capture; inject network failure and change selection while waiting.                                                                               |
| Filtering destroys form values or busy state                   | Render stable forms, filter visibility, scope pending operations to card/action identity; no full-library rerender on every keypress.                                                                                |
| Theme overrides leak or dialogs become unusable                | Scope modern theme; retain shared assets; verify all modal/carousel states and unchanged retained routes.                                                                                                            |
| UI suggests nonexistent persistence or tools                   | One share action, explicit snapshot wording, no export/save status/units/import placeholders.                                                                                                                        |
| Appearance tweaks alter model fidelity/performance             | Change only background presentation; inspect startup and representative light/dark models; no material mutation, extra WebGL renderer, or continuous UI polling.                                                     |
| Touch sheets interfere with camera/gizmo                       | Inert backdrop for modal sheets, normal panel scrolling, canvas-only gesture handling, pointercancel coverage and real-device review.                                                                                |
| Accessibility overclaim                                        | Measure DOM UI requirements, manually test keyboard/screen readers, record remaining canvas barriers; no full-editor conformance claim.                                                                              |
| Existing project limitations mistaken for redesign regressions | `drawerDesk` is still missing; legacy Three npm advisory remains open in `docs/DEPENDENCIES.md`. Full preserved build size/hosting constraints remain separate. Chromium does not certify mobile, Safari or Firefox. |

## 13. Acceptance criteria and verification

### Stage 2 exit criteria: desktop implementation

- At 1280 × 800, 1440 × 900 and 1920 × 1080, the header/library/canvas/conditional
  inspector follow this specification; at 1280 × 720 no essential controls are
  clipped. No unsupported reference controls appear.
- All 41 cards, 11 categories and 103 resolved visible choices remain reachable;
  material choices, preview updates, stand options, Add and Replace semantics
  survive. Search and filtering never mutate the scene or discard typed options.
- Actual selection drives the inspector after canvas picks, Add, Replace,
  keyboard deselect/delete and URL restore. Null selection reserves no sidebar.
  Programmatically selected `NoSelect` objects get no new transform capability.
- Existing camera/gizmo controls and every documented shortcut remain usable in
  the appropriate focus context; buttons and shortcut state stay synchronized.
- Share links reflect current live transforms and preserve root/subpath hosting,
  empty setup, primitive parameters and historical delimiters. No autosave claim.
- Failed and stale loads preserve transactional/resource behavior. New UI listeners
  clean up on disposal. Sidebar transitions do not recreate the renderer, drift
  raycasting, reset the camera, or keep rendering while idle.
- Before/after desktop screenshots are reviewed against the reference's hierarchy
  and the current scene's model appearance. Pixel parity is not required for the
  intentional UI/background change; scene transforms and geometry are unchanged.

### Stage 3 exit criteria: responsive, accessible, polished

- Review 1024 × 768, 768 × 1024, 390 × 844, 320 × 568 and 844 × 390, plus short
  windows, 200% zoom and 320 CSS px reflow. All forms/actions can be reached;
  no offscreen close button, accidental canvas click-through or nested focus trap.
- Test panel changes with selection, a pending Add, a validation error and an
  open virtual keyboard. Focus and values survive breakpoint changes.
- Every DOM control has an accessible name, visible focus, appropriate state and
  measured contrast. Modal keyboard/focus return, screen-reader announcements,
  reduced-motion tutorial behavior and coarse-pointer targets are reviewed.
- Manual touch-device evidence covers orbit, pan/zoom, selection, gizmo dragging,
  cancellation and sheet scrolling. Document browser/device versions and remaining
  limitations; do not infer this evidence from desktop emulation.
- Help matches actual shortcuts, deselection semantics, units and saving behavior;
  all original instructional topics and navigation destinations remain available.
- No mobile warning is removed until the responsive modern editor is verified.
  Retained routes and their separate controls continue working.

### Test strategy

Keep existing unit suites for catalog compatibility, model resources/cache,
actions, selection, codec, share URLs, build mappings and render scheduling.
Browser coverage in `tests/e2e/planner.spec.js` currently exercises real GLBs,
categories, monitor stands, keyboard replacement, primitive sharing, failure,
camera/gizmo manipulation, tutorial, navigation, retained routes and desktop
dimensions. `performance.spec.js` covers idle rendering, cache ownership and DPR;
`development.spec.js` covers subpath mounts at port 5176. Retarget UI selectors
when markup intentionally changes; do not remove behavioral assertions to make
the suite pass. Test-only inspection can keep importing the exported app.

Use Node **24.22.1**, `npm ci`, `npx playwright install chromium`, then
`npm run check` (lint, formatting, unit tests, build and Chromium E2E). Leave port
4173 and the development test's 5176 available; stop manual servers. The current
Prettier ignore rules exclude `docs/design/`, so explicitly format/check these
documents with `--ignore-path /dev/null` without broadening repository formatting.

Asset audit/optimization and performance benchmarking are not necessary for a
documentation-only change. If a later stage changes assets, run `assets:audit`;
optimized copies also require `assets:optimize` verification and visual inspection.
Any performance comparison must use the documented harness without concurrent
tests. Do not invent speedup claims from a smaller-looking UI.
