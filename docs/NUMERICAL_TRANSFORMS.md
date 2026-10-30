# Numerical transformation API

The infrastructure is exposed as `app.actions.transforms`. The existing object
inspector now binds to it through `src/ui/numericalTransformPanel.js`.
[Precise spacing](PRECISE_SPACING.md) uses the same world-position setter through
`app.actions.spacing`. Live Three.js roots and their
owned geometry remain authoritative; reads are derived snapshots, and history
contains bounded before/after values. There is no second live transformation
model, new render loop, or change to the snapping resolver.

## Public operations

```js
const transforms = app.actions.transforms;
const object = app.selection.pickedObject;

const values = transforms.read(object, { unit: 'cm' });
// null when the object is absent, removed, or the service is disposed
// Otherwise:
// {
//   unit: 'cm',
//   positionSpace: 'world', position: { x, y, z },
//   rotationSpace: 'local', rotationOrder: 'XYZ',
//   rotationDegrees: { x, y, z },
//   dimensions: { width, height, depth }, // null if geometry is unavailable
//   capabilities: {
//     position: ['x', 'y', 'z'],
//     rotationDegrees: ['x', 'y', 'z'],
//     dimensions: ['width', 'height', 'depth']
//   }
// }
// Canonical spheres also expose dimensions.diameter.

transforms.setPosition(object, { x: 25.4, y: 80 }, { unit: 'cm' });
transforms.setRotationDegrees(object, { y: 45.125 });
transforms.setDimensions(object, { width: 120, depth: 60 }, { unit: 'cm' });

// One atomic edit and one history entry, even when multiple sections change.
transforms.update(
  object,
  {
    position: { z: -150 },
    rotationDegrees: { y: -15.125 },
    dimensions: { width: 30.123456789 },
  },
  { unit: 'cm' },
);

transforms.undo();
transforms.redo();
```

All patches are partial: omitted components stay unchanged. Send only editable,
dirty fields. An unsupported field is rejected even when its requested value
matches the current value; do not submit an entire sphere dimension readout.
Set sphere size with `setDimensions(sphere, { diameter: 20 }, { unit: 'cm' })`.

Mutations return `true` for an edit and `false` for a no-op. Invalid patches,
unsupported fields, stale objects, and numerical edits during an active gesture
throw an `Error` before changing the object or history. Reads return independent
plain objects, never writable references to scene vectors or history arrays.
`canUndo`, `canRedo`, and `isTransforming` expose transaction availability.

## Coordinates, units, and precision

- One scene unit is one inch, exactly 2.54 cm. The default API unit is `in`,
  consistent with existing measurement helpers. Pass `{ unit: 'cm' } explicitly
  for centimeter fields; no other units are accepted.
- Position is the **authored root origin in world space**, not the center or
  bottom of the visible geometry. X/Z are horizontal and Y is up. World edits
  update current parent matrices and convert to the root's local position.
- Rotation inputs are absolute **parent-local Euler components in degrees**.
  Stored angles remain radians in the existing `XYZ` order. Catalog initial
  rotations are retained. Values are not wrapped or normalized on read/apply.
  Quaternion-driven gizmo changes may expose equivalent Euler representations.
  The API does not enable another Euler order or offer a world-Euler setter.
- Width=X, height=Y, depth=Z in the existing authored dimension frame. These
  are physical model dimensions, not the enclosing world-axis box. Catalog
  measurements include descendant transforms, import wrappers, and stands.
- Editable primitive measurements come from the current geometry parameters,
  preserving the requested double precision. Rendered vertices are Float32;
  their measured bounds can differ slightly. Other objects use the existing
  geometry-derived dimension reader. No catalog description is used as a size.
- No values are formatted or rounded by the API. A read/apply of unchanged
  values in either unit is a no-op, including under transformed parents. Only
  changed components are converted; unchanged rotations are not rewritten via
  Euler/quaternion conversion during a position or dimension edit.

Inputs must be finite JavaScript numbers; blank strings, numeric strings,
arrays, unknown axes/sections, NaN, and infinities are rejected. The complete
candidate record is checked against the existing legacy codec limits before
mutation: local coordinates and radians within +/-1,000,000, and positive box
dimensions/sphere radius no greater than 10,000 inches. Position edits also
check the resulting world coordinates against that coordinate limit. Sphere
diameter may therefore reach 20,000 inches. No new minimum positive size or
decimal step is imposed by this API.

## Resizing capabilities and resource ownership

| Object                 | Writable dimensions  | Other constraints                                                  |
| ---------------------- | -------------------- | ------------------------------------------------------------------ |
| Reference box          | width, height, depth | Normal movement/rotation lock applies                              |
| Reference sphere       | diameter             | W/H/D are read-only and remain equal                               |
| Custom desktop         | width, depth         | Position/rotation remain locked; current thickness stays unchanged |
| Catalog model or floor | none                 | Dimensions remain available as measurements                        |

Custom desktops created by the application retain their one-inch (2.54 cm)
thickness. If a legacy link supplies another thickness, editing width/depth
preserves that existing value rather than silently repairing the link.

Resizing requires a factory-owned primitive in the existing editable frame:
direct child of an identity scene, unit root scale, identity child mesh
transform, and `XYZ` root Euler order. Externally scaled, regrouped, or altered
hierarchies remain measurable but do not advertise dimension editing. This
avoids pretending that a dimension edit can persist a nonserializable scale or
parent transform. Handle-axis visibility is not a numerical axis constraint;
the existing `NoSelect` type lock is respected.

The factory allocates replacement geometry before swapping it and disposing the
superseded geometry once. The root, child mesh, origin, rotation, material,
texture, instance name, and membership are retained. Shared imported geometry
is never resized. A geometry allocation failure retains the old geometry and
transforms. History retains parameters, not GPU resources; undo/redo reconstruct
geometry through the same factory path. Geometry identity changes invalidate
the existing dimension and snapping caches.

## Snapping, history, and persistence

Numerical setters bypass the positional snapping pipeline. They neither change
snap settings nor dispatch synthetic TransformControls events. The next real
drag captures the exact new origin and follows the existing snapping behavior.
Free dragging, rotation, and snapped movement remain immediately visible to
`read()` because it reads the actual object, not the last numerical request.

Each successful numerical call records one history entry and calls
`invalidateScene()` once. No-ops neither invalidate nor notify nor clear redo.
An active native gesture blocks numerical calls; a second `begin()` cannot
overwrite its pending snapshot. The existing gesture `begin`,
`moveWorldPosition` (world inches), and `commit` methods are internal interaction
hooks, not numerical UI setters. They retain their existing role in snapping.

History still holds at most 100 entries and clears on membership or desk-offset
changes. Entries additionally capture owned primitive geometry parameters.
Failed geometry reconstruction leaves the undo/redo entry on its original
stack. Reparenting invalidates a history entry rather than applying old local
coordinates beneath another parent.

The legacy wire format is unchanged. Position and Euler radians are read from
the live root; primitive parameters are read from the current geometry by the
same helper used for history. Sphere diameter edits save `[radius, -1, -1]`.
Factory reconstruction restores the resized geometry with unit primitive
scale. There is no general scale-editing API or new saved field.

The editor has no user grouping feature. Model descendants/import wrappers
retain their authored transforms. World/local position conversion supports an
invertible transformed parent, but arbitrary parent hierarchies and scene
transforms still are not saved by the legacy format. This phase does not claim
grouped-scene round trips; a grouping feature must design its own persistence.

## Inspector binding

`src/ui/numericalTransformPanel.js` builds stable fieldsets inside the existing
object menu: world-origin position X/Y/Z, local rotation X/Y/Z, and physical
width/height/depth. Fields use centimeters and degrees explicitly, regardless
of the catalog/annotation CM/IN preference. Fixed dimensions and locked axes
are read-only; spheres have an additional diameter field for uniform resizing.
Labels state the world-origin, Y-up, parent-local Euler order, and object-axis
dimension conventions. Styling uses the existing inspector and theme tokens.

The binding uses `selection.subscribe` and `view.subscribeRender` to refresh
the selected object's derived readout.
`transforms.subscribe` is the existing immediate history/availability
subscription: it fires on begin/commit, numerical changes, undo/redo, and
membership clearing. It is not a per-pointer-update stream. Read after the
existing invalidated render to observe final snapping corrections. Camera-only
renders may reuse the readout; compare values before writing DOM fields.

Inputs are text fields with decimal keyboards so temporary values such as an
empty string, `-`, or `1e-` remain intact while typing. Complete signed decimal
numbers and scientific notation are accepted; NaN, Infinity, hex, unit suffixes,
and decimal commas are rejected. Dimensions must be positive. Validation still
runs through the authoritative transformation action before mutation.

Only a focused field's uncommitted text, original value, and dirty/conflict flags
are kept in the UI. Enter and blur commit just that field as one action. Escape
cancels its draft without dismissing the responsive inspector sheet. Invalid
Enter retains the text with an accessible error; invalid blur restores the live
value and reports that the edit was not applied. IME composition is not committed
by an intermediate Enter. Unchanged focus/blur never submits a rounded value.

Unfocused values display up to six decimal places (very small nonzero values
remain nonzero). Focus exposes the full-precision value; tooltips also retain
it. Formatting never modifies the object. Dirty fields retain their text and
caret through unrelated renders. If that same live value changes externally,
the draft stays visible but cannot overwrite the newer value: Escape, Enter,
or blur discards it and refreshes from the scene. Other axes can update without
invalidating a partial single-field edit. Selection changes discard old drafts
and rebind the same DOM fields, including when a field retains focus.

The binding uses read-only inputs while `isTransforming` is true. A capture-phase
canvas pointer-down listener commits a preceding valid draft before native
TransformControls begins its gesture; otherwise the normal canvas focus/blur
sequence would attempt to commit inside an already pending drag. It does not
cancel, synthesize, or change pointer events or snapping resolution. All other
commits use Enter/blur and the existing actions. Rendering never calls a setter
or requests another frame. Subscriptions and listeners are removed on teardown.
No timer, extra animation loop, or production debug global is introduced.

## Verification

The combined evaluation executes the API, input, native gesture, inspector,
history, and persistence regressions using Node 24.22.1 and Chromium against
the production build. See [PRECISE_CONTROLS_EVALUATION.md](PRECISE_CONTROLS_EVALUATION.md)
for executed results, numerical tolerances, manual UI evidence, corrections,
and platform limitations. Inspector and help visual baselines were reviewed
and updated for the added controls and editing instructions.

Exact-input assertions compare stored values with the corresponding JavaScript
unit conversion, without rounding. Display assertions allow six-decimal
formatting; focus/blur must not feed that formatting back into state. The
spacing regression tolerance is 1e-8 cm for its tested fixtures, including
near-limit coordinates. This is an arithmetic tolerance, not a claim about
physical model accuracy or Float32 mesh precision.
