# Precise spacing

The selected object's existing menu includes **Precise Spacing**. Choose another
scene object, a world direction (+X, −X, +Y, −Y, +Z, or −Z), and a clearance in
centimeters. Apply spacing or Enter in the clearance field performs one placement.
Blur does not place an object. Escape restores the last applied clearance text
(initially 10 cm). Selection changes reset the reference and draft. The readout
always measures the current scene, including after dragging, rotation, resizing,
snapping, numerical edits, and undo/redo.

## Measurement contract

Clearance is the signed separation of two **bounding boxes projected onto a
chosen world direction**. The boxes use the existing geometry-derived authored
dimension frame, including descendant transforms, then the complete root world
matrix. Scaling, rotation, authored origins, import wrappers, and parent
transforms all contribute. For direction `u` (+/− one world axis):

```text
moving interval    = [min(dot(u, moving box corners)), max(...)]
reference interval = [min(dot(u, reference box corners)), max(...)]
clearance          = moving.min − reference.max
```

- Positive means the moving box lies beyond the reference box in that direction.
- Zero means their projected boundaries meet.
- Negative means they are not separated in that direction. This can mean
  overlapping intervals or that the selected object is on the opposite side;
  its magnitude is not necessarily overlap depth.
- Other axes are ignored. Boxes can be far apart on Y/Z while having negative X
  clearance. Zero does not promise physical surface contact. This is neither a
  Euclidean distance, a collision test, nor an exact mesh-surface measurement.
- An authored bounding box transformed into world space can conservatively
  enclose empty areas, particularly for rotated curved or irregular models.
  This matches the existing dimension/footprint proxy convention. It is not a
  newly fitted minimum-volume box or a triangle query.

`src/measurements/projectedBounds.js` reuses `createObjectDimensions` and projects
its eight box corners. Readers are cached per root in a WeakMap, with the
existing geometry-version and descendant-transform invalidation. World matrices
are refreshed on every read. Only derived bounds are cached; no transformation
state is duplicated. Hidden hierarchy nodes, helper/snapping-ignore meshes, and
meshes with hidden or fully transparent materials are excluded, following the
existing surface geometry visibility convention. Mixed-material meshes follow
that conservative all-materials-visible rule. Empty/nonfinite bounds are
unavailable. Geometry bounds retain the existing reader's all-vertex convention.

Measurements use actual rendered geometry data, including Float32 vertex
precision. An editable primitive's parameter dimensions can differ slightly from
its geometry bounds. Clearance is exact to the selected bounds and normal
floating-point arithmetic; no rounded dimension labels enter the calculation.

## Action API and placement

```js
const spacing = app.actions.spacing;
const object = app.selection.pickedObject;
const reference = app.state.objects.find((other) => other !== object);

const measurement = spacing.measure(object, reference, {
  axis: 'x',
  direction: 1,
  unit: 'cm',
});
// {
//   kind: 'projected-bounds', space: 'world', axis: 'x', direction: 1,
//   unit: 'cm', clearance: number,
//   moving: { min, max }, reference: { min, max }
// }
// Intervals are projected coordinates, including the direction's sign.

const changed = spacing.place(object, reference, {
  axis: 'x',
  direction: 1,
  clearance: 10.123456789,
  unit: 'cm',
});
// true for a move; false when the target position is already unchanged.
```

Axis and direction are required. Direction must be the number `1` or `-1`.
Units are `cm` or `in`, defaulting to `in` like the transformation API. The menu
always passes `cm`; one scene unit is one inch, exactly 2.54 cm. Requested
clearance must be a finite, nonnegative number. Negative _measurements_ remain
valid. Numeric strings and incomplete text never enter the action API.

For +X, the required moving origin is:

```text
reference.maxX + requestedClearanceInches − moving.nearOffsetX
```

`nearOffsetX` is the selected box's projected near boundary relative to its
authored root origin, including rotation and scale. For any sign `s`, the target
world-axis coordinate is `s * (reference.max + clearance − moving.nearOffset)`.
Offsets are projected with the matrix's linear part directly, without subtracting
large world coordinates. The target does not depend on the moving object's old
position, avoiding accumulated delta corrections when Apply is repeated.

`src/state/spacingActions.js` validates both store members, direction, bounds,
clearance, gesture availability, and the transformation API's axis capability.
It submits one partial world-position patch to `transforms.setPosition` in scene
units, avoiding an extra inch/cm round trip. That API enforces existing world
and local coordinate limits before mutation. Failure throws an explanatory Error
without moving the object or adding history. Read-only objects, including desks
and floors, remain valid reference objects. Locked selected objects can be
measured but not moved.

An invertible transformed parent is handled by the existing world-to-local
conversion. Unrelated **world** coordinates stay unchanged within floating-point
precision; several local components may necessarily change. Rotation, scale,
geometry, and dimensions are preserved. A reference that is an ancestor or
descendant of the moving object is rejected, since moving one would also alter
the other's bounds. Independent objects under a shared parent remain supported.
The editor still has no user grouping feature, and the legacy format does not
serialize arbitrary parent hierarchies or root scale.

## Integration and interaction

- One successful placement is one normal transformation history entry. Undo and
  redo use the existing snapshots. Reapplying an unchanged target is a no-op.
  Existing history clearing on membership/desk replacement remains unchanged.
- Placement bypasses snapping through the numerical setter. No synthetic
  TransformControls event is dispatched; no snapping settings or resolver code
  change. The next native drag starts from the exact new position.
- Save/load uses the ordinary live root position. No new wire fields, retained
  reference IDs, constraints, offsets, or relationships are serialized. Moving,
  resizing, or removing a reference later never automatically moves the target.
- `src/ui/preciseSpacingPanel.js` builds stable controls within the existing
  inspector and uses its styling tokens. It subscribes to selection, membership,
  transform history/availability, and the existing invalidated-render stream.
  Membership updates reconcile reference options by live object identity/UUID,
  never by reusable instance names. Labels include both product and instance
  names to distinguish duplicates. Removed references require a new choice.
- Only draft text, current reference/direction choices, and feedback live in the
  UI. There is no independent desired-position model. Renders do not overwrite
  the clearance draft, call setters, or request frames. A live measurement and
  the existing numerical coordinate inputs refresh immediately after placement.
- Complete finite decimal/scientific input is accepted, with nonnegative values
  required for Apply. Empty fields, standalone signs, and partial exponents can
  be typed freely. Invalid Apply/Enter leaves the draft visible with an error and
  does not move anything. Bounds/reference/constraint failures are also visible.
- The measured readout displays six decimal places with insignificant zeros
  removed and a full-precision tooltip. Very small nonzero measurements remain
  nonzero. Formatting is never fed back into transforms or placement. Native
  gesture transactions block placement, but their live bounds still refresh.

## Verification criteria

The combined evaluation executes `tests/unit/precise-spacing.test.js`,
`tests/e2e/precise-spacing.spec.js`, and
`tests/e2e/precise-controls-integration.spec.js`. See
[PRECISE_CONTROLS_EVALUATION.md](PRECISE_CONTROLS_EVALUATION.md) for the actual
results and evidence. The criteria are:

1. All six signed directions place rotated/scaled bounds at a requested decimal
   clearance within 1e-8 cm absolute error for the tested fixtures. This includes
   10 cm placement near the coordinate limits. Negative/zero measurements follow
   the directed-interval semantics, even with separation on other axes.
2. Rotation, dimensions, and other world coordinates survive placement; parent
   conversion and descendant bounds are accounted for. Applying the same target
   repeatedly produces no drift or extra history entries in supported scenes.
3. One Undo/Redo restores/reapplies placement. Saved setups restore the resulting
   coordinates using the unchanged legacy format. Later reference changes do not
   move the selected object.
4. Placement stays exact with snapping enabled, and subsequent actual gizmo
   drags still snap normally. The numerical inspector reflects both operations.
5. Live movement, rotation, resizing, reference changes, and history refresh the
   measured clearance without replacing unfinished clearance input.
6. Invalid/incomplete/negative/nonfinite input, coordinate overflow, unavailable
   geometry, deleted/replaced references, locked movement, active gestures, and
   dependent hierarchies leave the object unchanged and report the reason.
7. Duplicate names, selection switches, scene restore, teardown, desktop layout,
   and the responsive inspector sheet remain usable. Inspector and help visual
   baselines are reviewed deliberately; these checks are not a comprehensive
   accessibility audit.

The measured label rounds to six decimal places (up to 0.0000005 cm display
error), while the tooltip and calculations retain double precision. The
arithmetic tolerance above does not certify physical accuracy of catalog models,
exact surface distance, or every possible externally constructed hierarchy.

Run the final checks with Node 24.22.1, `npm ci`, and the repository's Chromium
setup. Existing missing `drawerDesk`, legacy npm advisory, and lack of automatic
mobile/Safari/Firefox certification remain unchanged.
