# Rendering and asset performance

Measured locally on 2026-10-24. Scope: the active desktop editor (`mainApp.html`),
its startup assets, and its application lifecycle. The marketing page was measured
as a navigation control. Older inline planner routes remain compatible through an
isolated r116 dependency; they are not represented as modernized or optimized.

## 1. Original measurements and conditions

Baseline: repository commit `0a7fb49`, before optimization, with only three User
Timing calls added around scene construction and the external benchmark harness.
The original desktop used global npm r116 core, root GLTFLoader/OrbitControls
(whitespace-only differences from upstream), classic TransformControls, and the
existing ES-module application. It rendered every animation frame, updated its
4096 × 4096 shadow map every frame, used uncapped device pixel ratio, fetched all
catalog/tutorial images immediately, and parsed/uploaded independent geometry for
every added model. Catalog models were already loaded on demand.

Test conditions:

- Apple M2 Max, macOS ARM64 (Darwin 27.0.0), Node 24.22.1.
- Playwright Chromium 156.0.8078.4, headless ANGLE **SwiftShader software WebGL**.
- 1280 × 800 viewport, DPR 1; canvas capture 854 × 800.
- Vite production build/preview at `/DeskSpacing.com/`, localhost, no network or CPU
  throttling. HTTP cache disabled, fresh browser context for each of three runs.
- Optional Google analytics/fonts blocked identically in both versions. Server
  responses are uncompressed; gzip sizes below are offline estimates, not measured
  compressed wire transfers. OS disk caches and browser/driver shader caches were
  not flushed between runs; this is not a fully cold-device benchmark.
- Editor usable proxy: defaults finish loading (`app.ready`) plus two animation
  frames. The introductory modal is then dismissed before interaction tests.
- Fixed camera, selection detached. Count render submissions during a 2-second
  idle window; execute 60 pointer moves with 16 ms pacing for orbiting; add ten
  mice concurrently, render, delete them, collect garbage, then dispose the app.

Raw baseline data, including every resource URL, encoded/transfer sizes, timings,
per-frame samples, object transforms and memory counters:
[baseline.json](performance/baseline.json).

The three original usable-time samples were **3,210 / 1,822 / 1,738 ms**. Scene
construction was **235 / 38 / 38 ms**. The first sample includes extra browser/
shader startup costs. Small local navigation timings vary considerably; results
must not be presented as production latency, mobile performance or hardware-GPU
frame rates. Three samples do not establish statistical significance.

## 2. Changes implemented

### Engine and compatibility

- Desktop imports pinned **Three.js 0.186.1**, GLTFLoader, OrbitControls,
  TransformControls, SkeletonUtils and MeshoptDecoder from npm ES modules. Explicit
  engine exports allow tree shaking; the production module is minified. No global
  Three.js scripts are loaded by the desktop page.
- `TransformControls.getHelper()` replaces adding the controls themselves to the
  scene. Picking uses pointer events and is scoped to the canvas. Gizmo dragging
  disables orbiting; cancellation restores it. Orbit pan explicitly retains
  `screenSpacePanning = false`; reset pose and scene coordinates are preserved.
- `outputEncoding` becomes `outputColorSpace`. Authored numeric material/light
  colors explicitly retain linear values. Light intensity is multiplied by π and
  the spotlight uses zero decay to retain the former non-physical lighting.
- The r116 Narkowicz tone curve is retained through Three.js's custom-tone-mapping
  hook. Modern ACES would visibly change the scene. Obsolete gamma flags are
  removed. r186 removed PCFSoftShadowMap; current PCF is used with the original
  4096² resolution and shadow bias. This filter change is subject to the visual
  comparison limits below.
- BufferGeometry constructors use their current names. The reference sphere uses
  modern detail **31**, matching r116 detail **5** (32 edge subdivisions), rather
  than silently reducing tessellation. A test compares position and normal arrays.
- DragControls and DRACOLoader are **not used by the desktop**. Dragging is handled
  by TransformControls; the inventory found no original Draco assets. No unused
  Draco worker/decoder download is introduced. Old routes retain matching r116
  addons through `three-legacy`; their existing URLs and original assets remain.
- The modern renderer requires WebGL 2. There is no claim of WebGL 1 compatibility
  for the upgraded desktop, or of migration of the older inline applications.

### Rendering and lifecycle

- A single demand scheduler coalesces invalidations, stops when settled/hidden,
  and supports control changes, damping, active gestures and auto-rotation.
  ResizeObserver and window resize invalidate projection/drawing-buffer size.
- Shadow maps update on object insertion, removal and transform changes, not on
  camera-only motion. Shadow resolution, antialiasing, geometry detail and light
  count are retained. DPR is capped at 2; no quality reduction occurs at DPR ≤ 2.
- Picking excludes known nonselectable roots, reuses its hit array/position,
  updates world matrices before the query, and uses mesh bounding boxes computed
  once at load time. Catalog clicks no longer trigger a scene raycast.
- Disposal removes listeners, cancels scheduled work, disconnects ResizeObserver,
  disposes controls/shadow targets/renderer, releases application resources, and
  rejects/releases models finishing after shutdown. The ready promise no longer
  retains an array of original scene objects after deletion.
- Programmatic object/material mutations outside actions must call
  `view.invalidateScene()`; camera-only transitions must call `view.invalidate()`.
  There is no animated-model mixer in the existing editor.

### Models and images

- A URL-keyed cache shares in-flight and completed loads. Instances have separate
  transforms, materials and skeletons; immutable geometry/textures are shared.
  Reference counting prevents deletion of one instance from damaging another.
- Unused templates have a **32 MiB estimated idle-resource budget** with LRU
  eviction. Active objects are not evicted or included in that budget. The estimate
  counts geometry arrays and decoded texture/mipmap storage, not total process or
  VRAM usage. Idle retention trades some memory for faster repeated additions.
  Full app disposal clears the cache; ImageBitmaps are closed at final ownership
  release. Primitive resources remain independently owned.
- Add/replace buttons show loading state and prevent duplicate clicks while busy.
  Startup has an accessible loading status. Failed loads remain retryable and
  failed replacements/restores preserve the current setup.
- Catalog thumbnails and tutorial GIFs use native lazy loading and asynchronous
  decoding. They still load when their panels become visible. No image dimensions
  or tutorial content were changed.
- Five startup GLBs have separate verified copies under `public/models/optimized-models/` (served at `optimized-models/`).
  Original catalog paths, models, textures and dimensions are preserved. A generated
  manifest redirects only these five desktop requests.
- The generation script uses glTF Transform bitwise vertex welding, unfiltered
  **lossless Meshopt** encoding, and lossless WebP only when decoded RGBA pixels
  match exactly and the result is smaller. It does **not** run quantization,
  simplification, resizing, recentering or flattening. Triangle count is unchanged.
- A decode/compare gate verifies per-corner attributes, triangle order/winding,
  hierarchy, node matrices, material factors and texture pixels before writing a
  replacement. Meshopt may cyclically rotate triangle corners, which preserves
  winding/interpolation. The verification canonicalizes only those cyclic rotations.

The five GLBs total **29,054,820 → 14,606,836 bytes (49.7% less)**. Checksums,
per-file sizes and texture dimensions are in
[optimized-assets.json](performance/optimized-assets.json).

## 3. Measured results and verification

Medians of three runs, unless otherwise indicated. MB means 1,000,000 bytes.
Raw after data: [after.json](performance/after.json). Recomputed summary and visual
metrics: [baseline-vs-after.json](performance/baseline-vs-after.json).

| Metric                                                                       |                  Original |          Optimized |
| ---------------------------------------------------------------------------- | ------------------------: | -----------------: |
| Homepage navigation `loadEventEnd`                                           |                     31 ms |              35 ms |
| Editor navigation `loadEventEnd`                                             |                    446 ms |             114 ms |
| Editor usable proxy                                                          |                  1,822 ms |           1,285 ms |
| Synchronous scene construction                                               |                     38 ms |              46 ms |
| Resource entries through usable point, including 2 blocked optional services |                        69 |                 17 |
| Encoded resource bodies through usable point                                 |                  40.23 MB |           15.10 MB |
| Resource Timing transfer sizes, including estimated response headers         |                  40.25 MB |           15.11 MB |
| Five startup GLBs                                                            |                  29.05 MB |           14.61 MB |
| All first-party startup JS, uncompressed                                     |                 899,857 B |          954,521 B |
| Same JS, summed offline gzip estimates                                       |                 220,961 B |          220,232 B |
| Actual render calls in 2 seconds idle                                        |          11 (range 11–12) | **0 in every run** |
| Orbit render submissions / second                                            |                      5.85 |               7.67 |
| Median interval between orbit render submissions                             |                    174 ms |             129 ms |
| Median synchronous `renderer.render()` submission time                       |                    0.3 ms |             0.4 ms |
| Last default-frame `renderer.info.render.calls`                              |                        13 |                 14 |
| Last default-frame `renderer.info.render.triangles`                          |                   270,374 |            270,376 |
| Geometry counters before → after adding ten mice                             | 22 → 52 (one run 21 → 51) |            21 → 21 |
| Texture counter before / during duplicates                                   |                     5 / 5 |              7 / 7 |
| JS heap before duplicates, after forced GC                                   |                  31.55 MB |           31.82 MB |
| JS heap sample after duplicate loading                                       |                  54.75 MB |           32.29 MB |
| JS heap after removing duplicates and forced GC                              |                  31.65 MB |           31.87 MB |
| Ten concurrent additions + two animation frames                              |                     31 ms |              26 ms |
| Geometry / texture counters after full disposal                              |                     0 / 0 |              0 / 1 |
| Unhandled page errors during benchmark                                       |                         0 |                  0 |

The measured median usable time decreased by **29.5%**, and initial encoded bodies
by **62.5%**. The first run did **not** get faster: 3,210 → 3,252 ms. Optimized
usable samples were 3,252 / 1,285 / 1,260 ms. The homepage and scene construction
were not faster; the JS source grew while its gzip estimate stayed roughly flat.
No broad bundle-size or cold-start win is claimed.

The strongest repeatable changes are zero idle renders, fewer startup transfers,
and no additional GPU geometries for repeated instances. The orbit rate is 31%
higher in this **software-rendered** scenario, but remains slow. Render submission
rate is a proxy, not a measurement of displayed-frame presentation. Synchronous
render time excludes asynchronous GPU execution and cannot substantiate a per-frame
CPU/GPU-time improvement. Per-frame draw calls and triangle counters did not fall.
Idle draws/shadow work stop altogether; camera motion reuses the shadow map.

`performance.memory` is Chromium-specific accounting, not process memory or VRAM.
The post-add heap sample includes temporary allocations (no forced GC at that
point). The steady-state heap did not decrease. Resource sharing reduced the
transient/repeated-instance sample and geometry count; this is not a general claim
that all scenes now use less memory. GPU time, actual VRAM bytes, peak GPU memory,
energy use and hardware-GPU frame rates were **not measurable in this run**.

The modern engine adds shadow/internal texture allocations. After application
resource disposal, its counter retains one engine-owned 16 × 16 DFG lookup texture
(about 1 KiB of texel data, not an estimate of actual GPU allocation). This is
visible in the raw results and is not reported as zero. The application's geometries,
material instances, model textures, ImageBitmaps, controls and pending work have
explicit ownership/disposal. Repeated additions/deletions do not grow that residual
counter. We avoid reaching into private engine internals to dispose a global LUT.

### Visual and interaction checks

[Original capture](performance/baseline-default.png) and
[optimized capture](performance/after-default.png) use the same camera and no
selection. All six saved object records and the camera position match **exactly**.
The images were visually inspected: model placement, textures, colors and overall
lighting remain consistent. They are **not pixel-identical**: mean absolute RGB
channel difference is **0.70 / 255**; **2.76%** of pixels differ by more than 5 in at
least one channel; 119 pixels differ by more than 20. Modern shader/filter behavior
and rasterization account for a remaining visual compatibility limit. This single
scene does not certify every material, angle, monitor or browser.

Validation completed for the performance modernization (historical counts; see
[final engineering audit](ENGINEERING_AUDIT.md) for the current suite):

- **49 unit tests**: catalog/coordinates, legacy share formats and validation,
  failed/stale replacements/restores, nested ownership, cache sharing/eviction/
  retry/late disposal, image cleanup, scheduler lifecycle and exact sphere data.
- **16 Chromium browser tests**: real optimized GLBs, all catalog categories,
  textured custom desks, monitor stands/keyboard variants, selection/deletion,
  camera orbit/reset, real gizmo translation/rotation, failed replacements,
  historical mobile payloads and saved-state restoration, idle rendering, damping,
  resize, shared duplicates, teardown, and DPR-3 drawing-buffer cap.
- ESLint, formatting and production build. No real-device, Firefox or WebKit
  certification is implied. Synthetic gestures wait for Bootstrap's separate
  backdrop transition before interacting with the canvas.
- Asset generation independently decoded every optimized file and verified the
  invariants described above. Inventory finds no newly missing paths/textures.
  The pre-existing missing model remains documented below.

## 4. Trade-offs

- Upgrading the renderer brings WebGL 2 requirements, a larger uncompressed JS
  bundle, slightly more base heap/texture allocations, and small visual differences.
  The retained tone curve and light settings intentionally prioritize existing art
  over adopting modern default lighting. PCF quality must still be checked on real
  GPUs at grazing angles and with other models.
- Cache sharing saves repeated parsing/uploading, while retaining up to an estimated
  32 MiB of idle resources. Unique live models remain unbounded by that cache limit.
  Materials are cloned to prevent cross-instance edits; textures/geometries must
  remain immutable or be cloned explicitly before editing.
- The DPR cap trades some sharpness above DPR 2 for fewer pixels. The 4096² shadow
  target is retained to avoid unverified quality loss; it remains a significant cost.
- Compression preserves texture dimensions and polygons, so it reduces transfer
  size rather than automatically reducing texture VRAM or fragment/triangle work.
  Native lazy loading defers catalog/tutorial transfers until needed.
- Original assets are still deployed for older routes and rollback. Build output
  remains large. The isolated r116 alias retains its previously documented npm
  advisory; desktop modernization does not resolve older-route maintenance debt.

## 5. Remaining bottlenecks

The reproducible [asset inventory](performance/assets.json) covers **103 catalog
paths**, with **102 present GLBs totaling 635,039,056 bytes**. It found no skins,
no original compression extensions, one multi-root asset, and 60 embedded images
with longest sides ranging from 200 to 5,500 pixels. Examples include a 24.88 MB
coffee cup and full-size keyboards with 215,866 triangles. The editor still has
approximately 270k default-frame triangles and expensive antialiased shading.

`drawerDesk` still points to the pre-existing absent `desks/regular_desk_1.glb`.
It is not exposed by the desktop catalog; historical links using it report an
error. No substitute with different dimensions was silently introduced.

Large optional tutorial GIFs remain (slide 1 alone is 4.94 MB), but are deferred.
Only five model replacements were verified; the rest of the catalog remains
original. Multi-root behavior intentionally still selects the first authored root.
Original/legacy assets make the static distribution exceed 1 GB. The older inline
pages retain continuous rendering and independent-loading limitations.

## 6. Suggested next improvements

1. Profile representative real desktop/mobile GPUs and Firefox/WebKit, at DPR 1/2,
   with cold and warm loads over controlled bandwidth/latency. Interleave many
   before/after runs; use GPU timers where available. Add larger saved configurations
   and sustained gizmo dragging, which currently have functional rather than separate
   before/after FPS measurements.
2. Verify more original/optimized pairs and alternate camera/material fixtures.
   Evaluate Meshopt quantization or Draco for geometry-heavy keyboards only with
   explicit precision bounds, silhouette/material checks and saved-coordinate tests.
   Current lossless copies deliberately avoid that risk.
3. Evaluate KTX2/Basis UASTC for large decoded textures to reduce VRAM. ETC1S and
   resized textures require careful quality comparisons, especially wood grain and
   key legends. WebP alone does not provide GPU texture compression. These options
   were considered but not shipped without device/material verification.
4. Test lower shadow resolutions or static baked lighting with visual references.
   Consider instancing repeated identical products if large scenes show draw-call
   pressure. Baseline draw-call count is low, so no scene-graph rewrite was justified.
5. Convert tutorial GIFs to modern video while retaining tutorial behavior. Review
   which historical asset directories can be excluded from deployment only after
   auditing all retained URLs. Migrate the older inline planners separately.

### Reproduction

Use the Node version in `.nvmrc` and install the lockfile with `npm ci`.

```sh
npm run assets:audit
npm run assets:optimize
npm run build
npm run preview -- --port 4173 --base=/DeskSpacing.com/
# In another terminal, with the preview still running:
npm run perf:profile -- local
npm run perf:compare -- baseline local
```

`PROFILE_RUNS` defaults to 3; `PROFILE_URL` overrides the preview base URL. Avoid
running tests or other workloads concurrently with the benchmark. The harness
writes raw JSON and the first fixed-camera PNG to `docs/performance/`. It does not
change production settings or introduce a global debug API. To recreate the old
baseline, use `0a7fb49` with its own lockfile, copy the profiling harness, and add the
same `planner:scene-init` User Timing measure around `createScene()`; without that
instrumentation only scene construction time is unavailable. Do not combine the
old global HTML with the new engine package.

```sh
npm run lint
npm run format:check
npm test
npm run test:e2e
```

The browser suite starts its own preview on port 4173, so stop a manual preview
first. Original model files are never overwritten by `assets:optimize`. Changing
its scope or compression settings requires regenerating the verification report
and inspecting browser captures before enabling additional manifest entries.

References: [Three.js migration guide](https://github.com/mrdoob/three.js/wiki/Migration-Guide),
[Three.js source](https://github.com/mrdoob/three.js),
[glTF Transform optimization tools](https://gltf-transform.dev/cli).
