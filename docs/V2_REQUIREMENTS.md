# DeskSpacing v2.0 proposed requirements baseline

Date: 2026-11-07. Based on commit
`4936418f30add3a39e2908c4e8899de8ce7f570e`, the
[feature inventory](FEATURE_INVENTORY.md) and [v1 audit](V1_RELEASE_AUDIT.md).

## Product direction and decision status

Build on the existing static JavaScript/Three.js planner. First make existing
capabilities reachable and dependable, then improve scene organization, visual
quality and room/product context. Preserve catalog IDs, public paths, legacy
links, authored coordinate conventions and the single live-transform authority.

This is a **proposed backlog**, not approval to implement every candidate. “Must”
means recommended foundational scope if the v2 baseline is approved; “Should”
means high value after foundations; “Could” means optional and capacity-dependent.
Research requirements commit to evidence and a decision, not adoption of a
technology. S/M/L estimates express relative complexity, not a schedule.

The code is vanilla JavaScript, not React/TypeScript. Existing state/history,
renderer lifecycle and UI-adapter boundaries already support incremental growth.
Neither React, TypeScript, ShadCN nor another renderer is a default requirement.

## Roadmap provenance

### Ideas verified as present in repository planning

These sources confirm that an idea was discussed, **not that it is approved for
v2 or still unimplemented**:

| Repository source                                                 | Relevant existing idea                                                                                                                               | Current disposition                                                                                                               |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `docs/MODERNIZATION_PLAN.md`                                      | Incremental modules, validated sharing, resource lifecycle, demand rendering; optional JSDoc/checkJs                                                 | Much is already delivered. Carry contract typing forward only where useful (V2-011). Do not repeat completed modernization.       |
| `docs/PERFORMANCE.md`, suggested next improvements                | Hardware/browser profiling, more verified asset optimization, GPU texture experiments, quality/shadow tradeoffs, possible instancing, tutorial media | Evidence-led candidates in V2-005/V2-006/V2-009. No speedups promised.                                                            |
| `docs/ENGINEERING_AUDIT.md`, follow-up                            | Local autosave, import/export, legacy migration, graphics/browser/accessibility work                                                                 | Import and explicit local-project APIs now exist; user workflow, portability and recovery still need work (V2-002/V2-003/V2-021). |
| `docs/design/UI_UX_REDESIGN_SPEC.md`, `UI_IMPLEMENTATION_PLAN.md` | Consistent responsive UI, keyboard access, real-device review, preserving scene lifetime                                                             | Substantial implementation exists; extend actual remaining gaps (V2-004/V2-020).                                                  |
| `docs/CUSTOM_MODEL_IMPORTS.md`, `CUSTOM_MODEL_IMPORT_REVIEW.md`   | Supported format boundary, future loader adapters, missing UI for project/scale/duplicate/recovery, no portable export                               | Use the implemented services; avoid a parallel persistence/import architecture (V2-002/V2-003/V2-018/V2-022).                     |

### User-supplied candidates requiring decisions

WebGPU and renderer alternatives (V2-007/V2-008), richer lighting and Photo Mode
(V2-009/V2-010), room walls and artwork (V2-012/V2-013/V2-014), product data/specs
and suggestions (V2-015/V2-016/V2-017), and framework/component-system evaluation
(V2-011) are candidates from this task. No inspected repository document establishes
their prior approval. Current browser/API compatibility must be researched during
the spikes; this audit did not perform a web/market survey.

### New audit-derived proposals

Unified measurement semantics, imported-work protection, accessible scene
selection, aggregate budgets and broader editing affordances are derived from
current implementation gaps. Their individual origins are recorded below. None
requires postponing v1 fixes until v2.

## Milestones and implementation order

| Milestone                                 | Proposed scope/order                                                                                                                             | Exit evidence                                                                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| **M0 — v1 prerequisite**                  | Close A-001/A-002; resolve or accept P1 issues; establish current candidate checks and staging evidence                                          | v1 audit checklist signed off. v2 cannot substitute for fixing known parser/capacity/desk races.                      |
| **M1 — dependable editing and ownership** | V2-020 baseline; V2-001 units; V2-002 project UI; V2-004 accessible scene list; V2-003 portable backups; V2-021 recovery after project semantics | Ordinary user can select/edit/save/reopen/export a mixed scene and understand persistence; failure paths retain work. |
| **M2 — evidence and architecture**        | V2-005 benchmark first; V2-011 contract/UI spike; V2-006 resource work; V2-007 and V2-008 comparative research; V2-019 legacy plan               | Recorded measurements, technical decisions and compatibility tests; no mandatory renderer/framework migration.        |
| **M3 — visual quality and productivity**  | V2-009 quality; V2-010 Photo Mode; V2-018 editing tools; V2-022 import expansion only after evidence                                             | Visual references and export/edit workflows pass with idle/resource behavior preserved.                               |
| **M4 — environment and product context**  | V2-012 rooms → V2-014 supports → V2-013 artwork; V2-015 catalog metadata → V2-016 specifications → optional V2-017 suggestions                   | Versioned persistence, exact placement, attribution and useful product context tested end to end.                     |

M4 can be independently prioritized after M1 and architecture decisions. Do not
make room modeling wait on WebGPU. The dependency chain is conceptual, not an
instruction to run parallel agents or projects.

## M1 — dependable editing and ownership

### V2-001 — Coherent units and monitor dimensions

- **Problem:** A-011/A-012: inspector/spacing stay in cm while other UI follows
  CM/IN; nominal monitor sizes convert like any dimension text.
- **Proposed behavior:** one physical measurement preference for creation,
  inspector, spacing, annotations and snap spacing. Keep rotations in degrees
  and scale unitless. Proposed product policy: nominal monitor diagonals always
  show inches; physical enclosure W/D/H follows the chosen unit. Confirm that
  policy before implementation.
- **Rationale:** consistent editing and recognizable product sizes without
  changing real geometry or IDs.
- **Priority:** Must. **Dependencies:** approved measurement policy; existing
  canonical inch actions. **Complexity:** M.
- **Acceptance criteria:** repeated toggles with focused partial/invalid drafts
  do not mutate transforms, lose user text unexpectedly or create history;
  committed edits round-trip through undo, share and projects; monitor size/search
  labels remain consistent with the approved policy; sphere radius/diameter is
  explicitly labeled.
- **Origin:** audit A-011/A-012; user investigation target; new proposed policy.

### V2-002 — Reachable local projects and asset recovery

- **Problem:** A-003: save/open/list/delete, retry and relink are API capabilities,
  while the ordinary imported-scene user has no complete persistence workflow.
- **Proposed behavior:** add named local projects with save/open/list/delete,
  saved/unsaved status, overwrite/delete confirmation, missing-model retry/relink,
  and storage/error feedback. Separate local save from catalog-link sharing.
- **Rationale:** turns the existing IndexedDB service into useful user protection.
- **Priority:** Must. **Dependencies:** v1's chosen import scope; project APIs;
  clear unsaved-change semantics. **Complexity:** M.
- **Acceptance criteria:** via visible UI, save a mixed scene with duplicate local
  assets, reload and reopen identical transforms/IDs; failed/quota save preserves
  prior project; cancelled open preserves live state; relink preserves object
  pose/identity and can be undone; deleting one project leaves another intact;
  explain origin/profile scope and potential browser eviction.
- **Origin:** audit A-003; existing custom-import docs and earlier local-save roadmap.

### V2-003 — Portable, versioned project bundles

- **Problem:** IndexedDB is neither portable nor a backup; share links cannot
  carry custom models, room data or future fields.
- **Proposed behavior:** downloadable versioned bundle with scene records,
  referenced local model bytes and attribution; import through the existing
  validators/staged restore. Define explicit remote-asset reference versus
  inclusion policy; never silently download/embed all remote assets.
- **Rationale:** durable user ownership and an extensible format beyond legacy URLs.
- **Priority:** Must. **Dependencies:** V2-002, format/version/rights policy.
  **Complexity:** L.
- **Acceptance criteria:** mixed scene round-trips in another browser profile;
  duplicate assets are included once; metadata/IDs/transforms survive; bounded
  malformed/oversized/unsupported-version input fails without altering the scene;
  paths cannot escape the bundle namespace; legacy links still decode unchanged;
  missing remote assets produce actionable recovery.
- **Origin:** existing engineering-audit import/export roadmap; audit F-039.

### V2-004 — Accessible scene object navigation

- **Problem:** A-013: keyboard users cannot reliably choose an existing object
  without canvas picking; larger scenes are difficult to navigate.
- **Proposed behavior:** searchable DOM scene list with accessible names,
  select/deselect, inspect and delete; stable focus after deletion/undo and a
  frame-selected command. Retain the current selection service as authority.
- **Rationale:** unlocks existing numerical editing for more users and improves
  precision workflows without replacing the canvas.
- **Priority:** Must. **Dependencies:** selection/store subscriptions; V2-020
  accessibility review. **Complexity:** M.
- **Acceptance criteria:** complete add → select an earlier object → numeric edit
  → delete → undo using keyboard only; screen reader announces identity and
  state; locked desks and missing imports expose appropriate actions; list does
  not recreate scene objects; test focus at desktop and narrow layouts.
- **Origin:** audit A-013/F-005; existing UI accessibility goals; new scene-list proposal.

### V2-021 — Explicit recovery and unsaved-work protection

- **Problem:** F-040: preferences persist but scene edits do not; local storage
  eviction and interrupted work are not surfaced as recovery workflows.
- **Proposed behavior:** dirty-state tracking tied to successful scene edits and
  saves, a disclosed recoverable local draft, and a restore/discard prompt after
  interruption. Define retention and treatment of large imported files before
  enabling autosave. Never upload assets implicitly.
- **Rationale:** protect substantial planning work once persistence is usable.
- **Priority:** Should. **Dependencies:** V2-002/V2-003; quota/retention design.
  **Complexity:** M.
- **Acceptance criteria:** recovery survives reload; failed autosave does not
  overwrite a known-good project; undo back to a saved state updates dirty status
  correctly; user can discard recovery; disabled storage keeps editing functional
  and reports the limitation; test imported blobs and multi-tab conflicts.
- **Origin:** existing engineering-audit autosave candidate; new unsaved-work design.

## M2 — evidence, resources and technical direction

### V2-005 — Representative performance and compatibility baseline

- **Problem:** A-014/F-053: historical default-scene SwiftShader results do not
  establish current large-scene, import or real-GPU performance.
- **Proposed behavior:** extend the documented harness with default, repeated
  catalog, many-unique-asset and near-supported-import-budget scenes; measure
  startup, frame-time distribution during drag, snap preparation, history cost,
  idle work and resource counters on a declared hardware/browser matrix.
- **Rationale:** evidence must precede renderer, quality and optimization choices.
- **Priority:** Must. **Dependencies:** stable v1 baseline; repeatable fixtures.
  **Complexity:** M.
- **Acceptance criteria:** retain raw outputs, hardware/browser/toolchain details,
  cold/warm conditions and repeated-run summaries; run without concurrent suites;
  distinguish GPU counters from physical VRAM; approve explicit budgets before
  performance changes; include Firefox/Safari capability results or documented
  scope decisions, rather than inferring them from Chromium.
- **Origin:** existing `docs/PERFORMANCE.md` roadmap; audit A-014.

### V2-006 — Aggregate scene and history resource budgets

- **Problem:** a per-import limit and 32 MiB idle cache do not bound active or
  history-retained memory; many valid assets can still overwhelm the session.
- **Proposed behavior:** enforce a common object-capacity policy and introduce
  measured aggregate resource accounting, warnings and predictable history/cache
  retention. Optimize bounds/signature work or move parsing off the main thread
  only where V2-005 proves value.
- **Rationale:** reliable complex scenes matter more than an unmeasured engine change.
- **Priority:** Must. **Dependencies:** v1 A-004 fix, V2-005. **Complexity:** L.
- **Acceptance criteria:** publish declared budgets/workloads; over-budget actions
  fail or request an explicit tradeoff before mutation; undo remains correct after
  eviction; exact-once release and cancelled-load tests pass; no geometry sharing
  is mutated; demonstrate measured improvement without regressing idle rendering.
- **Origin:** audit A-004/A-014 and existing performance roadmap.

### V2-007 — WebGPU feasibility spike

- **Problem:** WebGPU may offer useful options, but the current renderer and
  custom appearance/import integration are WebGL-oriented and support costs are unknown.
- **Proposed behavior:** time-box a prototype using the then-supported Three.js
  WebGPU path against the same scenes, materials, shadows, controls and imports.
  Research current primary documentation/browser support at execution time.
- **Rationale:** decide feasibility with parity, performance and fallback evidence.
- **Priority:** Should, research only. **Dependencies:** V2-005; representative
  visual fixtures and identified shader assumptions. **Complexity:** M.
- **Acceptance criteria:** decision record covers supported browsers/adapters,
  unavailable-device fallback, feature/material gaps, visual comparisons, startup
  and interaction measurements, loss/recovery, bundle cost and migration effort;
  conclude adopt/defer/reject with evidence. No production default switch is
  implied, and “WebGPU is faster” is not an acceptance criterion.
- **Origin:** user-supplied rendering candidate; not a confirmed repository commitment.

### V2-008 — Renderer alternatives decision spike

- **Problem:** replacing Three.js could impose large costs in controls, loaders,
  materials, model semantics, selection and lifetime management without user gain.
- **Proposed behavior:** compare continuing with Three.js against a small set of
  viable maintained alternatives selected through current primary-source research.
  Prototype only the highest-risk representative scene/workflow where necessary.
- **Rationale:** explicitly validate the stay-versus-change decision; staying is a
  valid result and the current default.
- **Priority:** Could, research only. **Dependencies:** V2-005, V2-007 findings.
  **Complexity:** M.
- **Acceptance criteria:** weighted decision covers actual bottlenecks, visual
  parity, import formats, gestures, disposal, browser coverage, ecosystem/license
  obligations, bundle/runtime cost and migration effort; alternative must show a
  concrete advantage worth compatibility cost before any migration proposal.
- **Origin:** user-supplied renderer comparison candidate.

### V2-011 — Service contracts and UI architecture decision

- **Problem:** A-017: informal JavaScript contracts and large imperative adapters
  make new UI work harder; a React/ShadCN migration would add separate costs.
- **Proposed behavior:** document and incrementally type scene records, capabilities,
  action/history results and resource leases using JSDoc/checkJs first. Evaluate
  shared native components versus a framework/library only using a concrete new
  workflow such as project management. Assess TypeScript migration boundaries,
  renderer lifetime and ShadCN or alternatives only if they improve that workflow.
- **Rationale:** strengthen maintainability without duplicating scene state.
- **Priority:** Should. **Dependencies:** M1 workflow needs. **Complexity:** M.
- **Acceptance criteria:** typed boundary checks catch malformed callers; no new
  shadow transform store or production debug globals; prototype comparison records
  dependency/bundle/accessibility/maintenance tradeoffs; UI changes preserve
  renderer identity and cleanup; decision explicitly permits retaining vanilla JS.
- **Origin:** existing modernization JSDoc proposal; audit A-017; user architecture candidate.

### V2-019 — Legacy route convergence

- **Problem:** old/mobile inline planners retain independent unsafe/obsolete
  behavior, a vulnerable engine and duplicate maintenance effort.
- **Proposed behavior:** after the v1 parser fix, inventory actual compatibility
  obligations and migrate retained route handling incrementally toward validated
  services/current planner. Any retirement needs an explicit route/link policy.
- **Rationale:** reduces divergent behavior and enables eventual removal of the
  legacy runtime after consumers are gone.
- **Priority:** Should. **Dependencies:** A-001/A-009 decisions, rights inventory,
  stable legacy-link fixtures. **Complexity:** L.
- **Acceptance criteria:** historical URLs and both primitive delimiters remain
  supported or have an explicitly approved migration; authored transforms/IDs
  survive fixtures; no legacy dependency is removed while a shipped consumer
  remains; security scan and route tests verify the resulting distribution.
- **Origin:** existing engineering/dependency/modernization roadmap; audit A-001/A-009.

### V2-020 — Release, browser and visual evidence pipeline

- **Problem:** A-007/A-016: current checks do not provide a reviewed pixel baseline
  on Linux or certify multiple browser engines/devices; publication remains manual.
- **Proposed behavior:** choose a supported browser/device matrix; add appropriate
  smoke coverage, an approved visual environment, accessibility review and a
  reproducible staging/release checklist with dependency and package checks.
- **Rationale:** every later feature needs trustworthy regression/release evidence.
- **Priority:** Must. **Dependencies:** M0 ownership/host decisions. **Complexity:** M.
- **Acceptance criteria:** current candidate has archived green check evidence;
  flaky cases are investigated, not silently skipped; visual changes require
  review; scoped browser/device/assistive-tech outcomes are recorded; actual fork
  subpath links and failed graphics startup are tested; publish only cleared
  `dist/` content with owner-approved settings.
- **Origin:** existing development/UI validation roadmap; audit A-006/A-007/A-015/A-016.

## M3 — visual quality and productive editing

### V2-009 — Measured editor visual-quality controls

- **Problem:** fixed lighting/fog/shadows and legacy tone mapping limit appearance
  tuning; quality costs differ across devices.
- **Proposed behavior:** a small set of reversible quality/environment presets
  for lighting, shadows and material presentation; retain authored product
  appearance and provide a defined default. Evaluate asset/texture optimization
  against visual and rights evidence.
- **Rationale:** better visualization with controlled performance cost, independent
  of whether WebGPU is adopted.
- **Priority:** Should. **Dependencies:** V2-005; V2-006 budgets; rights clearance
  for any new environment/media. **Complexity:** M.
- **Acceptance criteria:** reviewed light/dark and material reference scenes;
  preset changes do not alter transforms or shared immutable materials; measured
  costs remain within approved budgets; idle rendering resumes; defaults work on
  the supported WebGL path; optimized copies retain originals and pass equivalence
  checks where claimed.
- **Origin:** user visual-quality candidate; existing performance roadmap.

### V2-010 — Photo Mode and image capture

- **Problem:** users currently rely on OS screenshots and manually hiding tools.
- **Proposed behavior:** explicit Editor/Photo modes, composition controls and
  bounded-resolution image export; hide editor overlays and optionally use a
  reviewed quality preset without changing scene edits. Explain attribution/export
  limitations where relevant.
- **Rationale:** a useful shareable output without adding cloud collaboration.
- **Priority:** Should. **Dependencies:** V2-009 and V2-005 export budget;
  graphics/readback feasibility spike. **Complexity:** M.
- **Acceptance criteria:** export has documented dimensions and no gizmos/DOM
  annotations; leaving Photo Mode restores prior camera/UI/selection as specified;
  save/undo scene data remains unchanged; failed/oversized export is recoverable;
  remote-texture and supported-browser cases are tested; resources return to
  baseline after repeated exports.
- **Origin:** user Photo Mode candidate; audit F-043.

### V2-018 — Scene organization and broader edit commands

- **Problem:** duplication/scale are hidden import APIs, selection is single-object,
  and there is no visible New/Clear or user scene-template workflow.
- **Proposed behavior:** first expose existing duplicate/import-scale and clear
  commands through capabilities; then evaluate naming, reusable local templates,
  multiselect/group transforms and frame-selected based on user need. Sequence
  multiselect after stable identity and history semantics.
- **Rationale:** practical editor productivity built on current actions.
- **Priority:** Should; multiselect/grouping Could within this candidate.
  **Dependencies:** V2-002/V2-003/V2-004, explicit group/serialization design.
  **Complexity:** L.
- **Acceptance criteria:** each command has an accessible visible entry; locks and
  read-only catalog dimensions are respected; duplicate identity/resources are
  independent as intended; clear is undoable; group edits form one history action
  and survive project reload if grouping is approved; old links remain unchanged.
- **Origin:** audit F-034/F-056; new productivity proposal grounded in existing APIs.

### V2-022 — Evidence-led import format expansion

- **Problem:** the intentionally restricted static glTF importer rejects common
  compressed resources and companion-file exports.
- **Proposed behavior:** research actual user demand; prioritize one format or
  packaging extension at a time behind the existing loader contract. Candidates
  include local companion-file bundles and validated compressed glTF resources.
- **Rationale:** broaden useful model compatibility without bypassing budgets,
  cancellation or cleanup guarantees.
- **Priority:** Could. **Dependencies:** V2-005/V2-006, V2-003 bundle rules, codec
  dependency/rights review. **Complexity:** L.
- **Acceptance criteria:** chosen scope has fixtures for success, missing resources,
  malformed payloads, decompression/decoded allocation limits, cancellation and
  exact disposal; main-thread impact is measured; UI states accepted/rejected
  formats accurately; no blanket GLTFLoader extension enablement without boundary
  validation; unsupported animation remains explicit.
- **Origin:** existing custom-import extension guidance; new prioritization proposal.

## M4 — room and product context

### V2-012 — Parametric room envelope

- **Problem:** a floor and desk arrangement do not model real room boundaries.
- **Proposed behavior:** editable floor size and simple walls with physical
  dimensions and controlled placement; define which room elements are selectable,
  hidden for editing, and persisted. Start with a simple room, not architectural CAD.
- **Rationale:** extends workspace planning to the surrounding environment.
- **Priority:** Should. **Dependencies:** V2-001/V2-003/V2-011; explicit room
  record version/capability design. **Complexity:** L.
- **Acceptance criteria:** create/edit/delete a room with validated dimensions;
  unit switching preserves size; each edit is undoable; save/reload/export restores
  the room; walls can be made non-obstructive for editing by an explicit control;
  existing desk-only links still load; surface classification is explicit.
- **Origin:** user room/wall candidate; audit F-044.

### V2-014 — Generalized support and environment positioning

- **Problem:** current surface snapping recognizes catalog desks/floors only and
  does not attach objects to walls or other imported support surfaces.
- **Proposed behavior:** explicit support/attachment capabilities for approved
  surfaces, clear preview/release controls and exact positioning in room context.
  Define planar support first; keep automatic arbitrary mesh inference optional.
- **Rationale:** makes room/decor placement predictable without physics simulation.
- **Priority:** Should. **Dependencies:** V2-012, existing snapping resolver,
  V2-005 performance budget. **Complexity:** L.
- **Acceptance criteria:** objects attach/release on designated floor/desk/wall
  surfaces with stable orientation; unsupported/tilted/hidden geometry is handled
  explicitly; grid/magnetic precedence remains deterministic; cancellation and
  undo restore exact transforms; new attachment semantics serialize only through
  a versioned format; no hidden movement after unit changes.
- **Origin:** user environment-positioning candidate; current supportKind limitation.

### V2-013 — Wall artwork and decorations

- **Problem:** no wall-mounted image/art object or corresponding placement flow.
- **Proposed behavior:** bounded image import with physical size/aspect and simple
  frame options; mount on supported walls and preserve attribution/source metadata.
  Separate decorative image dimensions from pixel resolution.
- **Rationale:** makes the workspace visualization more personal and complete.
- **Priority:** Could. **Dependencies:** V2-012/V2-014/V2-003; image-budget and
  rights-handling decisions. **Complexity:** M.
- **Acceptance criteria:** image import validates decoded size and type; resize
  preserves approved aspect policy; placement/undo/project export/reopen retains
  content and dimensions; missing images recover visibly; removal releases final
  GPU/blob references; no automatic upload or inferred reuse rights.
- **Origin:** user wall-decoration/artwork candidate.

### V2-015 — Structured product catalog metadata

- **Problem:** current static presentation data lacks a structured source of
  product URLs, specification provenance, asset rights and availability context.
- **Proposed behavior:** extend catalog metadata independently of rendering with
  product information, safe external links, provenance and optional user-owned
  inventory annotations. Treat remote catalog service integration as a separate
  decision; static curated metadata can satisfy initial scope.
- **Rationale:** improves trustworthy product discovery without coupling scenes to
  changing vendor data.
- **Priority:** Should. **Dependencies:** rights/source review, immutable ID policy.
  **Complexity:** M.
- **Acceptance criteria:** product panel exposes source and review date; missing
  links/specs have honest states; external links are validated and safely opened;
  existing IDs/URLs remain stable; scenes still open offline from local assets;
  metadata updates do not silently change saved transforms or geometry.
- **Origin:** user catalog/inventory/product-links candidate; audit F-045/A-018.

### V2-016 — Specifications-aware object configuration

- **Problem:** geometry bounds and authored marketing text do not establish real
  product measurements, and current catalog models are intentionally read-only.
- **Proposed behavior:** show sourced physical dimensions separately from model
  bounds/nominal monitor diagonal; allow explicitly configurable variants or
  clearly labeled generic size proxies when an exact product model is unavailable.
- **Rationale:** improves planning accuracy without misrepresenting product models.
- **Priority:** Should. **Dependencies:** V2-015/V2-001, capability/record design.
  **Complexity:** M.
- **Acceptance criteria:** verified specs include source/date/unit; any difference
  from displayed model bounds is explained; configuration uses explicit allowed
  parameters and retains shared geometry immutability; resizing is undoable and
  persists; unknown specifications remain unknown; no silent distortion of branded
  assets to make a number match.
- **Origin:** user specification candidate; audit A-018/F-018/F-025.

### V2-017 — Relevant product suggestions

- **Problem:** users can browse products but receive no help finding items suitable
  for a measured space or chosen constraints.
- **Proposed behavior:** optional, explainable filtering/suggestions from validated
  catalog dimensions and user-selected criteria. Start with transparent rules;
  external stock/pricing/affiliate integrations require separate scope approval.
- **Rationale:** helps decisions after product data is reliable; premature ranking
  over uncertain dimensions would reduce trust.
- **Priority:** Could. **Dependencies:** V2-015/V2-016 and approved suitability rules.
  **Complexity:** M.
- **Acceptance criteria:** suggestions explain the matching criteria and unknowns;
  missing specifications are never represented as verified fit; user can disable
  suggestions; no scene changes occur without a chosen add action; tests cover
  unit conversion, no matches and stale metadata; any commercial ranking is
  disclosed if separately approved.
- **Origin:** user product-suggestion candidate; no existing recommendation engine.

## Cross-cutting acceptance rules

- Live Three.js transforms remain authoritative. UI subscribes/derives values;
  actions own mutations, store owns membership and history owns retained references.
- New mutations preserve atomic failure/rollback, stale-load guards and exact
  disposal. Cached geometry/textures remain shared and immutable.
- Scene/material edits invalidate scene/shadows; camera-only changes invalidate
  rendering. No permanent render loop or production debug globals.
- Preserve legacy codecs and stable public paths. New room/group/import fields
  use a versioned project format rather than reinterpreting old wire fields.
- Feature validation must include user-visible workflows, not only direct API
  calls; label API-only capabilities honestly until exposed.
- Asset additions require provenance and notices. Optimization preserves original
  binaries, uses site-layout mounts and passes applicable audit/equivalence/visual
  checks. No invented licenses or unmeasured performance claims.
- Each adopted requirement needs an owner, approved scope and appropriate focused
  regressions; release checks follow repository policy when implementation occurs.

## Explicit non-goals

- No v1 delay for new walls, Photo Mode, WebGPU or a framework migration.
- No automatic Three.js replacement, React/TypeScript conversion, ShadCN adoption
  or additional mutable scene store.
- No mandatory WebGPU-only browser requirement; research may conclude defer.
- No cloud accounts, multiplayer editing, marketplace checkout, scraping pipeline
  or automatic third-party model downloads as part of this baseline.
- No full architectural CAD, physics/collision simulation, automatic room scanning,
  animation authoring or support for every 3D format.
- No arbitrary resizing of branded models without an explicit specification and
  capability design; no inferred measurement accuracy from visual resemblance.
- No breaking historical IDs/routes/links or removing originals/vendor assets as
  incidental cleanup. No deployment to the original site's hostname.

## Decisions needed before scope approval

Approve a realistic subset after M0: the proposed highest-value core is local
projects/recovery, portable backups, consistent units, accessible selection and
performance evidence. Confirm the monitor-diagonal policy and whether v1 exposes
project saving or explicitly limits imports to the session. Choose supported
browsers/devices and quality budgets from evidence. Assign owners for publication
rights, deployment and product metadata. Only then select environment, Photo Mode
and product-context milestones; renderer/framework spikes remain evidence gates.
