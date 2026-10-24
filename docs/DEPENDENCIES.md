# Dependencies and upgrade decisions

Reviewed against the npm registry on 2026-10-24. Exact direct versions and the
regenerated npm lockfile are committed. Node **24.22.1 LTS** is pinned in `.nvmrc`
and required by `engines`; CI reads the same file. Node 26 is still Current at this
review date, so Node 24 is the appropriate LTS baseline. The machine's global Node
installation is not modified; use `nvm install && nvm use` before `npm ci`.

## Runtime changes

| Dependency                  | Before                                 | Now / decision                                                                                                                                        |
| --------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bootstrap JS                | npm 4.0.0 plus vendored marketing beta | **5.3.8**, current stable. All retained pages use the same npm build. Attributes use `data-bs-*`; planner initialization uses the native API.         |
| Popper                      | popper.js 1.12.9 and vendored v1       | **@popperjs/core 2.11.8**, current stable. Deprecated `popper.js` is removed.                                                                         |
| jQuery                      | npm/vendored 3.2.1 slim                | **Removed**. Native DOM operations replace the few application calls; Bootstrap 5 and GSAP do not need jQuery. No reason to add current jQuery 4.0.0. |
| TweenMax/TimelineLite       | vendored GSAP 1.20.2                   | **gsap 3.15.0**, current stable. Marketing timelines retain their original durations, offsets, easing and triggers.                                   |
| ScrollMagic and GSAP bridge | vendored 2.0.5 and animation.gsap      | **Removed from pages/output**, replaced by maintained GSAP ScrollTrigger in the same package.                                                         |
| ScrollMagic debug plugin    | vendored addIndicators                 | **Removed from pages/output**, never used by active application code.                                                                                 |
| Three.js                    | npm 0.116.1                            | **Retained**, blocked migration described below. Registry latest is 0.186.1.                                                                          |

The old jQuery, Popper, Bootstrap JS, TweenMax, ScrollMagic, animation bridge and
debug files remain in the checkout for provenance but are excluded from `dist/`.
No page loads them. The explicit retired-script list is covered by a unit test.
The previously unused `uniq` dependency remains absent. Each remaining direct
runtime dependency has an active consumer; development tools all have npm scripts.

Bootstrap 5's JavaScript is used with the existing visual CSS theme to avoid a
redesign. `css/bootstrap-compat.css` adapts carousel direction classes;
`js/ui.js` uses both tooltip arrow classes and maps Popper 2 placement metadata for
the old theme. Native modals, accordion, carousel, responsive navigation and
mobile-page tooltips have browser coverage. A full theme migration is still pending.

## Tooling

The registry reports the existing versions as latest stable: Vite **8.3.5**,
Vitest **5.0.5**, Playwright **1.64.1**, ESLint **10.13.0**, @eslint/js **10.0.1**,
and Prettier **3.9.10**. They are retained, not arbitrarily churned. The lockfile is
regenerated in an empty temporary installation to avoid deriving platform optional
dependencies only from an existing macOS node_modules tree. `npm ci` verifies it.

## Packages/assets not yet upgraded

### Three.js core and custom addons

Current Three.js no longer provides the classic global distribution/addon layout
used by the planner. The root OrbitControls and GLTFLoader differ from the original
vendored r116 versions. The application also uses legacy geometry names, old color
encoding/gamma configuration and implicit globals. Substituting 0.186.1 would require
coordinated core/addon/module changes and could change model hierarchy, lighting,
selection and appearance. The earlier task explicitly separated that migration.

Recommended next step: migrate core and matching upstream addons together to
current Three.js in a dedicated change, with fixed-camera render comparisons,
legacy share fixtures and interaction tests for all retained planner pages. An
intermediate r125+ migration can address the known advisory sooner, but still needs
compatibility testing; it is not claimed safe merely because it installs. A reviewed
backport of the upstream Color parser patch is a possible interim alternative and
would need targeted tests and explicit patch maintenance. Replacing the whole engine
with Babylon.js is maintained but is a much larger rewrite, not a drop-in upgrade.

The retained `three/` archive and root copies are not evidence of modern support;
the build serves the pinned npm core, required matching addons and custom root
addons. Do not run `npm audit fix --force` to change the engine without this work.

### Bootstrap/Bootswatch CSS and template assets

The existing Bootstrap 4-era visual theme and marketing template CSS remain to
preserve layout and appearance; they are not npm JavaScript dependencies. Upgrading
them wholesale to Bootstrap/Bootswatch 5 requires mapping removed spacing/form and
utility classes across the large catalogs and reviewing screenshots. Alternatives
are a deliberate Bootstrap 5 theme migration or native scoped CSS with native
`dialog`/disclosure controls. The compatibility stylesheet is a transition, not a
claim that Bootstrap supports mixing major versions out of the box.

## Security review

`npm audit` now reports **one high-severity finding**, down from three vulnerable
packages. Bootstrap and jQuery findings were removed by upgrading/removing them.
The remaining finding is [CVE-2020-28496 / GHSA-fq6p-x6j3-cmmq](https://github.com/advisories/GHSA-fq6p-x6j3-cmmq),
a denial-of-service issue in Three.js RGB/HSL color parsing before 0.125.0. No new
untrusted color-input feature was introduced. This is not a proof of
non-exploitability; the finding remains open and `npm audit` intentionally exits 1.
No development-tool vulnerability was reported. Archived vendor code and external
font/analytics services are outside npm audit's coverage.

The legacy shared-setup parser's separately documented malformed-input risks also
remain open; npm audit cannot detect them. CI runs correctness checks without
pretending the retained engine advisory is fixed or suppressing it with an override.

## Licensing and validation

Bootstrap, Popper and Three.js license files are copied to `dist/vendor/`. GSAP's
README with its license link and the distributed script license headers are
preserved; GSAP uses its own standard license, not an assumed MIT license.

Validation uses Node 24.22.1, a clean installation, lint/format checks, Vitest,
production builds and Chromium smoke tests. Tests cover real GLBs, rendered
triangles, sharing/restoration, visible catalog interaction, rotate/delete,
responsive navigation, animation reveal, tutorial cycling and tooltip positioning.
The hosted Linux CI run, other browser engines and full screenshot parity are not
certified by local Chromium tests.

References: [Node releases](https://github.com/nodejs/node/releases),
[Bootstrap migration](https://getbootstrap.com/docs/5.3/migration/),
[Three.js migration](https://github.com/mrdoob/three.js/wiki/Migration-Guide),
[jQuery support](https://jquery.com/support/).
