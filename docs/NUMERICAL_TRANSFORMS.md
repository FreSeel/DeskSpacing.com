# Numerical transformation API

The infrastructure is exposed as `app.actions.transforms`. This phase adds no
inspector controls or relative-spacing interface. Live Three.js roots and their
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

| Object                 | Writable dimensions  | Other constraints                                                 |
| ---------------------- | -------------------- | ----------------------------------------------------------------- |
| Reference box          | width, height, depth | Normal movement/rotation lock applies                             |
| Reference sphere       | diameter             | W/H/D are read-only and remain equal                               |
| Custom desktop         | width, depth         | Position/rotation remain locked; current thickness stays unchanged |
| Catalog model or floor | none                 | Dimensions remain available as measurements                       |

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

## Contract for the next UI phase

Use `selection.subscribe`, the measurement preference, and
`view.subscribeRender` to refresh the selected object's derived readout.
`transforms.subscribe` is the existing immediate history/availability
subscription: it fires on begin/commit, numerical changes, undo/redo, and
membership clearing. It is not a per-pointer-update stream. Read after the
existing invalidated render to observe final snapping corrections. Camera-only
renders may reuse the readout; compare values before writing DOM fields.

Keep input drafts in the UI only. Rendering a value must never invoke a setter.
Send only changed fields on Apply/Enter; Escape discards the draft. Do not
re-import rounded labels on blur, unit switches, or selection changes. Disable
commits while `isTransforming` is true, and invalidate stale drafts when the
selection or underlying object changes. Unsubscribe on teardown. No timer,
extra animation loop, or production debug global is needed.

## Deferred verification

Regression cases were added in `tests/unit/numerical-transforms.test.js` and
`tests/unit/transform-snapping.test.js`. They cover exact edits, conversion
no-ops, geometry/history ownership, read-only capabilities, failed allocation,
parent conversion, legacy round trips, and numerical placement followed by a
snapped drag. They have **not been executed** in this phase. The application,
lint, formatting checks, and final evaluation have not been run either.

After the remaining phases, use Node 24.22.1 and `npm ci`, install Chromium,
and run the required repository checks plus the new UI/interaction regressions.
Retain the existing limitations: missing `drawerDesk`, legacy npm advisory, and
no mobile/Safari/Firefox certification from Chromium results.
