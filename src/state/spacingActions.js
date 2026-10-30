import { createProjectedBounds } from '../measurements/projectedBounds.js';
import { defaultUnit, fromInches, toInches } from '../measurements/units.js';

function optionsFor({ axis, direction, unit = defaultUnit } = {}) {
  if (!['x', 'y', 'z'].includes(axis) || ![1, -1].includes(direction))
    throw new Error('Choose a world direction: +X, −X, +Y, −Y, +Z, or −Z.');
  if (!['in', 'cm'].includes(unit))
    throw new Error('Spacing units must be cm or in.');
  return { axis, direction, unit };
}

function contains(ancestor, object) {
  for (let node = object.parent; node; node = node.parent)
    if (node === ancestor) return true;
  return false;
}

export function createSpacingActions({ state, transforms }) {
  const bounds = createProjectedBounds();
  function readPair(object, reference, { axis, direction }) {
    if (!state.has(object))
      throw new Error('The selected object is no longer available.');
    if (!state.has(reference))
      throw new Error(
        'The reference object is unavailable. Choose another object.',
      );
    if (object === reference)
      throw new Error('Choose a different object as the reference.');
    // Moving either member would also change the other member's bounds.
    if (contains(object, reference) || contains(reference, object))
      throw new Error('Choose a reference outside this object’s hierarchy.');
    const moving = bounds.read(object, axis, direction);
    const fixed = bounds.read(reference, axis, direction);
    if (!moving || !fixed)
      throw new Error(
        'Visible geometry bounds are unavailable for one of these objects.',
      );
    if (!Number.isFinite(moving.min - fixed.max))
      throw new Error('The clearance cannot be calculated for these bounds.');
    return { moving, fixed };
  }
  function result({ moving, fixed }, { axis, direction, unit }) {
    const interval = ({ min, max }) => ({
      min: fromInches(min, unit),
      max: fromInches(max, unit),
    });
    const clearance = fromInches(moving.min - fixed.max, unit);
    if (!Number.isFinite(clearance))
      throw new Error('The clearance exceeds the supported measurement range.');
    return {
      kind: 'projected-bounds',
      space: 'world',
      axis,
      direction,
      unit,
      clearance,
      moving: interval(moving),
      reference: interval(fixed),
    };
  }
  return {
    measure(object, reference, options) {
      const settings = optionsFor(options);
      return result(readPair(object, reference, settings), settings);
    },
    place(object, reference, options = {}) {
      const settings = optionsFor(options);
      const { axis, direction, unit } = settings;
      if (!Number.isFinite(options.clearance) || options.clearance < 0)
        throw new Error(`Enter a finite clearance of zero or more ${unit}.`);
      if (transforms.isTransforming)
        throw new Error(
          'Finish the active transform gesture before applying spacing.',
        );
      const { moving, fixed } = readPair(object, reference, settings);
      const values = transforms.read(object);
      if (!values?.capabilities.position.includes(axis))
        throw new Error('This object cannot move along the chosen axis.');
      // Absolute target, independent of the moving object's current placement.
      // Reapplying a clearance never adds another delta to a rounded position.
      const target =
        direction *
        (fixed.max + toInches(options.clearance, unit) - moving.nearOffset);
      // One partial world-position edit: normal validation, history, invalidation
      // and serialization, with no synthetic gizmo events or snapping correction.
      return transforms.setPosition(object, { [axis]: target }, { unit: 'in' });
    },
  };
}
