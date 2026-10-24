# Development and verification

## Runtime and commands

`.nvmrc` pins Node 24.22.1. Use the current Node 24 LTS line required by package.json. Install the pinned runtime with your preferred Node manager;
`nvm install && nvm use` works with nvm. `npm ci` uses the committed lockfile.

- `npm run dev`: local Vite server on port 5173; use `-- --port 5174` to override.
- `npm run build`: clean, reproducible static output in `dist/`.
- `npm run preview`: serve `dist/` locally on port 4173.
- `npm run lint`: ESLint on new configs, tooling, tests and extracted sharing code.
- `npm run format:check` / `npm run format`: check/format only adopted files.
- `npm test` / `npm run test:watch`: isolated Vitest unit tests.
- `npm run test:e2e`: build and test the production site in Chromium.
- `npm run check`: all of the above checks, including a production build.

Install Chromium once with `npx playwright install chromium`. Linux CI uses
`npx playwright install --with-deps chromium`. Tests use software WebGL so a
physical GPU is unnecessary. WebGL still needs to be available; failure is not
silently skipped. Test failure traces/screenshots are in `test-results/`, and
`npx playwright show-report` opens the report.

## Transitional Vite architecture

Vite is appropriate for incremental extraction, but passing the current HTML
through its normal module pipeline would change script execution order and global
bindings. `scripts/legacy-site.js` therefore serves the retained HTML as classic
scripts during development (with Vite's reload client) and copies those pages and
assets into the production build. Vite bundles/minifies the newly extracted
`js/share-url.js` as an IIFE at its stable URL. This is deliberately a compatibility
bridge, not a completed ES-module migration. There is no frontend framework.

All root HTML routes and asset files are retained. The explicit asset-directory
list includes models, sidecar buffers/textures, thumbnails, fonts and marketing
images. Paths with spaces and historical case are unchanged. Production excludes
repository metadata, docs, tooling, node_modules, and the full Three.js example,
source and test trees. Only the required Three.js addons and dependency licenses
are copied from npm. Root custom Three.js addons remain unchanged. Bootstrap 5 and Popper 2 replace the
old widget scripts, and GSAP 3/ScrollTrigger replace the marketing animation stack.
The existing theme is retained with small carousel/tooltip compatibility adapters. No model compression,
model deletion or visual tuning occurs in this phase.

Legacy scripts/styles retain their existing minification. Large models are not
inlined, hashed or recompressed. Avoid aggressive immutable caching for these
stable paths. Later module extraction can use normal Vite hashed chunks and CSS
processing; changing global scope or tree-shaking old addons prematurely is unsafe.

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
`npm run dev -- --base=/DeskSpacing.com/`. The browser suite uses this subpath,
real GLBs, and the emitted production files. Because the legacy files keep
relative URLs, the same output also works at the root.

Publish only `dist/` when you explicitly choose to deploy. `.nojekyll` is emitted.
The repository's original `CNAME` is preserved but intentionally **not copied** into
the output, preventing a fork build from claiming the original project's domain.
No workflow deploys, changes DNS, or configures a custom domain.

The preserved asset set currently produces **approximately 1.11 GB**.
Although URL/base-path compatibility is tested, this exceeds GitHub Pages' published
[1 GB site limit](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).
Do not assume this full artifact can be deployed to Pages yet. A later verified
asset-pruning/optimization pass or separate model hosting is needed. This phase
preserves models instead of silently dropping assets to meet a hosting quota.

## Test scope and known limitations

Unit tests verify share URL encoding/origin/path behavior and the production copy
boundary (including preserving model paths and excluding CNAME/private files).
Browser tests assert navigation from home to creator, six default objects with
actual mesh geometry, a live rendered scene, loading an extra model through the
catalog callback, attached transform controls, rotate/delete shortcuts, and
sharing/restoring object identities and transforms. Required local asset failures
and uncaught JavaScript errors fail the main smoke test. Optional analytics/fonts
are blocked to prove the planner doesn't depend on them.

The catalog test opens its accordion and clicks the visible Add button. Additional
browser tests exercise responsive navigation, animation visibility, tutorial
cycling and mobile planner tooltip positioning. Raycast selection and gizmo dragging need further browser coverage.
The legacy parser, async replacement/reset races, mobile touch behavior, all product
variants and full visual fidelity are not certified by this small smoke suite.
Malformed shares are a known high-priority follow-up in MODERNIZATION_PLAN.md;
these tests deliberately use valid generated shares, not potentially hanging input.

ESLint and Prettier adoption is incremental. Existing inline planner scripts,
third-party bundles and legacy CSS/HTML are not reformatted or newly linted.
When extracting another module, add it to the scoped lint command and formatting
allowlist. EditorConfig applies to future edits without a repository-wide rewrite.

## Validation recorded for this change

On macOS ARM64 with Node 24.22.1: clean temporary installation, lockfile-based
`npm ci`, ESLint, Prettier, six Vitest tests, six Playwright production tests,
and production builds passed. The previous tooling phase also checked the Vite dev
server at `/DevCheck/`: it loaded six objects, rendered 270,374 triangles and generated
a share URL under the same prefix, with no uncaught JavaScript errors.

The initial browser run was blocked by sandbox localhost permissions; it passed
after running with the required permissions. `npm audit` exits 1 for the one
retained vulnerable package documented in DEPENDENCIES.md. The GitHub-hosted
Linux workflow, real GPU rendering, Firefox/WebKit and deployment were not run
locally. No performance or full visual-parity claim is made.

The dev server also reports missing source maps referenced by legacy minified CSS;
these are debugging metadata warnings, not missing runtime styles. Three.js reports
its existing power-of-two texture resizing warnings. Neither was suppressed or
used to skip a smoke assertion.
