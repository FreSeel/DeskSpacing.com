# DeskSpacing v1.0 compatibility and device scope

This note records the current v1 release candidate behavior after the dated
November 7 audit. It does not replace the asset-rights review or release-candidate
verification.

## Historical Drawer Desk (A-010)

The `drawerDesk` ID and authored transform remain in the catalog and historical
wire format. Its exact `desks/regular_desk_1.glb` file is absent from the current
tree and repository history. Other similarly named files are not verified as the
same model, size or authorized replacement. No model has been substituted.

Modern catalog loading rejects this ID with an explicit missing-original-model
error. Shared setup restoration stages every object before replacing the scene,
so a failed Drawer Desk load preserves the current scene and releases staged
instances. Published legacy planners reject shared setups containing this ID
before clearing their scenes. Historical links containing `drawerDesk` cannot
restore that desk in v1.0. The release owner must accept that exact compatibility
limit or provide the correct asset with provenance and validate its appearance,
dimensions and behavior before publication.

## Keyboard and assistive access (A-013)

The Objects panel has a flat “Objects in setup” list. Each button identifies an
existing object by product name and instance name, exposes pressed state, and
selects it for the existing controls. A separate button clears selection. The
list follows store membership after add, delete, restore, undo and redo. Existing
controls support keyboard editing, removal and history; dialogs manage focus
return and background inertness. Shared focus-visible styles cover the list.

The 3D canvas itself has no keyboard raycast or spatial navigation. The flat list
does not expose a scene hierarchy or describe geometry and spatial relationships.
No screen-reader acceptance test or full accessibility compliance claim has been
made. The release owner must accept these limits or require an assistive-technology
review and further fixes before release.

## Supported devices and input

The verified automated baseline is desktop Chromium with WebGL2 enabled through
Playwright's SwiftShader setup. The editor requires WebGL2 and shows a reloadable
failure state when graphics initialization fails or the context is lost.
Chromium viewport and emulated touch tests exercise responsive phone and tablet
layouts, sheets and basic gestures. They do not certify physical mobile or tablet
hardware. Safari, Firefox, hardware GPUs, touch assistive technology and real
screen readers are unverified. The retained historical mobile route is a legacy
planner, not a certified version of the modern editor.
