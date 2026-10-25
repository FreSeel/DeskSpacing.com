# Repository development instructions

- Use Node 24.22.1 (`.nvmrc`) and `npm ci`. Do not use the machine's older default
  Node or change dependency versions incidentally.
- The modern planner starts in `src/main.js`; `src/app/createApp.js` composes
  services. Keep catalog/configuration and codecs independent of DOM/Three.js.
  UI adapters read forms; actions own mutations; the store owns membership.
- Live Three.js transforms are authoritative. Do not add a second scene-state
  model or production debug globals. Direct scene/material changes require
  `view.invalidateScene()`; camera-only changes require `view.invalidate()`.
- Preserve product IDs, wire types/delimiters, authored positions/origins,
  rotations, filenames/case/spaces, legacy routes and first-root model behavior.
  Sharing must use the active deployment origin/path. Keep failed replacement
  and restore operations transactional and release stale asynchronous loads.
- Cached geometry/textures are shared and immutable; clone before modifying.
  Dispose instance resources and release cache references exactly once. Preserve
  reset/disposal generation guards and idle-render behavior.
- Do not bulk-reformat legacy HTML/vendor code. Avoid speculative splitting of
  the declarative catalog or migrating retained inline planners incidentally.
- Before deleting an asset/vendor file, check application, retained HTML, tests,
  build copying, sidecars and attribution. Preserve originals when optimizing.
  Record asset rights in `THIRD_PARTY_NOTICES.md`; never infer a license.
- Static binaries live in `public/models`, `public/textures` and `public/images`;
  `src/models` contains loading code. Retained HTML lives in `legacy/pages`,
  maintained classic scripts in `src/legacy`, and historical vendor code in
  `vendor`. Keep only the two active HTML entrypoints at the root.
- Public URLs are mapped to disk by `scripts/site-layout.js`; new asset collections
  need a mount there. Catalog paths remain public URLs. Use `siteSourcePath()` in
  filesystem tools/tests. Do not enable automatic Vite public copying, which
  would duplicate the mounted assets. Publish only
  `dist/`; do not add the original website's CNAME or a deployment to upstream.
- Run `npm run lint`, `npm run format:check`, `npm test` and `npm run test:e2e`
  (or `npm run check`). Install Chromium first. E2E needs localhost port 4173 and
  browser/WebGL permissions; stop manual preview servers. Add regression tests
  for behavior fixes, not tests that merely mirror implementation.
- For asset changes run `npm run assets:audit`; optimized copies additionally need
  `npm run assets:optimize` verification and visual inspection. Benchmark with
  the documented harness without concurrent tests; do not invent speedups.
- Document limitations: the missing `drawerDesk` asset and legacy npm advisory
  remain open; passing Chromium tests does not certify mobile, Safari or Firefox.
