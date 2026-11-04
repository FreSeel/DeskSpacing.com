# Custom model imports

Phase 1 adds services to the modern planner. The existing inspector displays the imported filename, dimensions and optional attribution or license. A missing asset appears as a selectable wireframe marker with its failure reason. The import dialog and local project controls are reserved for the UI phase.

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

Legacy setup links and their catalog IDs continue to work. The existing share format supports catalog objects, so creating a link for a scene with imported models gives an actionable error. Local projects are scoped to the browser profile and deployment origin. Portable exports containing custom models are outside Phase 1.

## Validation and coverage

The import boundary accepts glTF 2.0 `.glb` and `.gltf` files. Local glTF must embed all resources. Remote resource paths resolve against the final model URL after redirects. The default limits are 32 MiB for the model and its dependencies, 250,000 expanded vertices, 750,000 triangle indices, 32 PNG/JPEG images, 4,096 pixels per texture side, roughly 16 million decoded texture pixels in total, and a 30-second load deadline. Budget overrides live in `createImportLoader`. The 32 MiB budget includes decoded embedded dependencies as well as the input file.

Phase 1 accepts static triangle meshes and a limited set of material extensions. Compressed geometry and textures, sparse accessors, instancing, skinning, morph targets, non-triangle primitives and alternate formats require later support. Animation tracks and cameras are ignored. Very large, degenerate or non-finite geometry is rejected.

Run the focused checks on Node 24.22.1.

```sh
npm test -- tests/unit/model-imports.test.js
npx playwright test --config=playwright.imports.config.js
```

Chromium coverage includes local file persistence across reload, relative remote resources, and recovery after a remote failure. Mobile, Safari and Firefox are unverified. The repository's existing missing `drawerDesk` asset and legacy npm advisory remain open.
