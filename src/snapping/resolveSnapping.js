import { validSpacing } from './configuration.js';
import { magneticStrategy, offsetMagneticGuidance } from './magnetic.js';
import { selectSurface, supportsPosition, surfaceGuidance } from './surface.js';

// Strategies receive world-space transforms, the object, nearbyObjects, view,
// placement (allowed world axes), configuration and gesture.
// They return a transform plus guidance; they never mutate scene objects.
export function gridStrategy({ proposed, configuration, placement, gesture }) {
  if (configuration.grid?.enabled === false) return null;
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

export function createSnappingResolver(
  strategies = [magneticStrategy, gridStrategy],
) {
  return (context) => {
    let result = { transform: context.proposed, guidance: null };
    if (
      !context.configuration.enabled ||
      context.bypass ||
      context.mode !== 'translate'
    )
      return result;
    const support = selectSurface(context);
    const contactTransform = (target, transform) => ({
      ...transform,
      position: {
        ...transform.position,
        y:
          target.height -
          context.surface.moving.minY +
          context.surface.moving.origin.y,
      },
    });
    if (support) result.transform = contactTransform(support, result.transform);
    const supportedProposal = result.transform;
    const claimed = new Set(
      context.configuration.surface?.enabled ? ['y'] : [],
    );
    for (const strategy of strategies) {
      const resolved = strategy({
        ...context,
        proposed: result.transform,
        placement: {
          ...context.placement,
          axes: context.placement.axes.filter((axis) => !claimed.has(axis)),
        },
      });
      if (resolved) {
        const magnetic =
          result.guidance?.kind === 'magnetic' ? result.guidance : null;
        result = {
          transform: resolved.transform,
          guidance: magnetic
            ? {
                ...offsetMagneticGuidance(
                  magnetic,
                  result.transform.position,
                  resolved.transform.position,
                ),
                gridAxes: resolved.guidance?.axes || [],
              }
            : resolved.guidance,
        };
        for (const axis of resolved.claimedAxes || []) claimed.add(axis);
      }
    }
    let finalSupport = support;
    if (
      support &&
      !supportsPosition(
        support,
        context.surface.moving,
        result.transform.position,
      )
    ) {
      // Do not let horizontal snapping push a valid raw placement off its
      // support. Reject the conflicting horizontal correction as a whole.
      result = { transform: supportedProposal, guidance: null };
    } else if (!support) {
      finalSupport = selectSurface(context, result.transform.position);
      if (finalSupport) {
        const before = result.transform.position;
        result.transform = contactTransform(finalSupport, result.transform);
        if (result.guidance?.kind === 'magnetic')
          result.guidance = offsetMagneticGuidance(
            result.guidance,
            before,
            result.transform.position,
          );
        else if (result.guidance?.kind === 'grid')
          result.guidance = {
            ...result.guidance,
            position: result.transform.position,
          };
      }
    }
    if (finalSupport) {
      result.guidance = {
        ...(result.guidance || { kind: 'surface' }),
        surface: surfaceGuidance(
          finalSupport,
          context.surface.moving,
          result.transform.position,
        ),
      };
    }
    return result;
  };
}
