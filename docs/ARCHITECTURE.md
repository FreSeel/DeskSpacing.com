# DeskSpacing architecture

The desktop planner at `/mainApp.html` uses vanilla JavaScript ES modules. There
is no application framework or global planner state. Page analytics uses the
legacy global dataLayer, and appearance setup patches the shared Three.js shader
chunk once for the compatibility tone curve. The desktop uses npm
Three.js 0.186.1 with matching ES-module addons. Older pages retain a separate
`three-legacy` r116 package. Model IDs, original URLs, authored
coordinates, visual settings, product IDs and the legacy sharing format are
compatibility boundaries.

The first extraction commit moved the original script without restructuring it;
subsequent commits separated serialization, scene/interactions, and object/UI
ownership. The temporary `legacyPlanner.js` module and global handler adapter have
been removed.

## Structure and responsibilities

| Location                        | Responsibility                                                                                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mainApp.html`                  | Semantic desktop shell, toolbar, workspace, inspector slots, tutorials and dialogs. The library is generated before binding actions; no embedded application logic. |
| `src/main.js`                   | Entrypoint; injects explicit npm engine exports once and exports the composed `app` lifecycle.                                                                      |
| `src/app/createApp.js`          | Generates the library, composes services and UI lifecycles, starts default/URL loading, handles startup failure, and tears down the app.                            |
| `src/app/pageSetup.js`          | Existing analytics initialization and desktop-only mobile notice.                                                                                                   |
| `src/scene/createScene.js`      | Renderer, camera, lights, fog, OrbitControls, TransformControls, resize handling and demand rendering.                                                              |
| `src/catalog/products.js`       | Stable product IDs, legacy types, asset paths, authored positions/rotations, display dimensions, textures and desk offsets.                                         |
| `src/catalog/configuration.js`  | Default setup, product families, primitive defaults, variant resolution and placement calculations. No DOM or Three.js dependency.                                  |
| `src/models/modelLoader.js`     | GLTFLoader boundary with shared, reference-counted templates, a bounded idle cache, Meshopt decoding and the legacy first-root convention.                          |
| `src/models/objectFactory.js`   | Builds model or primitive instances, loads primitive textures, and owns their resources.                                                                            |
| `src/models/resources.js`       | Disposes owned geometries, materials, textures, skeletons and ImageBitmaps; estimates cache retention.                                                              |
| `src/state/objectStore.js`      | Scene membership, instance names, desk offset and generation tokens.                                                                                                |
| `src/state/actions.js`          | Add, replace, remove, desk changes, reset, default initialization and transactional restoration. No DOM dependency.                                                 |
| `src/interactions/selection.js` | Maps raycast hits to registered roots, selects, deselects and deletes; publishes changed selection through a small subscription API.                                |
| `src/interactions/pointer.js`   | Coordinates pointer picking, gizmo dragging and camera controls.                                                                                                    |
| `src/interactions/keyboard.js`  | Workspace-scoped shortcuts, with editable-field, modifier and modal guards; shares transform commands with the inspector.                                           |
| `src/sharing/legacyCodec.js`    | Bounded, validated plain-data reader/writer for the historical setup format.                                                                                        |
| `src/sharing/sceneRecords.js`   | Converts live Three.js transforms and primitive parameters to plain records.                                                                                        |
| `src/sharing/shareUrl.js`       | Deployment-aware URL creation and safe query reading.                                                                                                               |
| `src/sharing/createSharing.js`  | Connects codec, snapshot, URL loading and state actions.                                                                                                            |
| `src/ui/catalogPanel.js`        | Reads form values, resolves variants, updates previews and filters stable catalog DOM without losing input values.                                                  |
| `src/ui/bindPlannerUI.js`       | Binds declarative actions, numeric validation, per-card busy/error state and sharing; guards disposed async completions.                                            |
| `src/ui/feedback.js`            | Visible load/validation errors. Uses text content, never HTML from a setup.                                                                                         |
| `src/styles/planner.css`        | Scoped desktop shell, cards, forms, inspector and dialog styles; tokens live in `src/styles/tokens.css`.                                                            |
| `src/legacy/ui.js`              | Existing Bootstrap tutorial/modal/tooltip initialization shared with retained pages.                                                                                |

New desktop presentation modules:

- `src/catalog/presentation.js`: eleven ordered categories and 41 cards with labels,
  explicit thumbnail URLs, all original option values and identity lookup. No DOM,
  Three.js or duplicated technical model data.
- `src/ui/catalogRenderer.js`: creates the library's 41 stable card/form subtrees;
  retains the action datasets and form IDs consumed by `catalogPanel`.
- `src/ui/dom.js`: safe text/element construction and thumbnail fallbacks.
- `src/ui/editorShell.js`: responsive-panel composition, disclosures and dialogs;
  menu/dialog focus return and text-first reduced-motion tutorial handling.
- `src/ui/responsivePanels.js`: adaptive panel layout and safe async completion.
- `src/ui/panelOverlay.js`: modal sheet focus, inertness and dismissal.
- `src/ui/selectionPanel.js`: derives identity, preview and capabilities from the
  actual selected root, and binds existing remove/deselect/transform commands.
- `src/interactions/commands.js`: shared mode, axis and size operations, reading
  the actual TransformControls state instead of maintaining a second mode flag.

Retained marketing/mobile/old/prototype sources live in `legacy/pages/` and retain their
existing implementations and URLs. They do not import the desktop app. Their
legacy styles and `src/legacy/share-url.js` bridge remain available. This separation
avoids silently changing their distinct UI/control behavior.

## Initialization and teardown

1. The desktop module bundles the modern npm engine and matching addons. The
   page separately loads Bootstrap/Popper for retained UI. Older routes use r116
   classic scripts; the desktop does not load those global engines or addons.
2. `src/main.js` starts the page services and calls `createApp` with explicit
   `THREE`, `window` and `document` dependencies. No planner service reads an
   implicit engine or DOM global.
3. `createApp` renders catalog controls, then constructs the scene, object factory, object store, selection,
   actions, sharing and UI, in dependency order. These are small functions and
   objects, not a service container or event bus.
4. A URL with `customSetup` is decoded and restored. Without that parameter, the
   six default objects load independently. Invalid initial links show an error and
   load a usable default scene. `app.ready` settles after all initial requests and error
   handling, including when one default model fails before the others. A later failed restore leaves the existing scene intact.
5. `app.dispose()` removes application listeners, invalidates outstanding loads,
   clears owned objects/resources, disposes controls/renderer and cancels the
   animation frame. The Vite hot-disposal hook also removes the page-load listener.
   Ordinary navigation releases the page through the browser lifecycle.

The public lifecycle object exposes `state`, `actions`, `selection`, `sharing`,
`view`, `ready` and `dispose`. Browser tests import that same entrypoint and create
their own test-only inspection alias; production does not publish `objectsArr`,
`scene`, `renderer` or inline-handler globals.

The render scheduler coalesces changes, follows OrbitControls damping/change
events, and stops when idle or hidden. Store mutations and gizmo object changes
invalidate shadows; camera motion reuses the shadow map. Device pixel ratio is
capped at 2. See [PERFORMANCE.md](PERFORMANCE.md) for measured results and the
explicit color, light, tone-mapping and control compatibility decisions. Direct
transform/material edits outside actions must call `view.invalidateScene()`;
camera-only animation code must call `view.invalidate()`.

## Lifecycle of a 3D object

1. A catalog button identifies a fixed product or a family. `catalogPanel` reads
   dropdown/stand choices and primitive dimensions. The resulting call contains
   product data, not DOM elements.
2. `actions.add` resolves a plain record through `createRecord`. A replacement
   captures its target identity and X/Z position immediately. Y and rotation come
   from the new product, as in the original planner. Desks use the current desk as
   their replacement target.
3. The factory loads a model or creates a grouped box/octahedron. Only allowlisted
   catalog paths are used. The former first-child glTF root convention is retained
   to avoid changing authored transforms. All resources from that load remain
   owned, including resources belonging to unused roots.
4. After loading, the action checks the scene generation and original target. A
   reset, superseding restore or deleted target makes the completion stale: its
   resources are released without inserting it into the scene.
5. On success the store assigns the legacy `product-N` instance name, metadata and
   transforms, then registers the object with the scene. Only then is a replaced
   object removed. Desk changes shift existing non-furniture objects by the
   configured height difference. Failed loads retain the old object and heights.
6. Selection attaches TransformControls to the owned root. A raycast walks up from
   nested meshes until it finds a registered root. `NoSelect` retains its legacy
   meaning; camera controls are disabled while dragging the gizmo.
7. Deletion detaches selection and removes the registered root and its resources.
   Reset does the same for all objects and advances the generation token.

The store owns membership, identity and desk offset; selection owns its current
root. Live Three.js transforms are authoritative. Saving reads a fresh plain-data
snapshot, so gizmo movement cannot leave a second state model out of sync.

Model requests are deduplicated by URL, including pending requests. Instances use
SkeletonUtils cloning and independent materials/transforms with shared immutable
geometries/textures. Reference counts protect surviving instances. Unused templates
are retained up to an estimated 32 MiB budget and evicted in least-recently-used
order; active templates are not counted against that idle budget. Full app disposal
releases the cache, including loads completing after shutdown. Primitive resources
remain independently owned. Original paths stay in the catalog; a generated
`optimizedModels.js` manifest redirects five verified startup assets to copies.

## Adding a product or model

For a fixed model:

1. Add its asset under `public/models/` at a stable relative path. Use its
   published URL in the catalog; `scripts/site-layout.js` maps URLs to sources. Keep filename case, spaces and sidecar
   resources intact; do not rename existing assets as part of adding a product.
2. Add a unique, permanent key in `products.js`, with `type`, `position`,
   `rotationY`, `modelPath` and display `dimensions`. Coordinates are the existing
   inch-based scene coordinates; rotations are radians. Authored mesh origins
   mean placement is not necessarily the visible object's geometric center.
3. Add a card in `src/catalog/presentation.js` with its product ID, category,
   name and explicit thumbnail URL. The renderer creates Add/Replace buttons;
   no product-specific JavaScript handler or handwritten HTML is needed.
4. For a desk, also add its height difference from the modern desk to `deskOffsets`
   and use the existing desk type convention. Model creation and desk replacement
   need no new handlers.
5. Run catalog/unit tests and add a browser check for any new behavior or asset
   format. The path check fails for missing assets except the documented baseline
   `drawerDesk` entry.

For a variation family, add its definition to `families`, ordered select metadata
in `presentation.js`, and product IDs matching `family + optionValue`. The renderer
creates `<family>Form` selects and `<family>Stand` checkboxes. The adapter reads
checkbox `.checked`; `resolveProduct` retains the `NoStand` suffix. Keyboard previews
use `<family>Image` and `Model thumbnails/<productId>.jpg`. A new variation normally
needs only a product entry, its asset/thumbnail and one metadata option. Validate
all choices with the presentation parity tests; do not expose compatibility-only
records by iterating the full technical catalog.

Custom desks and reference shapes use `primitives`. The DOM adapter preserves the
legacy mapping of L/W/H inputs to Three.js width/height/depth; custom desks have
one-inch thickness. Reference spheres retain the r116 tessellation of `OctahedronBufferGeometry(radius, 5)`
(modern `OctahedronGeometry(radius, 31)`).
Display dimensions are descriptive legacy strings, not a source for geometry.
Some strings are known to be inconsistent; this extraction does not reinterpret
or correct model measurements.

## Responsive UI state and canvas integration

`selection.subscribe(listener)` immediately supplies the current root and returns
cleanup. Changed pick/deselect/delete paths notify it; there is no polling or
second selection model. The inspector resolves display identity from metadata,
reads live primitive material identity where applicable, and omits transform tools
for `NoSelect`. Closing it deselects; Remove calls `actions.remove`. Existing
empty-space clicks keep selection. Both keyboard and buttons read the real
TransformControls mode, axes and size. Canvas clicks establish workspace focus;
shortcuts also work within the inspector, but pause in editable fields or modals.

The shell has a 64px header and independently scrolling library/inspector. At
1440px and above their widths are 360/288px; at 1280–1439px they are 320/256px.
A hidden panel consumes no width. Visibility commits are coalesced in a microtask,
so transactional replacement does not flash an empty inspector; commits wait
while TransformControls is dragging and flush after completion/cancellation.
When focused inspector content disappears, focus returns to the workspace.

The single canvas remains inside `#rightSideContainer`, outside both panels.
The existing ResizeObserver updates renderer size and camera aspect from that
host, with the existing DPR cap. Pointer coordinates still use the current canvas
rectangle. Background is now warm `#E7E7E1` with explicit scene invalidation;
lights, fog, materials, camera pose, model geometry and resource ownership are
unchanged. No new animation loop or WebGL renderer was introduced.

Search/category filters hide stable DOM nodes; options and pending requests survive
filtering. One expanded card at a time spans the library width to keep its creation
controls readable. Number fields preserve legacy inch-to-axis mapping and are
validated before the existing action/codec validation. Errors remain in the card;
other cards stay usable. Null stale completions never announce success. The UI
subscription/listener cleanup belongs to `createApp.dispose`.

Help and More are native disclosures. Bootstrap continues to own dialogs and the
seven-slide tutorial. Opening a dialog closes the disclosure; closing Help returns
focus to its visible summary. Welcome is available on demand. Tutorial GIFs load
only while the dialog is open and reduced motion is off; all seven text topics
remain available without GIFs. Share / Save always generates a fresh URL snapshot.

Future UI work should extend these adapters and scoped tokens. Keep creation
choices in presentation metadata, mutations in actions and membership in the store.
Do not add editable object properties before their application behavior exists.
`src/ui/responsivePanels.js` owns presentation only: breakpoint, visible panel,
expanded sheet, active pointers and a panel-session counter. At 1024–1279px one
304px dock switches between Objects and Selected. A canvas pick opens Selected;
adding from the library keeps Objects available. Below 1024px a separate 56px
selection row leaves the canvas unobscured. Controls expands the same inspector
into a modal sheet; Done collapses without deselecting. Tablet Objects uses a
320px drawer; below 768px it becomes a bottom sheet, normally at most 80dvh.
At 320px cards use one column. Short screens can use full-height sheets.

`src/ui/panelOverlay.js` owns dialog semantics, focus containment, Escape,
background inertness and return focus. The backdrop blocks clicks only while a
modal sheet is open. The compact selection row is non-modal. Bootstrap retains
its own focus trap for Help/Share dialogs; the shell makes their background inert.
Crossing breakpoints closes obsolete modal surfaces and preserves the actual form
nodes and selection. Layout commits wait for both TransformControls dragging and
active canvas pointers, including cancellation/lost capture. Drawer/sheet opening
itself does not resize the canvas; the dock and compact row do.

A successful phone catalog operation closes only the same sheet session that
started it. Failed or null/stale operations keep their forms. Closing/reopening or
crossing a breakpoint invalidates that UI session, so late completions do not
steal focus. This supplements, without replacing, action-generation guards.

`src/styles/responsive.css` extends the existing warm tokens, with 44px compact
and coarse-pointer controls, 16px form fields, safe-area padding, dynamic viewport
height, contained scrolling and forced-color boundaries. VisualViewport events
coalesce into a single animation frame to keep focused sheet fields above a
software keyboard; no idle polling is added. `createFeedback` derives empty-scene
guidance from store membership notifications, gated by startup loading. It does
not introduce scene state. Inspector mode/axis attributes update only when their
value changes, not on every transform event.

Accessibility conventions: use native buttons and labeled inputs; preserve live
count/selection announcements and associated card errors; provide a visible close
control for every modal surface. Scene shortcuts require workspace/inspector
focus and pause for fields and modal sheets. Reduced motion keeps all tutorial
text while suppressing GIF loading. Extend these patterns for future features,
using actions for edits and existing component subtrees across breakpoints.
Physical touch devices, software keyboards, screen readers, Safari and Firefox
still need dedicated verification. Canvas object discovery and non-drag movement
remain keyboard-accessibility limitations; this is not a WCAG conformance claim.
The existing mobile warning remains pending the physical-device support decision.

## Saving and sharing

There is no server or separate browser-storage save format. The share dialog
serializes the current scene into `customSetup` on the current page's origin and
path. Existing query/hash values are removed and the payload is URL-encoded, so
root and project-subpath deployments work alike.

A plain record contains `type`, `product`, `position[3]`, `rotation[3]`, and, for
primitives, `dimensions[3]` and `texture`. The wire format remains:

```text
[ Type|product|x,y,z,|rx,ry,rz,| ^PrimitiveBox|referenceBox|x,y,z,|rx,ry,rz,|w,h,d,|null|^ ]
```

The desktop writer uses `^`; the reader accepts both `^` and historical mobile
`*` primitive delimiters. Spheres encode `[radius, -1, -1]`. Type strings,
product IDs and floating-point transforms are retained. The first `customSetup`
parameter wins, matching the old query semantics. Camera and selection are not
saved, matching the original scope.

Decoding has no scene, DOM or Three.js dependency. It validates the complete
payload before actions run: maximum 100,000 characters, 500 objects, finite
position/rotation components within ±1,000,000, positive primitive sizes up to
10,000, and known product/texture IDs. The limits are intentionally generous for
normal setups. Arbitrary asset URLs are never accepted. Empty `[ ]` is valid.

Restoration stages all model/texture loads before committing. Any failure releases
staged resources and retains the current setup. A successful commit replaces the
scene with the decoded transforms, without applying desk offsets a second time.
Starting a new restore/reset invalidates earlier pending loads.

## Verification and remaining work

The extraction originally passed 42 unit tests and 13 Chromium browser tests.
Current migration/performance verification is recorded in
[PERFORMANCE.md](PERFORMANCE.md), including the added cache and rendering tests.

Unit coverage includes baseline catalog paths/coordinates/dimensions, variant
resolution, primitive placement, both legacy codecs, malformed/bounded input,
URL encoding, state identity/membership, nested selection, editable shortcut
guards, delayed replacements/reset, failed restores and resource ownership.
Browser coverage includes default real GLBs, every product category, monitor
stands, keyboard previews/replacement, custom desk textures/dimensions, primitive
sharing, historical mobile payloads, camera reset, live gizmo translation/rotation,
delete shortcuts, load failures, menus, tutorial navigation and retained routes.

A local comparison against the pre-refactor HTML matched all six default object
transforms and the camera position exactly. The 854 × 800 software-WebGL canvas
captures differed in 16 of 683,200 pixels (0.0024%), and were visually inspected.
This is a default-scene check on one environment, not an all-model visual guarantee.

Deliberately retained or deferred:

- Mobile/old/prototype scripts remain inline and have their original limitations;
  only the desktop planner uses the new codec and lifecycle safeguards.
- The first glTF root is still rendered. Multi-root model rendering needs authored
  transform/bounds comparisons before changing it.
- New GLB additions still use their original baseline Y coordinates after a desk
  change. Existing non-furniture objects shift; new primitives use the current
  desk offset. This historical inconsistency is documented and characterized,
  rather than silently changing placement during extraction.
- `drawerDesk` points to the pre-existing missing `desks/regular_desk_1.glb` and is
  not exposed by the desktop catalog. Its ID/path remain for compatibility; a
  restore using it now reports a load failure.
- Catalog card markup, some duplicate HTML IDs, inline presentation styles and
  hidden unfinished settings remain. Product metadata is centralized, but cards
  are not yet generated from configuration.
- Model simplification, broader texture optimization and full touch/accessibility
  work remain separate tasks. The measured performance scope and visual comparison
  limits are documented in PERFORMANCE.md.
- Browser verification uses Chromium software WebGL. Real GPU devices,
  Firefox/WebKit and production hosting need their own checks.

## Light and dark themes

The two active entrypoints (`index.html` and `mainApp.html`) share one theme:
`src/styles/tokens.css` defines semantic custom properties on `:root`, with
`[data-theme='dark']` overriding only their values. Shared primitives, home,
planner and responsive CSS consume the same tokens; there are no duplicate
component themes or theme libraries. Historical pages under `legacy/pages`
retain their original styling and are not migrated by this feature.

Token roles:

- `bg`, `surface`, `surface-muted`, `card`, `elevated`, `dialog`, `canvas-ui`
  describe page, panel, secondary, card, popover, modal and floating surfaces.
- `text`, `text-secondary`, `text-muted`, `accent`, `border`, `border-control`
  cover readable content, separators and identifiable control boundaries.
- `hover`, `active`, `selected`, `focus`, `primary`, `primary-hover`,
  `primary-active`, `on-primary`, `secondary`, `input`, `disabled` and
  `disabled-text` describe control states rather than fixed palette colors.
- `danger`, `danger-bg`, `danger-surface`, `danger-border`, `tooltip`,
  `on-tooltip`, `scrollbar`, `backdrop` and `modal-backdrop` cover feedback and
  overlays. All these names use the `--color-` prefix.
- `thumbnail` is a neutral product-photo staging surface; `thumbnail-text`
  keeps missing-image labels legible on it. Existing thumbnails
  keep their assets and multiply blending so dark products remain legible;
  homepage previews and tutorial recordings retain their authored colors.
  Shadows use `--shadow-tool` and `--shadow-dialog`.

New components should use these semantic properties, inherit text/icon color,
and provide visible hover, selected and `:focus-visible` states. Do not add
hardcoded light backgrounds or invert images. Text should reach 4.5:1 contrast;
focus and essential control boundaries should reach 3:1. Subtle separators and
disabled controls serve different roles and need not use the input border token.
Use native controls and keep forced-color overrides available.

### Startup and preferences

Both HTML heads load `src/theme/bootstrap.js` as a small, parser-blocking classic
script before their stylesheets. It applies `data-theme` and `color-scheme` before
the body is parsed, independently of the editor's module graph or model loading.
It has no dependencies or production globals. `scripts/site-layout.js` mounts
that exact script for production copying and development; relative URLs work at
both root and project-subpath deployments. Do not change it to a deferred module.

The Appearance selector lives in the homepage Help & links/Menu disclosure and
the editor More disclosure. Its native select offers System, Light and Dark,
with a label and live resolved-theme status. Explicit choices use the
origin-scoped `localStorage` key `deskspacing.theme` (`light` or `dark`). System
removes the key. Missing or invalid values follow
`matchMedia('(prefers-color-scheme: dark)')`, including subsequent OS changes.
Manual choices take precedence. Storage events synchronize other open pages;
blocked storage/quota errors retain the choice in memory for the current document.
Persistence across reloads cannot be guaranteed when storage is unavailable.

### Workspace integration and verification

`src/theme/workspaceTheme.js` reads `--color-workspace` and updates the existing
`scene.background` color. It calls `view.invalidateScene()` once per resolved
theme change and removes its listener when the application is disposed. No
renderer/scene recreation, asset reload, continuous rendering, geometry,
materials, lighting, fog, camera or transform changes are involved.

`tests/e2e/theme.spec.js` exercises system/manual preferences, navigation, reload,
cross-tab synchronization, denied/quota-limited storage, early initialization
with application modules blocked, semantic contrast, keyboard focus, scene
identity and idle rendering. It captures both themes at desktop and phone sizes
for the homepage, menu, library, selected-object inspector and all four dialogs.
Native-font screenshot baselines are macOS Chromium-specific, consistent with
the existing responsive suite. Other platforms still run behavioral checks and
save captures. Browser automation checks early initialization, not a physical
screen measurement of flashing under every browser/network condition.

The pre-existing missing `drawerDesk` asset and legacy npm advisory remain open.
Chromium software-WebGL and emulated mobile sizes do not certify real mobile
hardware, Safari, Firefox or every GPU.

## Measurement units

The modern planner keeps geometry, transforms and legacy share records in inches
(one scene unit = one inch). `src/measurements/units.js` is the DOM/Three.js-free
conversion and formatting boundary, using exactly 2.54 centimeters per inch.
`src/measurements/preference.js` owns the active `in`/`cm` preference and publishes
changes. Like appearance settings, it uses origin-scoped localStorage
(`deskspacing.unit`), synchronizes storage events, and tolerates unavailable
storage. Missing or invalid preferences retain the historical inches default.

`src/ui/measurementUI.js` binds the toolbar CM/IN segmented toggle (native radios
with arrow-key navigation and visible focus), custom desk width/length,
box L/W/H and sphere radius, limits, error messages, and catalog measurement
copy. Only user input changes the full-precision canonical form drafts; toggling
units formats those drafts without feeding rounded values back into them. Empty
and out-of-range drafts remain invalid. Inputs retain arbitrary decimal steps
and the existing positive, maximum-10,000-inch constraint (25,400 cm). Custom
desk thickness stays one inch. Box L/W/H retains the existing mapping to
Three.js width/height/depth; sphere values remain radii, not diameters.
Fixed-size product options retain their IDs while labels change units. Inspector
copy and search-match measurements use the same formatter.

The existing add/replace actions perform edits; live transforms remain authoritative.
Unit changes do not touch geometry, materials, camera, selection, scene membership,
or serialization. Transform gestures have undo/redo history (see below); there is
no direct inspector dimension editor. Viewer annotations derive measurements from live
geometry/transforms and use the shared formatter and preference. Authored catalog descriptions remain approximate
product copy (including known historical inaccuracies), not measured mesh bounds.
Retained historical planners are unchanged.

Focused verification: `npx vitest run tests/unit/measurements.test.js
 tests/unit/model-factory.test.js tests/unit/legacy-codec.test.js
 tests/unit/state-actions.test.js` and
`npx playwright test --config=playwright.measurements.config.js`.
The latter uses the development server at port 4173 without a production build.
Tests compare centimeter inputs against actual primitive geometry bounds, preserve
full-precision records across switches, exercise creation/replacement and saved
links, and check persistence, validation and toolbar accessibility/layout.

## Selected-object dimensions

`src/measurements/objectDimensions.js` reads actual mesh vertices in a stable
object frame, using the catalog's authored Y rotation to establish W (X), D (Z)
and H (Y). This accounts for legacy models exported sideways without swapping
width/depth when users rotate them. Descendant matrices, import wrappers and
root scale are included; root translation and user rotation do not enlarge the
physical dimensions as a world-axis bounding box would. Unknown objects use
their root-local axes. Geometry bounds are derived without modifying shared
geometry, using mesh vertex accessors for morph/skinning and instance matrices
where present. Only the selected object's derived bounds are cached; geometry
identity/attribute versions, visibility and descendant transforms invalidate the
cache. Camera movement does not rescan vertices. Buffer edits must mark their
attributes `needsUpdate`, as required by Three.js rendering itself.

`src/scene/dimensionAnnotations.js` subscribes to selection, the shared measurement
preference, and `view.subscribeRender()`. It reuses three SVG paths and three
camera-facing HTML labels within the canvas container. `dimensionLayout.js`
projects bounding edges with the active camera, places labels outside the
projected object silhouette, separates labels and uses leaders for edge-on axes.
CSS follows existing theme tokens. Pointer events are disabled for the entire
annotation layer. No scene objects, raycast targets, GPU resources, additional
animation loop or saved fields are introduced. Selection and unit changes update
the labels; ordinary invalidated renders track object and camera changes.
Teardown removes every listener and the annotation subtree. A keyboard-accessible
Dimensions toggle at the bottom-right of the viewer hides/shows both lines and
labels. It defaults to on for each page session, retains its state across selection
and unit changes, and skips measurement work while off; it does not alter saves.

Desk selection is now available for dimension inspection. Locked desks remain
without transform handles; ray picking still prioritizes movable accessories,
and the floor remains unselectable. Custom desks select after creation/replacement.
Their H value is the existing one-inch tabletop thickness, not a fabricated desk
height. Sphere W/D/H are diameters, while their existing input remains radius.
Monitor measurements include their rendered stand/body, not a marketed diagonal.
Existing numeric forms, replacement transactions, persistence, geometry and
placement conventions otherwise remain unchanged.

Limitations: dimensions describe rendered model extents, which may differ from
rounded catalog copy or manufacturer specifications. Shader displacement is not
measured. Labels can be suppressed when the object crosses the camera near/far
planes or there is no room outside its silhouette within the viewport; zooming
out or orbiting restores them. Lines remain visible over other objects for
readability rather than being depth-occluded. Crowded views and physical mobile
hardware still need broader visual QA. The missing `drawerDesk` and legacy npm
advisory remain open; Chromium checks do not certify Safari or Firefox.

Focused checks: `npx vitest run tests/unit/object-dimensions.test.js
 tests/unit/selection.test.js tests/unit/state-actions.test.js
 tests/unit/render-scheduler.test.js tests/unit/measurements.test.js` and
`npx playwright test --config=playwright.measurements.config.js` (the measurement
and dimension feature tests only, using the development server without a full
build). Coverage includes actual primitive and imported geometry scale,
rotation/movement/resizing, unit changes, pointer picking/orbit, locked desks,
deletion/reload, disposal and settled idle rendering. Screenshots are captured
for visual inspection, not treated as cross-platform pixel baselines.

## Grid snapping and transform history

`src/snapping/resolveSnapping.js` is the DOM/Three.js-free strategy boundary.
It accepts an object, proposed world position/quaternion/scale, nearby objects,
configuration, camera/view context, placement axes/surface context, mode, bypass
state and optional gesture context. Strategies return a resolved transform and
optional guidance. Magnetic object alignment runs before grid resolution; future
surface strategies can use this same entrypoint without another drag pipeline.
No unfinished settings are exposed.

`src/interactions/snapping.js` listens to the existing TransformControls
`mouseDown`, `objectChange` and `mouseUp` events. Three.js continues to own pointer
projection, drag offset, axis constraints and the unsnapped proposal from the
original pointer-down transform. The adapter resolves that proposal in world
space and applies its position through `actions.transforms.moveWorldPosition`.
There is no parallel scene state or use of TransformControls' built-in rounding.
The current controls use world axes; local-axis handles would need an explicit
constraint policy before being exposed. The grid aligns authored root origins,
not geometry bounds, which is relevant to future edge/surface alignment.

Snapping defaults to off, with one-inch spacing. It snaps only the translated
axes; untouched height, rotation, dimensions, authored mesh origins and geometry
remain unchanged. A press or less than half a cell of initial movement retains
the starting position on each axis. Once acquired, integer grid indices and a
5%-of-cell midpoint hysteresis band prevent tremor from alternating adjacent
cells. Raw proposals always come from Three.js, so corrections do not accumulate.
Alt/Option bypasses resolution while held. Preference or modifier changes do not
move objects on their own; the next pointer movement uses the new setting.

`src/snapping/configuration.js` and `preference.js` keep physical spacing in inches
under `deskspacing.snapping`, with in-memory fallback and cross-tab storage
synchronization. Valid spacing is 1 mm through 100 inches. `src/ui/snappingUI.js`
uses the shared CM/IN preference to display/edit spacing, never feeding a rounded
display value back on a unit switch or unchanged focus/blur. The native Snap
toolbar disclosure contains a checkbox and numeric field; its label and theme
colors show the enabled state. A temporary workspace badge shows snapping/bypass
without scene objects, dimension annotations or GPU allocations.

The planner previously had no undo stack. `src/state/transformActions.js` adds a
bounded, session-only history of 100 completed move/rotation gestures. Empty
clicks add nothing and intermediate pointer updates never create entries.
Undo/redo restores exact position, Euler rotation/order and scale snapshots,
invalidates the scene and never re-snaps. More-menu buttons and workspace-scoped
Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z provide access; fields and dialogs retain native
shortcuts. Adds, removals, replacements, desk shifts and resets clear this
transform-only history via store subscriptions. An in-flight gesture ends if
membership changes invalidate its origin/candidates. Failed asynchronous loads
preserve current history. Pointer cancellation/blur completes the current gesture
and restores camera input. Deletion/creation undo and history persistence are
outside this foundation. Share links still serialize final live transforms in
the unchanged legacy format; preferences are separate from projects.

Focused verification (Node 24.22.1, `npm ci`, Chromium installed):

```sh
npx vitest run tests/unit/snapping.test.js tests/unit/transform-snapping.test.js tests/unit/state-actions.test.js tests/unit/measurements.test.js
npx playwright test --config playwright.snapping.config.js
```

The browser configuration uses Vite source serving at port 4173 and the project
subpath, without a production build. Tests exercise native gizmo drags at two
camera angles, signed grid positions, bypass, free movement, exact undo/redo and
sharing, units/persistence, blocked storage, dimensions, cancellation, idle
rendering and toolbar layouts. This does not certify mobile hardware, Safari or
Firefox. The existing missing `drawerDesk` asset and legacy npm advisory remain
open.

## Magnetic object alignment

The existing Snap disclosure now has a master checkbox and independent Grid and
Objects checkboxes. Grid spacing remains in canonical inches and follows the
existing CM/IN display preference. Existing stored preferences migrate to Grid
on and Objects off; the master default remains off. Explicit strategy choices
persist through reloads, unit changes and master toggles. Surface contact is
an independent strategy described below; automatic distribution/symmetry is not exposed.

### Geometry and supported anchors

`src/snapping/objectFootprints.js` reuses the vertex-derived, authored-frame bounds
from `createObjectDimensions`. That reader now accepts an optional mesh filter;
dimension annotations retain their existing default. Alignment skips invisible
meshes, including meshes with partially hidden material sets, and hidden ancestor
hierarchies. Transforming the oriented proxy corners through the full world
matrix accounts for root/descendant geometry offsets, rotations, parent transforms,
nonuniform scales and mirrored transforms. The X/Z convex hull of those corners
is used directly, without turning it into a larger world-axis box.

Supported relationships are parallel edge-to-edge alignment (same edge or flush
adjacency), world X/Z and target-oriented centerlines, paired edge/center
constraints, and coincident footprint corners, including nonparallel objects.
Different object dimensions and authored origins remain intact. For complex or
curved objects these are bounding-footprint proxies, not invented manufacturer
measurements or exact mesh contact. No rotation, resizing, collision prevention,
stacking or permanent constraints are applied.

Only registered scene objects enter target preparation. Self and supplied moving
sets are excluded. Locked desks remain eligible as inspectable support objects;
floors and other NoSelect roots are excluded. Bottom levels must agree within
one inch, or the moving bottom must be within one inch of a desk's upper bound.
Candidate footprints must be within a 12-inch gap on their separating axes.
These are conservative horizontal alignment rules. The independent surface
strategy resolves actual vertical contact before horizontal alignment.

### Detection, priority and stability

`src/snapping/magnetic.js` builds geometric relationships once per gesture.
`cameraMetric.js` scores proposed corrections in CSS pixels through the current
camera projection. Acquisition is limited to eight pixels and two world inches;
a held relationship releases beyond fourteen pixels or 3.5 inches. The physical
cap prevents large attraction in far-away or nearly edge-on views. Initial
magnetic acquisition requires two pixels of intentional movement, preserving the
pointer-down offset. Alt/Option or the master toggle bypasses all strategies.

A compatible two-constraint match (corner, center pair, or edge plus center) wins
over a single line match, then smaller pixel corrections and stable target/anchor
keys break ties. A held match keeps its target until release; it can upgrade to a
second constraint on that same target. Constraints from unrelated targets are
not combined. Magnetic resolution claims the world axes its constraint needs;
grid resolution only receives the remaining axes. A diagonal edge can reserve
both X and Z. Guide positions follow the final result even when the grid adjusts
a free axis. Undo/redo continues to record one exact completed gesture.

### Guides and performance

`src/scene/snappingGuides.js` owns a pointer-transparent SVG overlay, separate from
object membership and dimension annotations. Six magnetic paths, four anchor markers and a surface contact outline
are allocated once, projected through the active camera and reused. Guides use
theme colors and disappear on release, bypass, preference changes, cancellation,
deselection, membership changes and disposal; near/far-plane clipping suppresses
invalid projections. No GPU geometry, materials or animation loop are added.

Geometry readers are weakly cached per root. Vertex bounds are reused across
gestures and invalidated by the existing geometry/version/descendant signature
when preparing a gesture. During a gesture, both strategies share one per-update
signature of root/descendant transforms, visibility, materials and geometry versions;
changed signatures rebuild the prepared relationships. Uncorrected movement keeps
the native local transform exactly, avoiding unnecessary world/local round trips.
Separating-axis ranges and anchor constraints are precomputed. Pointer updates
score nearby candidates without rescanning vertices. The current planner has
static geometry during translation; runtime skinning/morph animation would need
explicit in-gesture invalidation before being supported.

## Surface contact snapping

The Snap disclosure includes an independent Surface checkbox, defaulting off for
both new and migrated preferences. The master toggle and Alt/Option bypass all
three strategies. Surface contact uses inches internally; CM/IN changes only the
display. No project fields, parenting, automatic attachment or dependencies are
introduced. Existing authored origins and desk replacement offsets are preserved.
Moving a support does not move previously placed accessories.

### Eligible geometry and contact

`src/catalog/placement.js` recognizes catalog desk IDs and the floor primitive.
There are no shelf products or shelf placement semantics in this catalog; arbitrary
boxes, chairs, monitors, lamps and other decorative geometry are not supports.
Only registered objects enter preparation. Self, supplied moving sets, hidden
ancestors/descendants, invisible materials and meshes marked `snappingIgnore` are
excluded. Annotations, guides and gizmos are outside membership entirely.

`src/snapping/surfaceGeometry.js` opts into cached vertex/topology data from the
existing dimension reader. It transforms actual vertices through the complete
world matrix, including authored descendant offsets, noncentral pivots, rotations,
nonuniform scale and mirrored/nested parents. The moving contact height is the
lowest physical vertex, not the object origin or a transformed bounding-box corner.
The center of that lowest region (within 0.001 inches) is the support probe; its
convex footprint is used only for feedback, never to enlarge support geometry.

Known desks and floors use a controlled geometric fallback: the highest horizontal
plane with at least 25% of the largest horizontal plane's area. This excludes small
trim/leg caps. Coplanarity tolerates 0.01 inches of authored tabletop tessellation
noise, including the slightly uneven Bekant tops. Nearby triangle heights are
grouped by distance instead of rounding-bin boundaries. Contact is approximate
within that tolerance; no slope-following rotation is applied. Real
triangles are retained, so L-shaped cutouts and holes are not filled by a bounding
rectangle. Sloped surfaces are excluded; accessory rotations are never changed.
A product with raised structures or multiple usable levels would need explicit
per-product regions before being supported. Decorative hanging parts on a moving
accessory still count toward its physical bottom; there is no invented mounting
point for monitor arms or lights.

### Acquisition, release and precedence

Acquisition starts after two CSS pixels of intentional native translation. The
bottom must be within one inch of the surface, and its center must be inside the
triangle union with a 0.05-inch inset. Partial overhang is allowed while that center
remains supported; there are no collision constraints. A held target remains until
the center crosses the actual boundary or vertical intent exceeds two inches.
Nearest height wins initial selection, with stable target keys breaking ties. A
held target wins over overlapping alternatives; horizontal transfers can only
reacquire the same level (0.01-inch tolerance). Explicit Y movement permits other
levels. After vertical release, acquisition waits until the object leaves that
support's acquisition band, avoiding repeated sticking or switching during upward drags.

`src/snapping/resolveSnapping.js` resolves support/contact first, magnetic X/Z next,
then grid on the remaining X/Z axes. With Surface enabled, grid never quantizes Y.
If a horizontal correction would take a valid raw contact off its support, that
correction is rejected as a whole. A horizontal correction onto valid support can
acquire contact in the same resolution, with guides following the final position.

`src/interactions/snapping.js` remains the only adapter for native TransformControls
proposals. A gesture-local vertical offset keeps acquired height when leaving a
surface, toggling a strategy or bypassing. Free movement continues with subsequent
native deltas instead of jumping back to the pre-contact Y. A new gesture starts
from the live transform. The existing transform action records one exact undo/redo
entry and the existing codec saves the final local position without re-snapping.

### Feedback, caching and focused verification

A reusable solid neutral outline and small contact cross distinguish surface
contact from dashed accent magnetic guides and labeled dimension annotations.
Feedback is pointer-transparent, theme-aware and removed with the shared gesture
cleanup. It adds no GPU resources or render loop. Only eligible support roots and
the moving object are inspected; gesture preparation caches triangles and contact
vertices. Drag updates check transforms, visibility and geometry versions and only
rebuild when these change. Geometry data is reused across gestures; runtime
skinning/morph animation during a drag would need additional invalidation.

Focused tests cover offsets/heights, actual tilted/scaled/nested contact, floor and
concave boundaries, competing levels, free release, bypass/toggles, independent
preferences, all three modes, exact history/codec/reload, units, indicator cleanup
and idle rendering. Chromium also loads the modern, standing, Linnmon, Alex and both
Bekant L-shaped desk families to verify their actual imported support geometry.
The legacy wire format still has no general scale/parent serialization. No shelf,
inclined-surface, physics or collision-placement behavior is claimed. The missing
`drawerDesk` asset and legacy npm advisory remain open; desktop Chromium checks do
not certify mobile interaction, Safari or Firefox.

## Files and focused verification

Added: `src/snapping/footprint.js`, `src/snapping/objectFootprints.js`,
`src/snapping/cameraMetric.js`, `src/snapping/magnetic.js`,
`src/scene/snappingGuides.js`, `tests/unit/magnetic-snapping.test.js`, and
`tests/e2e/magnetic-snapping.spec.js`, `src/catalog/placement.js`,
`src/snapping/surfaceGeometry.js`, `src/snapping/surface.js`,
`tests/unit/surface-snapping.test.js` and `tests/e2e/surface-snapping.spec.js`.

Updated: `mainApp.html`, `src/app/createApp.js`, `src/interactions/snapping.js`,
`src/measurements/objectDimensions.js`, `src/snapping/configuration.js`,
`src/snapping/preference.js`, `src/snapping/resolveSnapping.js`,
`src/ui/snappingUI.js`, `src/styles/planner.css`,
`tests/unit/snapping.test.js`, `tests/unit/transform-snapping.test.js`,
`playwright.snapping.config.js`, and this document.

```sh
npx vitest run tests/unit/surface-snapping.test.js tests/unit/magnetic-snapping.test.js tests/unit/snapping.test.js tests/unit/transform-snapping.test.js tests/unit/object-dimensions.test.js
npx playwright test --config playwright.snapping.config.js
```

The browser configuration runs only the grid, magnetic and surface feature tests against
Vite source serving. Focused coverage includes signed edges, adjacency, centers,
corners, authored offsets, rotated/mirrored/scaled parent geometry, target ties,
hysteresis, camera scaling, grid priority, independent settings, bypass, exact
undo/redo and sharing, guide cleanup, blocked storage, and idle rendering.
A representative 50-object scene verifies guide/GPU-resource reuse after the
native gizmo's initial resource upload; a 50-object calculation test verifies no
vertex reads during 120 position updates. These are bounded resource/caching
checks, not a throughput benchmark or a claimed speedup. Light/dark alignment
captures and the narrow-screen settings layout are visually inspected. No full
suite, production build, asset optimization or comprehensive regression run is
part of this phase. The missing `drawerDesk` asset and legacy npm advisory remain
open; Chromium checks do not certify Safari, Firefox or physical mobile hardware.
