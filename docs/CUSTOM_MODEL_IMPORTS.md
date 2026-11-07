# Custom model imports

The modern planner supports custom static glTF models through the Import dialog and planner services. The inspector displays the imported filename, dimensions and optional attribution or license. A missing asset appears as a selectable wireframe marker with its failure reason. Open **Objects** and choose **Import** to upload a file or enter a direct model URL. Browser-local project management, duplication, scaling and missing-file recovery are available through the planner API; the existing Share / Save dialog does not save imported assets.

## Importing a model

Choose one `.glb` or self-contained `.gltf` file, or paste a direct HTTP(S) model URL. A model's web page is not a downloadable model URL. Local glTF files must embed buffers and PNG/JPEG images; a separate `.bin` file or texture folder cannot be selected alongside the model. Export to a self-contained file first. Remote glTF may reference accessible relative dependencies, resolved against the final URL after redirects. The model server and every dependency server must permit CORS. Requests do not include login credentials, so private authenticated model links generally fail.

Import is one Undo action. The new model is selected and placed on the current desk or floor; use the existing inspector and gizmo to move or rotate it. Escape, Cancel and Close cancel pending dialog imports. A failed import keeps the current scene and input intact so the source can be corrected and retried. A browser-local save must be explicit: unsaved files disappear when the page closes. Share links cannot include custom models.

## Planner API

Use `app.modelImports` and `app.projects` from the app composed by `createApp.js`. The services wait for initial scene loading before editing the scene.

- `importModelFromFile(file, metadata?)` and `importModelFromUrl(url, metadata?)` start an import. Metadata accepts optional `attribution` and `license` strings supplied by the caller.
- An import returns a task with a `result` promise. It resolves to the registered object on success, resolves to `null` on cancellation and rejects with a displayable error on failure. `getImportStatus(task?)` returns `idle`, `loading`, `success` with `objectId`, `failure` with `message`, or `cancelled`. Omitting the task reads the most recent status. `cancelImport(task?)` cancels a pending task.
- `duplicateImportedObject(objectId)` starts a task that creates an instance with the same asset and transform and a new object ID. `removeImportedObject(objectId)` deletes the instance through planner history.
- Use `app.actions.transforms` for numerical transforms. `setScale(object, multiplier)` applies a uniform scale, and an explicit `{ x, y, z }` patch can set individual scale axes. These values are unitless. Position and dimensions follow the existing inch and centimeter options.
- `app.projects.save(id)` explicitly saves the current scene to this browser. `list()` returns saved IDs, `open(id)` restores one and returns `{ restored, missingAssets }` on success, and `delete(id)` removes the saved copy. An interrupted open returns `{ restored: false }`.
- `getMissingAssets()` reports the current missing instance records and their error messages. `retryMissingAsset(objectId)` retries the source. For a missing local model, pass a replacement `File` as the second argument to relink that instance. Recovery preserves the object ID and its transforms and is undoable. Explicitly save again to persist the recovery.

## Scene and resource ownership

The object store owns imported instances just as it owns catalog objects. Three.js transforms are authoritative. The project snapshot stores each instance's ID, source metadata and position, rotation and scale. The source descriptor has its own asset ID.

The loader parses the default glTF scene, including all its roots. A child group converts meters to inches uniformly and puts the horizontal bounds center and lowest point at the editable pivot. Nested authored transforms stay on the loaded model. A new instance starts near the desk center at the measured surface height when available. It can use existing grid and magnetic snapping and snap to the planner's known desk and floor surfaces. Imported models provide magnetic targets, while desk and floor classification still comes from the catalog.

The registry coalesces loads for the same normalized remote URL or the same local File or Blob. Instances share immutable imported geometry, materials and textures. Detached instances stay alive while Undo/Redo can restore them. Once the final instance or pending request releases its reference, the registry evicts the asset and disposes its GPU resources and decoded images. A cancelled request releases its own lease, and a shared fetch is aborted when its final waiter leaves. Reset, restore, Undo/Redo and app disposal invalidate pending imports. The importer creates no object URLs.

## Storage and portability

Unsaved imported files stay in memory. An explicit save uses one IndexedDB transaction for the project records and the local Blobs they reference. Duplicated instances store their local asset once per project. Replacing or deleting a saved project releases its previous stored snapshot. Storage and quota errors reject the save. The browser can clear or evict the data.

Remote projects store source URLs and metadata. Opening a project loads the URLs again, reusing any active in-memory asset. Remote models and dependencies require direct HTTP(S) access and appropriate server CORS headers. Imports use credential-free requests and the browser's normal HTTP cache. The planner keeps no permanent download cache, uploads no bytes and uses no fetching proxy.

Legacy setup links and their catalog IDs continue to work. The existing share format supports catalog objects, so creating a link for a scene with imported models gives an actionable error. Local projects are scoped to the browser profile and deployment origin, with a common project namespace for paths on that origin. Clearing site data, changing browsers/profiles or moving to another origin loses access to saved local assets. Keep original files separately. Portable exports containing custom models are not implemented.

Deleting a saved project deletes its records and embedded local files together, without affecting another saved project or a live/history-retained instance. Removing a scene instance does not edit a previously saved project; save again to update it. Quota failures leave the earlier stored snapshot intact. Missing remote files or unavailable local bytes become recoverable placeholders; local relinking and remote retry preserve the instance ID and transforms and require another explicit save.

## Validation and coverage

The import boundary accepts glTF 2.0 `.glb` and `.gltf` files. Local glTF must embed all resources. Remote resource paths resolve against the final model URL after redirects. The default limits are 32 MiB for the model and its dependencies, 250,000 expanded vertices, 750,000 triangle indices, 32 PNG/JPEG images, 4,096 pixels per texture side, roughly 16 million decoded texture pixels in total, and a 30-second load deadline. Budget overrides live in `createImportLoader`. The 32 MiB budget includes decoded embedded dependencies as well as the input file.

The importer accepts static triangle meshes and a limited set of material extensions. Compressed geometry and textures (including Draco, Meshopt and KTX2), sparse accessors, instancing, skinning, morph targets, non-triangle primitives and alternate formats require later support. Animation tracks and cameras are ignored. Empty, excessive or non-finite bounds are rejected; a flat model is allowed if it spans at least two axes. Bounds used for picking and culling are recomputed from actual geometry instead of trusting accessor metadata.

These are per-asset safety budgets, not performance guarantees. Many unique assets and Undo/Redo-retained instances can still consume substantial memory. Image pixels expand to decoded bitmap and GPU storage; the compressed download size is not a memory estimate. Parsing and geometry validation run on the main thread, and image decoding cannot be forcibly interrupted; cancellation prevents scene publication and disposes resources when pending work returns. Surface contact preparation scans actual vertices on a new or changed gesture; repeated drag updates reuse derived geometry. Imported models can snap onto catalog desks/floors but do not become support surfaces themselves. No new renderer, workers or format dependencies were added.

## Rights and attribution

Only import files you have permission to use. A public URL, product name or successful download does not establish a license. Supply known `attribution` and `license` metadata through the API and retain any required source/license evidence separately. These strings survive project save/load and appear as text in the inspector; the importer does not infer or grant rights, extract arbitrary glTF extras into planner metadata, or remove obligations when making a local copy. The dialog currently has no attribution fields. Test models and textures are generated mathematical fixtures, with their provenance recorded in `THIRD_PARTY_NOTICES.md`.

## Extending loaders

Keep source recognition in `importSource.js` and validation independent of DOM and Three.js. A future format adapter should produce the existing loader contract `{ root, offset, scale, dispose }`, with geometry budgets, finite bounds, credential-free bounded downloads, cancellation and exact resource ownership enforced before publication. Integrate behind `createImportLoader` / the injected registry `load` function; keep `modelImports`, actions, history and the object store as the single instance lifecycle. Update project record validation/versioning if source metadata changes. Do not enable a GLTFLoader extension without validating its referenced resources, decoded allocations and cleanup behavior. Add format-specific rejection, restore, cancellation and shared-instance disposal tests before advertising support.

Run the focused checks on Node 24.22.1.

```sh
npm test -- tests/unit/model-imports.test.js
npm run build
npx playwright test tests/e2e/model-imports.spec.js tests/e2e/import-dialog.spec.js
```

The optional `playwright.imports.config.js` runs the same focused cases against the development server. The default configuration exercises the production bundle. Install Chromium first (`npx playwright install chromium`) and leave port 4173 free. Run `npm run check` for the complete checks. This repository is JavaScript-only and has no TypeScript compiler or typecheck script.

See [the Phase 3 review](CUSTOM_MODEL_IMPORT_REVIEW.md) for results and limits. Chromium viewport checks do not certify mobile touch hardware, Safari or Firefox. The repository's existing missing `drawerDesk` asset and legacy npm advisory remain open.
