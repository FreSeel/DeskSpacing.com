# Legacy Three.js security review — A-009

Reviewed 2026-11-08 on `fix/v1-legacy-safety`, starting from commit `8134592`.

**A-009 status: awaiting acceptance.** The known RGB/HSL whitespace parsing
defect is fixed in the two published legacy engine artifacts. The dependency
itself remains `three-legacy@npm:three@0.116.1`, so npm still reports the advisory.
No release-owner acceptance is recorded. This review does **not** close A-009 or
authorize release of the retained historical dependency.

Recommendation: use the narrow, verified r116 security backport for v1 only if
the release owner accepts its maintenance and distribution constraints below.
Otherwise, keep the release gate open and schedule a separately validated engine
upgrade. No attacker-controlled application path to the affected parser was
established; the presence of the vulnerable dependency alone is not evidence of
an exploitable shared link.

## Advisory and dependency evidence

- `package.json` and `package-lock.json` pin modern `three` to **0.186.1** and
  alias `three-legacy` to **0.116.1**. The lock resolves the latter to
  `https://registry.npmjs.org/three/-/three-0.116.1.tgz`, with integrity
  `sha512-l2JCMiA/lVZAuSrLWRYMalvpR+0j8hbIhCpfs4V6JFnw2+JQEQJ5HltNpfFr+9TDpQts1BhtcISehWf/xBGPvQ==`.
  Node **24.22.1** and `npm ci` successfully reproduced the installation. Neither
  manifest nor lockfile was changed.
- The current [GitHub advisory GHSA-fq6p-x6j3-cmmq / CVE-2020-28496](https://github.com/advisories/GHSA-fq6p-x6j3-cmmq)
  identifies versions **before 0.125.0**, first patched version **0.125.0**,
  high severity, CVSS 3.1 **7.5**, CWE-400, and RGB/HSL parsing as the trigger.
  Its last displayed update is 2023-09-11. This is a package severity, not an
  application-specific exploitability score.
- Refreshed `npm audit --omit=dev --json` on 2026-11-08: **exit 1**, exactly
  **one high** finding, `nodes: ["node_modules/three-legacy"]`, affected range
  `<0.125.0`, advisory source `1093634`. No other production finding appeared.
  The sandbox attempt failed with registry DNS `ENOTFOUND`; the approved
  network-enabled retry succeeded. This production-only scan makes no statement
  about current development-tool advisories. npm's suggested major update to
  `three@0.187.0` was not applied.
- The r116 `Color.setStyle` outer expression has overlapping whitespace matches:
  `/^((?:rgb|hsl)a?)\(\s*([^\)]*)\)/`. Whitespace can match both `\s*` and the
  following capture. Missing `)` forces repeated backtracking. `Color(string)`,
  `Color.set(string)` and material color setters can reach `setStyle`.
- [Upstream PR #21143](https://github.com/mrdoob/three.js/pull/21143), including
  [commit 4a582355216b620176a291ff319d740e619d583e](https://github.com/mrdoob/three.js/commit/4a582355216b620176a291ff319d740e619d583e),
  removes the outer whitespace repetition and accepts leading whitespace in
  each component expression instead. The resulting structure was verified in
  [r125 Color.js](https://raw.githubusercontent.com/mrdoob/three.js/r125/src/math/Color.js).

## Published routes and engine execution

`scripts/site-layout.js` maps historical URLs to disk; `scripts/legacy-site.js`
copies them to `dist/` and serves development requests. Legacy engines are
classic standalone scripts, not part of the modern planner bundle.

| URL                                                                | Actual behavior                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mainAppMobile.html`                                               | Loads `three.min.js`, initializes r116, renders models and primitives, restores `customSetup`.                                                                                                                                                     |
| `mainAppOld.html`                                                  | Same engine and shared-input boundary; separate inline planner implementation.                                                                                                                                                                     |
| `testHTMLfile.html`                                                | Loads and executes r116, controls and GLTFLoader; renders three fixed catalog GLBs. No shared-scene URL parser.                                                                                                                                    |
| `services.html`                                                    | Executes the classic engine/addon scripts. Its inline planner is inside an HTML comment; it does not initialize that planner.                                                                                                                      |
| `three.min.js`                                                     | Before this change: npm r116 copied over the archived mount. Now: same pinned bytes with the security backport.                                                                                                                                    |
| `three.module.js`                                                  | Published even though no retained HTML imports it. Previously the archived r116 module; it is byte-identical to the npm r116 module. Now supplied from the pinned npm package with the same backport. Direct consumers retain the URL and exports. |
| `app.js`                                                           | Published historical demo script; no retained HTML references it. Uses fixed `scene.gltf` and numeric lights if explicitly loaded.                                                                                                                 |
| `mainApp.html`                                                     | Uses the modern 0.186.1 module bundle; does not execute the legacy engine.                                                                                                                                                                         |
| `index.html`, `about.html`, `contact.html`, `services - Copy.html` | No legacy engine script reference.                                                                                                                                                                                                                 |

GLTFLoader and OrbitControls remain the retained r116 addons; DragControls,
TransformControls and DRACOLoader are mapped from the r116 npm alias. The full
historical `vendor/three` tree is not published. Archived originals are retained
for provenance; serving the checkout directly instead of `dist/` bypasses this
distribution guarantee.

## Reachability and exposure assessment

### Confirmed vulnerability and reachable library API

The installed r116 engine contains the advisory defect. A disposable child
process executing the actual unpatched classic build reaches a **100 ms VM
deadline** on a whitespace-only unterminated functional color. This confirms the
library behavior, not a remote application exploit. Each probe has a **64 MiB V8
old-space cap**, **3-second process kill deadline**, **2 KiB output cap**, and
fixed inputs no longer than 200,006 characters. It does not fetch or execute an
external PoC. No denial-of-service payload was executed in a browser.

The engine is available to page JavaScript. `testHTMLfile.html` passes the fixed
string `"white"` through `PointLight` → `Color` → `setStyle`. This confirms that
the parser API is reachable, but that input does not enter the affected RGB/HSL
branch. Application color literals and built-in control materials otherwise use
numeric colors. A caller already able to run arbitrary same-origin JavaScript
can call the API directly; that is not evidence of a shared-link attack.

### Attacker-controlled inputs traced

- **Shared URL:** both legacy planners call `DeskSpacingLegacySetup.read()` →
  `URL.searchParams.get('customSetup')` → `decode()` → `parseShareableString()`.
  `src/legacy/share-setup.js` was already present on this branch. It caps input
  at 100,000 characters and 500 objects, validates finite numeric vectors and
  primitive dimensions, and checks model/texture IDs against each page's own
  dictionaries. This is the earlier A-001 boundary; it is not the engine fix.
- **Catalog records:** `addDefaultPosRot()` → `addObject()` selects
  `coordinateDictionary[objectName][4]` → `GLTFLoader.load()`. URL data chooses
  an existing ID, not an arbitrary model URL or a color expression. The first
  root of the loaded model remains authoritative.
- **Primitive records:** `addPrimitivePosRotDimText()` uses dimensions to create
  geometry, positions/rotations for transforms, and a dictionary texture or
  numeric `0x202020` for the material. A free primitive name becomes object
  metadata, not a material color. `material.name` stores the texture identifier;
  it is not passed to `Color.setStyle`.
- **Legacy forms:** sizes/radius affect geometry; keyboard color choices select
  model IDs; finish choices select texture URLs; stand choices select model
  variants. There is no free-text RGB/HSL color editor. The share-link field is
  an output field, not a second scene importer.
- **Models:** retained `vendor/legacy/GLTFLoader.js` creates numeric colors and
  reads glTF material/light factors with `Color.fromArray()`, copying color
  objects into materials. This does not parse CSS color strings. Model URLs are
  fixed catalog/demo paths. No file-upload, JSON scene import, stored project,
  `postMessage`, local/session storage configuration or arbitrary remote-model
  input was found in the retained planners.
- **Other URL data:** no legacy scene consumer of arbitrary query keys or URL
  fragments was found. Browser instrumentation confirms that a benign
  `rgb(1,2,3)` primitive name, extra `color` parameter and fragment do not reach
  `setStyle` on either planner; the primitive retains its numeric material color.

**Conclusion:** no confirmed attacker-controlled path from these application
entry points to the vulnerable expression. Removing additional input paths
would not demonstrate a security benefit here. This is a source-based boundary
assessment plus representative runtime checks, not exhaustive proof over every
possible integration or future feature.

### Plausible but unverified exposure

An external consumer of the public engine URLs, a future color/configuration
feature, or another script on the page could pass untrusted color strings to
the API. Such consumers are not inventoried by this repository; no exploit
through them was established. External analytics code was not audited and was
blocked during browser tests. The backport removes the known defect from the
canonical published APIs independently of those assumptions.

### Unaffected behavior

Modern Three.js 0.186.1 is outside the advisory's affected range. The modern
planner's imports and project workflows do not use r116. Numeric colors, fixed
named colors, glTF numeric factors, texture loading and transforms do not invoke
the vulnerable RGB/HSL branch. The missing `drawerDesk` asset and application
parser/transactionality issues are separate concerns, not symptoms of this CVE.

## Options and compatibility consequences

| Option                                          | Security effectiveness                                                                                                                                   | Compatibility risk / complexity                                                                                                                                                                                                         | Required validation / v1 impact                                                                                                                                                                 |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — upgrade legacy to at least 0.125.0          | Removes the affected package version and version-based finding; preferred long-term.                                                                     | Medium/high: update both engine URLs and align retained/global addons. r125 removes core `Geometry`; other intervening API/rendering changes need inspection. Actual application breakage has not been established by an upgrade trial. | All legacy routes, first-root loading, controls/picking, shared links, materials, textures, tone mapping, shadows and visual comparisons. Larger schedule uncertainty than the parser backport. |
| B — backport the known parser fix               | Removes the identified backtracking defect from every canonical published legacy engine artifact. npm remains aware of the vulnerable installed version. | Low, bounded implementation: four regex edits, pinned source hashes, shared dev/build path. Requires maintaining a local distribution patch.                                                                                            | Bounded security regression, color semantics, both engine forms, build/dev delivery and representative legacy browser checks. Smallest demonstrated fix for v1; selected.                       |
| C — remove/isolate unsafe input paths           | Could work if all entry points were proven blocked. No untrusted color path was found to remove.                                                         | Removing routes is incompatible with this task. An HTML-only guard would miss direct module consumers and could race script initialization.                                                                                             | Would need a complete consumer inventory and bypass tests; no demonstrated advantage over fixing the parser itself. Not selected.                                                               |
| D — retain unmodified r116 with risk acceptance | Does not fix the library defect. Current application reachability evidence reduces, but does not erase, uncertainty.                                     | No code change; continuing dependency and integration risk.                                                                                                                                                                             | Explicit release-owner acceptance required. Not assumed or granted.                                                                                                                             |

The [upstream migration guide](https://github.com/mrdoob/three.js/wiki/Migration-Guide)
documents the r125 geometry change. This alone is not a claim that these planners
break on r125: their main primitive paths already use BufferGeometry. Their
r116 renderer/loader/control coupling, gamma/output encoding, ACES tone mapping,
authored model origins and octahedron detail behavior still require validation
before replacing the engine. No full-engine upgrade was attempted in this task.

## Implemented remediation

`scripts/legacy-three-security.js` applies the upstream whitespace fix to the
locked npm `three.min.js` and `three.module.js` **in memory**. It removes `\s*`
from the outer match and adds it to the three component patterns. It retains
r116 alpha capture indexes, warnings, clamping, named/hex colors, exports and all
non-parser code. It does not replace the engine or add a runtime monkey patch.

The transformer checks the entire input SHA-256 and exactly one occurrence of
each replacement; an unexpected source or repeated application throws instead
of silently shipping an unpatched substitute. Expected original SHA-256 values:

```text
three.min.js     c498fdc7c81b2fd10dc5fc80ef14fdc4d9bf11b2b91969786dd4aa85b4b68966
three.module.js  8d7f92a7211b3270fcb75b71054058d4f91df4f9ccb79ccc99b710cb8f8ebc40
```

`scripts/legacy-site.js` uses this transformer for both development responses
and production copying. Dependency-owned mounts skip copying archived engine
bytes first. Both historical URLs are preserved; the module's npm source was
verified identical to the previously published archive. `site-layout.js` still
identifies the archived originals for filesystem tools. Package installation,
modern Three.js, addon versions, assets and legacy page implementations are
unchanged. No `npm audit fix`, override, advisory suppression or deployment was
performed.

The installed Three.js MIT license expressly permits modification; its required
notice remains copied to `dist/vendor/THREE-LEGACY-LICENSE.txt`.
`THIRD_PARTY_NOTICES.md` records the backport and source, and each generated
engine identifies the modification. Originals in `node_modules` and `vendor`
remain unmodified. Directly importing those originals bypasses the backport;
new production consumers must use the protected distribution path or a patched
upstream engine.

## Validation and limitations

Validation used Node 24.22.1 after `npm ci`. Only relevant checks were selected,
as requested; this is not a complete release-candidate check.

Reproduce the focused functional checks after selecting the pinned Node version:

```sh
npm ci
npx vitest run tests/unit/legacy-three-security.test.js tests/unit/legacy-planners.test.js tests/unit/build.test.js
npx playwright install chromium
npm run build
npx playwright test tests/e2e/legacy-security.spec.js tests/e2e/planner.spec.js --grep 'r116 models|out of setStyle|prototype renders|historical engine URLs|retained pages are served'
```

| Check                                                               | Result                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production `npm audit --omit=dev --json`                            | One high finding on `three-legacy`; exit 1, intentionally unsuppressed.                                                                                                                                                                                                                                                                                 |
| Focused Vitest: `legacy-three-security`, `legacy-planners`, `build` | **112 tests passed**. Includes original-engine bounded reproduction; both patched engines; RGB/RGBA/HSL/HSLA whitespace variants; named/hex/numeric colors; leading whitespace, alpha, clamping and invalid-input parity; material setters; fail-closed source checks; dev root/subpath delivery; both historical wire fixtures and packaged paths.     |
| `npm run build`                                                     | Passed; both canonical legacy engine artifacts contain the backport.                                                                                                                                                                                                                                                                                    |
| Focused Chromium Playwright                                         | **11 tests passed** under `/DeskSpacing.com/`: both planners' default scenes and both historical fixture formats; transforms, real GLBs, textures and finite material colors; benign input-to-color tracing; prototype rendering/model loading; services engine initialization; exact published engine contents; module import; all retained HTML URLs. |
| ESLint on changed JavaScript                                        | Passed.                                                                                                                                                                                                                                                                                                                                                 |
| Prettier on changed maintained files                                | Passed.                                                                                                                                                                                                                                                                                                                                                 |

Browser setup was verified with `playwright install chromium`. Sandbox access
initially prevented binding port 4173; the approved localhost/WebGL run passed.
The browser suite does not execute large/adversarial strings. Its GLB coverage
is representative, not every catalog entry or compressed asset. The security
probe is a regression deadline, not a benchmark or speedup claim; the old-space
cap does not cap all process resident memory.

No mobile-device, Safari or Firefox certification, full screenshot parity,
external-integration audit, hosting/CDN cache inspection or exhaustive fuzzing is
claimed. No new safety claim is made for other pathological Color inputs or
unrelated legacy engine defects. The missing `drawerDesk` asset remains open.
The historical npm advisory also remains open at the dependency/version level.

## Residual risk and required release-owner decision

**Awaiting acceptance; owner decision not recorded.** The review recommends
accepting B for v1, not silently accepting D. Before closing A-009 for a release,
the release owner must explicitly record:

1. Acceptance of the r116 backport as the v1 mitigation, the retained vulnerable
   installed version, the unsuppressed npm finding and the validation limits.
2. An accountable maintainer for this patch and a follow-up upgrade plan. Any
   dependency/hash change requires re-review; do not update hashes blindly.
3. Agreement that deployment publishes only a successful fresh `dist/` build and
   replaces both legacy engine URLs, including cached copies. A raw-checkout or
   pre-fix deployment is not covered by these results.

If those conditions are rejected, keep A-009 open and choose option A in a
separate compatibility task. This work demonstrates a narrow security benefit
and passing compatibility checks; it does not substitute for owner acceptance
or resolve the other v1 release gates.
