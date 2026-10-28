import { cross, subtract } from './footprint.js';

export const surfaceLimits = Object.freeze({
  acquire: 1,
  release: 2,
  level: 0.01,
  inset: 0.05,
});

function contains(target, point) {
  const { minX, maxX, minZ, maxZ } = target.bounds;
  if (point.x < minX || point.x > maxX || point.z < minZ || point.z > maxZ)
    return false;
  return target.triangles.some(([a, b, c]) => {
    const sides = [
      cross(subtract(b, a), subtract(point, a)),
      cross(subtract(c, b), subtract(point, b)),
      cross(subtract(a, c), subtract(point, c)),
    ];
    return sides.every((v) => v >= -1e-8) || sides.every((v) => v <= 1e-8);
  });
}

export function contactAt(moving, position) {
  return {
    x: moving.center.x + position.x - moving.origin.x,
    y: moving.minY + position.y - moving.origin.y,
    z: moving.center.z + position.z - moving.origin.z,
  };
}

export function supportsPosition(target, moving, position) {
  return contains(target, contactAt(moving, position));
}

export function selectSurface(context, position = context.proposed.position) {
  const { surface, gesture, placement } = context;
  if (
    !context.configuration.surface?.enabled ||
    !surface?.moving ||
    gesture?.surfaceBlocked ||
    (gesture && !gesture.magneticStarted)
  )
    return null;
  const point = contactAt(surface.moving, position);
  const held = surface.targets.find((t) => t.key === gesture?.surfaceLock);
  const eligible = (target, distance) =>
    Math.abs(point.y - target.height) <= distance && contains(target, point);
  if (held && eligible(held, surfaceLimits.release)) return held;
  // Release before considering a different target. Horizontal movement retains
  // its last contact height and can only transfer to a coplanar support.
  if (held) return null;
  return (
    surface.targets
      .filter(
        (target) =>
          eligible(target, surfaceLimits.acquire) &&
          [
            [surfaceLimits.inset, 0],
            [-surfaceLimits.inset, 0],
            [0, surfaceLimits.inset],
            [0, -surfaceLimits.inset],
          ].every(([x, z]) =>
            contains(target, { ...point, x: point.x + x, z: point.z + z }),
          ) &&
          (gesture?.surfaceLevel === undefined ||
            placement.axes.includes('y') ||
            Math.abs(target.height - gesture.surfaceLevel) <=
              surfaceLimits.level),
      )
      .sort(
        (a, b) =>
          Math.abs(a.height - point.y) - Math.abs(b.height - point.y) ||
          a.key.localeCompare(b.key),
      )[0] || null
  );
}

export function surfaceGuidance(target, moving, position) {
  const point = contactAt(moving, position);
  const dx = position.x - moving.origin.x,
    dz = position.z - moving.origin.z;
  return {
    key: target.key,
    height: target.height,
    kind: target.kind,
    point: { ...point, y: target.height },
    footprint: moving.footprint.map((p) => ({
      x: p.x + dx,
      y: target.height,
      z: p.z + dz,
    })),
  };
}
