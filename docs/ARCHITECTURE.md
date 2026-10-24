# DeskSpacing architecture

The desktop planner at `/mainApp.html` uses vanilla JavaScript ES modules. There
is no application framework or global application state. The desktop uses npm
Three.js 0.186.1 with matching ES-module addons. Older pages retain a separate
`three-legacy` r116 package. Model IDs, original URLs, authored
coordinates, visual settings, product IDs and the legacy sharing format are
compatibility boundaries.

The first extraction commit moved the original script without restructuring it;
subsequent commits separated serialization, scene/interactions, and object/UI
ownership. The temporary `legacyPlanner.js` module and global handler adapter have
been removed.

## Structure and responsibilities

| Location                        | Responsibility                                                                                                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `mainApp.html`                  | Existing catalog cards, forms, menus, tutorials and dialogs. Buttons use `data-action`, `data-product` or `data-family`; no embedded application JavaScript or event handlers. |
| `src/main.js`                   | Entrypoint; injects explicit npm engine exports once and exports the composed `app` lifecycle.                                                                                 |
| `src/app/createApp.js`          | Composes services, starts default/URL loading, handles startup failure, and tears down the app.                                                                                |
| `src/app/pageSetup.js`          | Existing analytics initialization and desktop-only mobile notice.                                                                                                              |
| `src/scene/createScene.js`      | Renderer, camera, lights, fog, OrbitControls, TransformControls, resize handling and demand rendering.                                                                         |
| `src/catalog/products.js`       | Stable product IDs, legacy types, asset paths, authored positions/rotations, display dimensions, textures and desk offsets.                                                    |
| `src/catalog/configuration.js`  | Default setup, product families, primitive defaults, variant resolution and placement calculations. No DOM or Three.js dependency.                                             |
| `src/models/modelLoader.js`     | GLTFLoader boundary with shared, reference-counted templates, a bounded idle cache, Meshopt decoding and the legacy first-root convention.                                     |
| `src/models/objectFactory.js`   | Builds model or primitive instances, loads primitive textures, and owns their resources.                                                                                       |
| `src/models/resources.js`       | Disposes owned geometries, materials, textures, skeletons and ImageBitmaps; estimates cache retention.                                                                         |
| `src/state/objectStore.js`      | Scene membership, instance names, desk offset and generation tokens.                                                                                                           |
| `src/state/actions.js`          | Add, replace, remove, desk changes, reset, default initialization and transactional restoration. No DOM dependency.                                                            |
| `src/interactions/selection.js` | Maps raycast hits to registered roots, selects, deselects and deletes.                                                                                                         |
| `src/interactions/pointer.js`   | Coordinates pointer picking, gizmo dragging and camera controls.                                                                                                               |
| `src/interactions/keyboard.js`  | Delete, deselect, rotate/translate, gizmo size and axis shortcuts, with editable-field guards.                                                                                 |
| `src/sharing/legacyCodec.js`    | Bounded, validated plain-data reader/writer for the historical setup format.                                                                                                   |
| `src/sharing/sceneRecords.js`   | Converts live Three.js transforms and primitive parameters to plain records.                                                                                                   |
| `src/sharing/shareUrl.js`       | Deployment-aware URL creation and safe query reading.                                                                                                                          |
| `src/sharing/createSharing.js`  | Connects codec, snapshot, URL loading and state actions.                                                                                                                       |
| `src/ui/catalogPanel.js`        | Reads form values, resolves variants and updates preview images.                                                                                                               |
| `src/ui/bindPlannerUI.js`       | Binds declarative buttons, numeric inputs and the share dialog; returns listener cleanup.                                                                                      |
| `src/ui/feedback.js`            | Visible load/validation errors. Uses text content, never HTML from a setup.                                                                                                    |
| `src/styles/planner.css`        | Desktop planner styling, copied without changing its selectors or appearance.                                                                                                  |
| `js/ui.js`                      | Existing Bootstrap tutorial/modal/tooltip initialization shared with retained pages.                                                                                           |

Marketing pages, `mainAppMobile.html`, `mainAppOld.html` and prototypes retain their
existing implementations and URLs. They do not import the desktop app. Their
legacy styles and `js/share-url.js` bridge remain available. This separation
avoids silently changing their distinct UI/control behavior.

## Initialization and teardown

1. The page loads the pinned Three.js engine, customized OrbitControls/GLTFLoader,
   TransformControls, and existing Bootstrap scripts in their original order.
   Unused DragControls, duplicate DRACOLoader and the commented-out dropdown script
   are no longer loaded by the desktop planner.
2. `src/main.js` starts the page services and calls `createApp` with explicit
   `THREE`, `window` and `document` dependencies. No planner service reads an
   implicit engine or DOM global.
3. `createApp` constructs the scene, object factory, object store, selection,
   actions, sharing and UI, in dependency order. These are small functions and
   objects, not a service container or event bus.
4. A URL with `customSetup` is decoded and restored. Without that parameter, the
   six default objects load independently. Invalid initial links show an error and
   load a usable default scene. `app.ready` settles after initial loading/error
   handling. A later failed restore leaves the existing scene intact.
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

1. Add its asset at a stable relative path. Keep filename case, spaces and sidecar
   resources intact; do not rename existing assets as part of adding a product.
2. Add a unique, permanent key in `products.js`, with `type`, `position`,
   `rotationY`, `modelPath` and display `dimensions`. Coordinates are the existing
   inch-based scene coordinates; rotations are radians. Authored mesh origins
   mean placement is not necessarily the visible object's geometric center.
3. Add a catalog card in `mainApp.html`. Use
   `<button data-action="add" data-product="myProduct">Add</button>` and add
   `data-replace="true"` to its replacement button. No JavaScript handler is needed.
4. For a desk, also add its height difference from the modern desk to `deskOffsets`
   and use the existing desk type convention. Model creation and desk replacement
   need no new handlers.
5. Run catalog/unit tests and add a browser check for any new behavior or asset
   format. The path check fails for missing assets except the documented baseline
   `drawerDesk` entry.

For a variation family, add its definition to `families`, a `<family>Form` select,
and product IDs matching `family + optionValue`. Monitors use a `<family>Stand`
checkbox and the `NoStand` suffix. Keyboard previews use `<family>Image` and
`Model thumbnails/<productId>.jpg`. Add cards with `data-family` instead of
`data-product`. A new variation of an existing family normally needs only a
product entry, its asset/thumbnail and one select option.

Custom desks and reference shapes use `primitives`. The DOM adapter preserves the
legacy mapping of L/W/H inputs to Three.js width/height/depth; custom desks have
one-inch thickness. Reference spheres retain the r116 tessellation of `OctahedronBufferGeometry(radius, 5)`
(modern `OctahedronGeometry(radius, 31)`).
Display dimensions are descriptive legacy strings, not a source for geometry.
Some strings are known to be inconsistent; this extraction does not reinterpret
or correct model measurements.

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
