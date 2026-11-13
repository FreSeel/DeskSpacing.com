# DeskSpacing v1.0 Block 03 QA — 2026-11-10

This review covers `feat/v1-essential-workflows` against the preceding state/history block (`fix/v1-state-reliability`). The dated [release audit](V1_RELEASE_AUDIT.md) and [feature inventory](FEATURE_INVENTORY.md) remain unchanged as historical evidence.

## Outcome

| Finding | Current assessment | Evidence |
| --- | --- | --- |
| A-003 | Addressed for the scoped local workflow | More → Projects supports named save, list, open, overwrite and delete with confirmations and storage feedback. UI tests cover imported files across reload, quota failure retaining an older save, invalid restore retaining the live scene, missing-asset placeholders, and inline Share errors. |
| A-006 | Addressed for simulated failure paths | Startup catch shows an accessible WebGL2/reload state. Partial initialization releases owned resources. Context loss pauses rendering and exposes recovery feedback; a restored frame clears it only when the context no longer reports lost. QA fixes keep rendering suspended across visibility changes and prevent premature recovery feedback. |
| A-011 | Addressed for scoped physical-distance controls | Numerical position and supported primitive dimensions, measured clearance and target spacing follow CM/IN. Rotation remains degrees. Unit switches cancel unfinished drafts without committing them. Canonical inches, undo/redo and serialization are covered by focused tests. |

The three changes integrate without an observed regression in the tested catalog, import, project, sharing, history, rendering and measurement flows. The branch adds no autosave, cloud sync, account, portable export, WebGL1 or alternate renderer.

## Checks

All checks used Node 24.22.1 and lockfile-installed dependencies (`npm ci`). No full application-wide suite was run.

- Focused Vitest: 9 files, 118 tests passed (imports, actions/history, measurements, numerical transforms, spacing and render scheduling).
- Playwright project and graphics workflows: 16 tests passed before the graphics QA fixes; the complete graphics spec passed again after the fixes (9 tests).
- Playwright affected measurement and precise-control specs: 19 tests passed.
- Playwright imported project, planner and snapping integration selection: 8 tests passed.
- Playwright light/dark desktop/phone dialog screenshots: 4 tests passed.
- Production build, scoped ESLint, scoped Prettier and `git diff --check fix/v1-state-reliability`: passed.

Graphics failure and recovery tests simulate browser events and constructor failures; they do not verify a physical GPU failure or hardware recovery. Browser project storage can be cleared or evicted; it is origin-scoped and is neither cloud synchronized nor a portable backup. Chromium results do not certify Safari, Firefox or physical mobile devices. The pre-existing missing `drawerDesk` asset, legacy npm advisory, A-012 monitor-diagonal policy and broader v2 recovery/export work remain outside Block 03.

**Merge recommendation: Blocked until the tested working tree is committed.** The committed branch HEAD contains A-003 and A-006, but A-011 and the QA fixes remain uncommitted. No blocking code regression was found in the tested working tree. This is not a v1.0 release-candidate certification.
