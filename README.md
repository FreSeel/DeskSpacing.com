# DeskSpacing

DeskSpacing is a static, browser-based 3D desk setup planner. Add desks, monitors,
keyboards and accessories, move or rotate them, and share the arrangement through
an encoded URL. There is no backend, account system or database. This repository
is the maintained [FreSeel fork](https://github.com/FreSeel/DeskSpacing.com).

## About this fork

This repository is a maintained fork of the original DeskSpacing project, a browser-based 3D desk configuration tool built with Three.js.

My work focuses on modernizing the development and testing infrastructure, improving application structure and maintainability, and introducing automated validation while preserving compatibility with existing functionality.

The fork includes Vite-based builds, modular JavaScript, unit and browser testing, and engineering documentation.

**Original project:** DeskSpacing, with programming by Cooper Lappenbusch and 3D models by Travers Sorenson. The original creators retain credit for their work.

## Get started

Use **Node 24.22.1** from `.nvmrc` (or the compatible Node range in `package.json`).
With nvm installed:

```sh
nvm install
nvm use
npm ci
npm run dev
```

Open `http://127.0.0.1:5173/`, then **Create**, or open `/mainApp.html` directly.
The modern planner requires a desktop browser with WebGL 2. The historical mobile
route remains available but is not a certified mobile version of the modern app.

## Checks and production build

```sh
npx playwright install chromium
npm run check
npm run build
npm run preview
```

`check` runs ESLint, Prettier, Vitest, a production build and Playwright Chromium
checks. Linux may require `npx playwright install --with-deps chromium`.
The browser suite starts its own server on port 4173; stop any manual preview
first. Failure screenshots/traces are in `test-results/`; open the HTML report
with `npx playwright show-report`.

| Command                                   | Purpose                                                               |
| ----------------------------------------- | --------------------------------------------------------------------- |
| `npm test` / `npm run test:watch`         | Unit tests / watch mode                                               |
| `npm run lint`                            | Application, tooling and test linting                                 |
| `npm run format:check` / `npm run format` | Check / format adopted source files                                   |
| `npm run test:e2e`                        | Build and exercise production output at `/DeskSpacing.com/`           |
| `npm run assets:audit`                    | Regenerate the model/image inventory                                  |
| `npm run assets:optimize`                 | Regenerate and verify five optimized startup GLBs                     |
| `npm run perf:profile -- local`           | Measure a running preview; see performance docs                       |
| `npm audit`                               | Dependency advisories; currently fails for the retained legacy engine |

## Stack and layout

Vanilla JavaScript ES modules, Three.js with matching addons, Bootstrap/Popper,
GSAP/ScrollTrigger for marketing pages, Vite, Vitest, Playwright, ESLint and
Prettier. `three-legacy` provides r116 only for retained classic-script routes.
Versions are pinned in `package.json` and `package-lock.json`.

| Location                                             | Responsibility                                                                     |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `public/models/`                                     | Original model collections, sidecars, demo scenes and verified optimized copies    |
| `public/textures/`                                   | Shared textures                                                                    |
| `public/images/`                                     | Site images, thumbnails, tutorial media and favicons                               |
| `public/fonts/`, `public/styles/`                    | Retained font assets and page themes                                               |
| `src/main.js`, `src/app/`                            | Application composition, startup and teardown                                      |
| `src/scene/`                                         | Renderer, camera, controls, appearance and demand rendering                        |
| `src/catalog/`                                       | Stable product IDs, authored placement, variants and optimized URLs                |
| `src/models/`                                        | Model-loading code, caching, cloning and resource ownership                        |
| `src/state/`                                         | Object membership and asynchronous actions                                         |
| `src/interactions/`, `src/ui/`                       | Picking, shortcuts, catalog forms, dialogs and feedback                            |
| `src/sharing/`                                       | Validated legacy codec, snapshots and deployment-relative URLs                     |
| `src/styles/`                                        | Modern planner stylesheet                                                          |
| `src/legacy/`                                        | Maintained marketing/UI scripts and classic share bridge                           |
| `index.html`, `mainApp.html`                         | Landing page and modern planner entrypoints                                        |
| `legacy/pages/`, `legacy/scripts/`, `legacy/styles/` | Retained HTML routes, historical scripts and SCSS                                  |
| `vendor/`                                            | Historical third-party code and its notices; full Three.js archive is not deployed |
| `scripts/`                                           | Build integration, URL-to-source mounts, asset verification and benchmarks         |
| `tests/`                                             | Unit tests, compatibility fixtures and production browser tests                    |
| `docs/`                                              | Architecture, development, dependency, performance and audit records               |
| `dist/`                                              | Generated static output; ignored by Git                                            |

File locations and published URLs are separate. For example,
`public/models/GLTFs/...` serves at the existing `GLTFs/...` URL, and
`legacy/pages/about.html` serves at `about.html`. `scripts/site-layout.js` is the
single mapping used by development, production, asset tools and path tests.
Vite's automatic public-directory copying is disabled to avoid duplicate model
payloads. Keep catalog paths as public URLs, without `public/`; use
`siteSourcePath()` in Node tooling to resolve them to repository files.

Application state is owned by each `createApp` instance. Live Three.js transforms
are the source of truth; sharing takes a fresh snapshot. Failed replacements and
restores preserve the current setup. Models share immutable geometry/textures,
with independent transforms/materials and explicit release ownership.

## Add a product or 3D asset

1. Establish permission first. Record creator, source, license/version, required
   attribution and modifications in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
2. Add the model and all sidecars under `public/models/` using stable,
   case-sensitive relative paths. Shared textures belong in `public/textures/`.
   Existing IDs, filenames, authored origins and coordinates are compatibility
   boundaries. New asset collections need a URL-to-source mount in
   `scripts/site-layout.js`; additions inside an existing mounted collection
   are included automatically.
3. Add a permanent product ID to `src/catalog/products.js` with its legacy type,
   `modelPath`, position, rotation and display dimensions. Add a desk offset for
   desks. Coordinates are inch-based; rotations are radians.
4. Add a card in `mainApp.html` with `data-action="add"` and
   `data-product="yourId"`; replacement buttons also use `data-replace="true"`.
   Families use `data-family`, definitions in `configuration.js`, and matching
   form/stand/preview IDs. See the architecture guide for naming conventions.
5. Add a thumbnail, update intentional compatibility fixtures/tests, run the asset
   audit and full checks, and inspect the real model in the browser. Verify
   placement, selection, replacement, deletion and share restoration. Do not
   update fixtures merely to hide accidental changes.

Keep original models. Enable optimized copies only after the optimizer's decoded
geometry/material/texture comparison passes and browser appearance is reviewed.

## Deployment

`npm run build` emits `dist/`; publish **only that directory** to a static host
for the fork. Relative URLs support both root hosting and a project path such as
`/DeskSpacing.com/`. Share URLs use the current origin and route. Reproduce the
project path with `npm run preview -- --base=/DeskSpacing.com/`.

The workflow in `.github/workflows/ci.yml` verifies changes but does not deploy.
The upstream-domain `CNAME` was removed; builds emit `.nojekyll` and no custom
hostname. No original website deployment target is configured. Actual GitHub
Pages/DNS settings must be verified in the fork's hosting account before release.
The complete preserved distribution exceeds 1 GB; assess host limits before
uploading it. No deployment was performed by this audit.

## Maintenance and known limits

Start with [ARCHITECTURE.md](docs/ARCHITECTURE.md),
[DEVELOPMENT.md](docs/DEVELOPMENT.md), [PERFORMANCE.md](docs/PERFORMANCE.md),
[DEPENDENCIES.md](docs/DEPENDENCIES.md) and the
[final engineering audit](docs/ENGINEERING_AUDIT.md). Future coding sessions should
follow [AGENTS.md](AGENTS.md).

Known debt includes the legacy engine advisory, older inline planners, a missing
historical `drawerDesk` model, large original assets, upstream analytics/contact
references, and incomplete asset-license provenance. See
[third-party notices](THIRD_PARTY_NOTICES.md): public availability does not establish
permission to redistribute, and no blanket license is asserted for this repository.
