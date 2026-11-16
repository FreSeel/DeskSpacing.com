# DeskSpacing v1.0 release packaging

Review date: 2026-11-16. Tested checkout: `chore/v1-release-readiness` at
`ddc8dbe`, plus the documentation-only provenance ledger in this working tree. This is a
local production package review, not a staging deployment or publication.
**A-015 remains open pending host selection, capacity and live-path verification.**
The separate rights gate A-002 also remains open; see
[release asset provenance](RELEASE_ASSET_PROVENANCE.md).

## 1. Build environment and artifact

- Node `24.22.1` from `.nvmrc`; installed dependency tree checked with
  `npm ls --depth=0` against pinned `package.json` versions and the lockfile.
  Dependencies were already installed with `npm ci`; none were changed for this
  review.
- `npm run build` passed using Vite 8.3.5. `vite.config.js` sets `outDir: 'dist'`,
  `emptyOutDir: true`, `publicDir: false`, and relative `base: './'`.
  `scripts/legacy-site.js` adds the historical URL mounts and required notices.
- Fresh `dist/`: **463 files, 1,214,206,675 bytes (1,157.96 MiB)**. The five
  largest groups are `GLTFs/` 957.21 MiB, `desks/` 43.23 MiB,
  `keyboards/` 35.37 MiB, `textures/` 18.29 MiB and `monitors/` 15.25 MiB.
  These are uncompressed file sizes. The complete group inventory is in the
  provenance ledger.
- Exact local tree fingerprint: SHA-256
  `b55a405c3d8bc73b268badd50bda2871ed5902ca4b50c86927f2a4be0c671f9a`.
  To reproduce it, sort all regular files under `dist/` by relative POSIX path;
  for each, append `path + NUL + lowercase SHA-256(file) + LF` to a byte stream,
  then SHA-256 that stream. This identifies the tested local bytes, not a hosted
  artifact.
- `index.html`, `mainApp.html`, the emitted `src/main.js` and `src/home.js`,
  CSS, catalog models, textures, thumbnails, seven tutorial GIFs, legacy pages,
  classic scripts, `THIRD_PARTY_NOTICES.md`, vendor license files and
  `.nojekyll` are present. The build excludes CNAME, development tests,
  `node_modules/` as a tree and the historical `vendor/three/` archive.

## 2. URL and server contract

The output is a **static multi-page site**, with real `.html` entrypoints and
historical routes. It needs no account server, API or SPA rewrite. Preserve
case, spaces, punctuation and URL encoding in asset filenames. At a domain
root, serve `dist/index.html` for `/`; at a project path, mount the *contents*
of `dist/` under the chosen prefix. Keep the trailing slash on directory URLs.
The local project-path test uses `/DeskSpacing.com/`; it does not assert that
this is the final public hostname.

HTML links, CSS font URLs, model and texture URLs resolve relative to their
pages. `src/sharing/shareUrl.js` constructs links from the active origin and
page route, preserving the deployment prefix. Historical planners retain their
own route for legacy share links. The host must serve the actual asset bytes
with suitable MIME types (not an HTML fallback for missing models), support
large static files, and preserve `THIRD_PARTY_NOTICES.md` and `vendor/` notices.
The root preview returned `model/gltf-binary` for sampled GLBs,
`text/javascript` for bundles, `text/css` for CSS, and matching image/font
types. Root and project-path behavior are local observations; host routing and
headers remain to be checked on staging.

Serve the public site over HTTPS. Browser-local projects use IndexedDB and are
scoped to the browser origin; moving from staging or a project path to another
origin does not migrate saved projects. Share links similarly encode the active
origin/path. Imported remote models require their own CORS-enabled HTTPS URLs.
Compress text/JS/CSS/HTML at the host when supported; GLBs and images should be
measured before applying extra compression. Use conservative caching for HTML
and stable-name JS/assets so updates can replace them; reserve long immutable
caching for content-addressed files such as Vite's hashed chunk. The repository
does not configure production compression or cache headers, so none are claimed
as verified.

## 3. Hosting capacity and configuration

The repository has only `.github/workflows/ci.yml`, which runs verification and
uploads failure reports. It does not deploy `dist/`. There is no CNAME,
deployment secret, provider config or staging URL in this checkout. GitHub
repository metadata identifies the fork, but no Pages settings or hosted
deployment were verified here. No staging deployment was performed.

GitHub Pages is discussed in `docs/DEVELOPMENT.md`, but is **not configured as
this release's deployment target**. GitHub's current
[Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
state a maximum published site size of 1 GB and a 10-minute deployment timeout;
this artifact exceeds even 1 GiB by 140,464,851 bytes. The same limits page
does not specify a separate per-site file-count cap; a chosen provider must
confirm capacity for 463 files, the largest individual assets, transfer/bandwidth
and any upload limits. Do not infer deployability from a local preview. A host
with sufficient capacity can use the existing static `dist/` package; no new
hosting architecture is proposed.

## 4. Verified local production behavior

The selected Playwright run served the production build at
`http://127.0.0.1:4173/DeskSpacing.com/` and passed **8/8** tests:

- Homepage links, local route responses and help dialogs; published route HTML
  contains no inherited analytics or upstream support destinations.
- Modern editor startup with real GLBs and no failed local asset responses in
  the representative default/share flow.
- Custom desk replacement, primitive materials/dimensions and shared-link
  restoration; generated links used the active origin and project path.
- Browser-local project save, reload, reopen, overwrite and delete.
- Retained route availability and readable WebGL2-unavailable reload state.

Separately, a root-path `npm run preview -- --port 4173` returned HTTP 200 for
`/`, modern/legacy HTML, the planner bundle and CSS, both share bridges, an
optimized and original desk GLB, a texture, thumbnail, tutorial GIF, font,
license file and `THIRD_PARTY_NOTICES.md`. Sample MIME types matched the
file types. The manual preview server was stopped afterward. These checks are
representative, not an exhaustive scan of every asset or browser.

`tests/unit/build.test.js`, `tests/unit/catalog.test.js` and
`tests/unit/share-url.test.js` are the focused package/path checks for this
block. The full unit/e2e suite is reserved for Block 05.

## 5. Packaging opportunities and risks

The current build still copies `.DS_Store` files and a Paint.NET authoring file;
the provenance ledger found no runtime references to them. They are low-risk
future packaging exclusions but too small to solve the host-capacity problem.
SHA-256 review also found exact duplicate model/thumbnail bytes. Historical
public URLs, legacy setup IDs and sidecars can depend on both paths, so no
duplicate model has been removed. `3d/scene.gltf` is a possible historical/demo
exclusion, but its relative sidecars are already absent; review references and
rights before changing the mount. No assets were reprocessed or excluded.

The missing historical `drawerDesk` file, legacy engine advisory and incomplete
rights evidence remain separate release decisions. This block does not assert
that every model is loadable or distributable. Desktop Chromium/SwiftShader
tests do not certify physical devices, Safari, Firefox or a real GPU.

## 6. Procedure and outstanding staging checks

After the release owner resolves A-002 and chooses a host that accepts the exact
package (or approves compatibility-safe reductions):

1. On a clean checkout, use Node 24.22.1, run `npm ci`, then `npm run build`.
   Publish **only the contents of `dist/`** to the selected static site root or
   project prefix. Do not copy an upstream CNAME or point DNS at the old site.
2. Check host size/file-count/upload limits and actual upload result. Inspect
   `index.html`, `mainApp.html`, the legacy routes, notices, model/texture/font
   URLs and expected 404s. Verify MIME types, HTTPS, compression and cache
   headers on the hosted responses.
3. On staging, repeat the representative editor, desk, local project and share
   flows. Confirm generated links stay on staging's origin/path; inspect network
   requests for missing assets and inherited tracking. Confirm legacy links
   retain their intended routes and the WebGL failure message works.
4. Record the exact staging URL, provider settings, artifact checksum, browser
   evidence and release-owner approval. Only then decide whether to promote
   the same package. No tag, DNS change or production publication was made here.

**A-015 status:** local package behavior is verified for the checks above;
hosting readiness is **not resolved** without a capacity-compatible chosen
host and a successful staging run. GitHub Pages cannot be assumed to accept
the current complete artifact.
