import { validSpacing } from './configuration.js';

// Strategies receive world-space transforms, the object, nearbyObjects, view,
// placement (allowed world axes / future surface), configuration and gesture.
// They return a transform plus guidance; they never mutate scene objects.
export function gridStrategy({ proposed, configuration, placement, gesture }) {
  const spacing = configuration.grid?.spacing;
  if (!validSpacing(spacing)) return null;
  const position = { ...proposed.position };
  const axes = [];
  for (const axis of placement.axes) {
    if (!['x', 'y', 'z'].includes(axis)) continue;
    // An off-grid object must not jump on a press or tiny pointer tremor.
    // Acquire each active axis after half a cell of intentional movement.
    if (
      gesture &&
      !gesture.acquiredAxes.includes(axis) &&
      Math.abs(position[axis] - gesture.origin[axis]) < spacing / 2
    ) {
      position[axis] = gesture.origin[axis];
      continue;
    }
    let index =
      Math.sign(position[axis]) *
      Math.round(Math.abs(position[axis]) / spacing);
    const previous = gesture?.gridCell;
    if (previous?.spacing === spacing && axis in previous.indices) {
      const last = previous.indices[axis];
      // A small hysteresis band avoids flickering between cells when a pointer
      // rests on a midpoint. Keep integer indices, never rounded display data.
      if (Math.abs(position[axis] / spacing - last) <= 0.55) index = last;
    }
    position[axis] = index === 0 ? 0 : index * spacing;
    axes.push(axis);
  }
  return {
    transform: { ...proposed, position },
    guidance: axes.length ? { kind: 'grid', position, axes } : null,
  };
}

export function createSnappingResolver(strategies = [gridStrategy]) {
  return (context) => {
    let result = { transform: context.proposed, guidance: null };
    if (
      !context.configuration.enabled ||
      context.bypass ||
      context.mode !== 'translate'
    )
      return result;
    for (const strategy of strategies) {
      const resolved = strategy({ ...context, proposed: result.transform });
      if (resolved) result = resolved;
    }
    return result;
  };
}
