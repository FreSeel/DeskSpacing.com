# Development and verification

## Runtime and commands

`.nvmrc` pins Node 24.22.1. Use the current Node 24 LTS line required by package.json. Install the pinned runtime with your preferred Node manager;
`nvm install && nvm use` works with nvm. `npm ci` uses the committed lockfile.

- `npm run dev`: local Vite server on port 5173; use `-- --port 5174` to override.
- `npm run build`: clean, reproducible static output in `dist/`.
- `npm run preview`: serve `dist/` locally on port 4173.
- `npm run lint`: ESLint on configs, tooling, tests and all extracted application modules.
- `npm run format:check` / `npm run format`: check/format only adopted files.
- `npm test` / `npm run test:watch`: isolated Vitest unit tests.
- `npm run test:e2e`: build and test the production site in Chromium.
- `npm run check`: all of the above checks, including a production build.

Install Chromium once with `npx playwright install chromium`. Linux CI uses
`npx playwright install --with-deps chromium`. Tests use software WebGL so a
physical GPU is unnecessary. The development-routing regression test also uses
port 5176 under `/LayoutCheck/`; leave that port free. WebGL still needs to be available; failure is not
silently skipped. Test failure traces/screenshots are in `test-results/`, and
`npx playwright show-report` opens the report.

## Vite architecture

The desktop planner is composed from ES modules under `src/`; see
[ARCHITECTURE.md](ARCHITECTURE.md) for ownership, startup, object lifecycle and
product configuration. Vite builds `src/main.js` to the same stable entry URL and
builds the retained `src/legacy/share-url.js` bridge for older pages. The desktop HTML
contains declarative data attributes and references the module entry.

`scripts/site-layout.js` maps stable public URLs to `public/`, `legacy/` and
`src/legacy/` sources. `scripts/legacy-site.js` serves existing HTML without transforming its static
asset references, and copies it to the production build. This preserves root and
subpath URLs, model/texture sidecars, case, spaces and the remaining classic-script
pages. It also copies `src/styles/` for the desktop theme. Production excludes
repository metadata, docs, tooling, node_modules and the full Three.js source,
example and test trees. Required addons and dependency licenses come from pinned
npm packages; retained addons now live in `vendor/legacy/`.

The desktop engine is modern Three.js; five verified optimized copies redirect
startup loads. Original models remain available to retained routes. Bootstrap/Popper and marketing
GSAP/ScrollTrigger retain their previously migrated versions. Marketing, mobile,
old and prototype pages keep their separate styles and implementations.

## GitHub Pages and other static hosts

The default base is `./`: the output can be hosted at a domain root or under a
project directory. HTML links, styles and runtime model requests remain relative.
Sharing now uses the current page's origin/path, strips old query/hash values, and
URL-encodes the setup. Mobile/old pages retain their own route when sharing so their
legacy serialization stays paired with its reader.

To reproduce project hosting locally:

```sh
npm run build -- --base=/DeskSpacing.com/
npm run preview -- --base=/DeskSpacing.com/
```

Open <http://127.0.0.1:4173/DeskSpacing.com/>. Development can also use
`npm run dev -- --base=/DeskSpacing.com/`. The production browser suite uses this subpath,
real GLBs, and the emitted production files. Because the legacy files keep
relative URLs, the same output also works at the root.

Publish only `dist/` when you explicitly choose to deploy. `.nojekyll` is emitted.
The upstream-domain `CNAME` was removed during the final audit. The build also
excludes CNAME files, preventing accidental reuse of the original domain.
No workflow deploys, changes DNS, or configures a custom domain.

The preserved asset set currently produces **approximately 1.11 GB**.
Although URL/base-path compatibility is tested, this exceeds GitHub Pages' published
[1 GB site limit](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).
Do not assume this full artifact can be deployed to Pages yet. A later verified
asset-pruning/optimization pass or separate model hosting is needed. This phase
preserves models instead of silently dropping assets to meet a hosting quota.

## Verification scope

`npm run check` runs lint, formatting, unit tests, the production build and the
Chromium suite. All `src/` JavaScript is included in lint and formatting. Existing
HTML, vendor code and retained legacy scripts/styles are not reformatted wholesale.

Tests exercise catalog compatibility, path existence, variant configuration,
primitive placement, bounded legacy codecs, URL handling, object membership,
asynchronous replacement/reset/restore, resource disposal, picking and shortcuts.
Browser tests exercise real models through catalog controls, all product categories,
variations, desk changes, primitives, sharing/restoration, camera and gizmo movement,
load failures, tutorials, menus and retained routes at a project subpath.
See [ARCHITECTURE.md](ARCHITECTURE.md#verification-and-remaining-work) for deliberate
compatibility choices and remaining work.

Current final verification and limitations are recorded in
[ENGINEERING_AUDIT.md](ENGINEERING_AUDIT.md). Earlier extraction counts are
historical, not the current suite size. Use the pinned Node runtime: an older
machine default can run some tests yet be unsupported by Vite.

Linux CI, real GPU rendering, Firefox/WebKit, mobile touch behavior and production
deployment are not certified by local Chromium checks. The retained Three.js
advisory remains documented in [DEPENDENCIES.md](DEPENDENCIES.md).

Legacy CSS source-map and Three.js power-of-two texture warnings can still appear;
these are not missing runtime assets and are not used to skip assertions.

## Rendering and asset performance

See [PERFORMANCE.md](PERFORMANCE.md) for the reproducible benchmark, raw results,
Three.js migration details and visual verification limits. `npm run assets:audit`
inspects the catalog; `npm run assets:optimize` regenerates and validates the five
startup model copies without modifying originals. Start a production preview
before running `npm run perf:profile -- local`.

## Source layout and public URLs

Only `index.html` and `mainApp.html` remain at the repository root. Other HTML
sources live in `legacy/pages/`, with the same published URLs. Binary assets are
organized under `public/models/`, `public/textures/`, `public/images/` and
`public/fonts/`. Legacy CSS is in `public/styles/`; modern CSS stays in
`src/styles/`. Maintained classic scripts are in `src/legacy/`. Historical vendor
code is under `vendor/`; retained application scripts/SCSS are under `legacy/`.

Vite `publicDir` is deliberately disabled. The shared `siteMounts` table copies
organized sources to their historical URLs, once, and rewrites development
requests to the same source files. This keeps model sidecars, stylesheet-relative
fonts/images and historical page links working without duplicating the assets.
Builds fail if a declared mount source is missing. New files inside a mounted
collection are copied recursively; new collections need a mount. Never put
`public/` in catalog URLs. Node tools resolve URLs with `siteSourcePath()`.
