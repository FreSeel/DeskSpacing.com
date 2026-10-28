import {
  cross,
  dot,
  edges,
  prepareFootprintProximity,
  subtract,
} from './footprint.js';

export const magneticLimits = Object.freeze({
  acquirePixels: 8,
  releasePixels: 14,
  acquireDistance: 2,
  releaseDistance: 3.5,
  neighborGap: 12,
  levelTolerance: 1,
});
const offset = (p, origin) => ({
  x: p.x - origin.x,
  y: p.y - origin.y,
  z: p.z - origin.z,
});
const shifted = (p, by) => ({ x: p.x + by.x, y: p.y + by.y, z: p.z + by.z });
const midpoint = (line) => ({
  x: (line[0].x + line[1].x) / 2,
  y: (line[0].y + line[1].y) / 2,
  z: (line[0].z + line[1].z) / 2,
});

function centerline(proxy, normal) {
  const tangent = { x: -normal.z, z: normal.x };
  const extent = proxy.points.map((p) =>
    dot(subtract(p, proxy.center), tangent),
  );
  return [Math.min(...extent), Math.max(...extent)].map((length) => ({
    x: proxy.center.x + tangent.x * length,
    y: proxy.minY,
    z: proxy.center.z + tangent.z * length,
  }));
}

// Build geometric relationships once per gesture. All points are derived from
// oriented proxies; no vertex scans or geometry allocations occur in resolution.
export function prepareMagneticAnchors({ moving, targets }) {
  if (!moving) return null;
  const movingEdges = edges(moving.points);
  return {
    moving,
    groups: targets.map((target) => {
      const targetEdges = edges(target.points);
      const constraints = [];
      function add(id, kind, normal, movingLine, targetLine) {
        const localLine = movingLine.map((p) => offset(p, moving.origin));
        constraints.push({
          id,
          kind,
          normal,
          movingLine: localLine,
          targetLine,
          constant: dot(subtract(targetLine[0], localLine[0]), normal),
        });
      }
      for (const [mi, m] of movingEdges.entries()) {
        for (const [ti, t] of targetEdges.entries()) {
          if (Math.abs(cross(m.tangent, t.tangent)) > 1e-5) continue;
          add(`edge:${mi}:${ti}`, 'edge', t.normal, [m.a, m.b], [t.a, t.b]);
        }
      }
      // World X/Z centerlines remain meaningful for differently rotated objects.
      // Target-local centerlines additionally support shared diagonal orientations.
      const normals = [
        { x: 1, z: 0 },
        { x: 0, z: 1 },
      ];
      for (const { normal } of targetEdges) {
        if (!normals.some((n) => Math.abs(cross(n, normal)) < 1e-5))
          normals.push(normal);
      }
      normals.forEach((normal, i) =>
        add(
          `center:${i}`,
          'center',
          normal,
          centerline(moving, normal),
          centerline(target, normal),
        ),
      );
      const candidates = constraints.map((c) => ({
        id: c.id,
        kind: c.kind,
        parts: [c],
      }));
      for (let a = 0; a < constraints.length; a++) {
        for (let b = a + 1; b < constraints.length; b++) {
          const parts = [constraints[a], constraints[b]];
          if (Math.abs(cross(parts[0].normal, parts[1].normal)) < 0.1) continue;
          candidates.push({
            id: `${parts[0].id}|${parts[1].id}`,
            kind: parts.every((c) => c.kind === 'edge')
              ? 'corner'
              : parts.every((c) => c.kind === 'center')
                ? 'center'
                : 'edge-center',
            parts,
          });
        }
      }
      // Coincident footprint vertices are useful even when edges aren't parallel.
      for (const [mi, m] of moving.points.entries()) {
        for (const [ti, t] of target.points.entries()) {
          const local = offset(m, moving.origin);
          candidates.push({
            id: `corner:${mi}:${ti}`,
            kind: 'corner',
            parts: [],
            anchor: subtract(t, local),
            movingPoint: local,
            targetPoint: t,
          });
        }
      }
      return {
        target,
        candidates,
        proximity: prepareFootprintProximity(moving.points, target.points),
      };
    }),
  };
}

function correction(candidate, position, axes) {
  const x = axes.includes('x'),
    z = axes.includes('z');
  if (!x && !z) return null;
  if (candidate.anchor) {
    const delta = subtract(candidate.anchor, position);
    if ((!x && Math.abs(delta.x) > 1e-6) || (!z && Math.abs(delta.z) > 1e-6))
      return null;
    return { x: x ? delta.x : 0, z: z ? delta.z : 0 };
  }
  const rows = candidate.parts.map(({ normal, constant }) => ({
    x: x ? normal.x : 0,
    z: z ? normal.z : 0,
    value: constant - dot(normal, position),
  }));
  if (rows.some((row) => dot(row, row) < 1e-8 && Math.abs(row.value) > 1e-6))
    return null;
  const [a, b] = rows.filter((row) => dot(row, row) >= 1e-8);
  if (!a) return null;
  const length = dot(a, a);
  if (length < 1e-8) return null;
  let delta = { x: (a.x * a.value) / length, z: (a.z * a.value) / length };
  if (b) {
    const determinant = cross(a, b);
    if (Math.abs(determinant) > 1e-6)
      delta = {
        x: (a.value * b.z - b.value * a.z) / determinant,
        z: (a.x * b.value - b.x * a.value) / determinant,
      };
    else if (Math.abs(dot(b, delta) - b.value) > 1e-6) return null;
  }
  return delta;
}

function guidanceFor(candidate, position, target, key, axes) {
  const lines = [],
    points = [],
    movingLines = [],
    movingPoints = [];
  for (const part of candidate.parts) {
    const movingLine = part.movingLine.map((p) => shifted(p, position));
    lines.push(movingLine, part.targetLine);
    movingLines.push([true, true], [false, false], [true, false]);
    const a = midpoint(movingLine),
      b = midpoint(part.targetLine);
    lines.push([a, b]);
    points.push(a, b);
    movingPoints.push(true, false);
  }
  if (candidate.anchor) {
    const a = shifted(candidate.movingPoint, position);
    lines.push([a, candidate.targetPoint]);
    points.push(a, candidate.targetPoint);
    movingLines.push([true, false]);
    movingPoints.push(true, false);
  }
  return {
    kind: 'magnetic',
    alignment: candidate.kind,
    target: target.key,
    axes,
    lines,
    points,
    movingLines,
    movingPoints,
    lock: { key, target: target.key, parts: candidate.parts.map((c) => c.id) },
    gridAxes: [],
  };
}

export function offsetMagneticGuidance(guidance, before, after) {
  const delta = offset(after, before);
  return {
    ...guidance,
    lines: guidance.lines.map((line, i) =>
      line.map((p, j) => (guidance.movingLines[i][j] ? shifted(p, delta) : p)),
    ),
    points: guidance.points.map((p, i) =>
      guidance.movingPoints[i] ? shifted(p, delta) : p,
    ),
  };
}

export function magneticStrategy({
  proposed,
  configuration,
  placement,
  gesture,
  magnetic,
  view,
}) {
  if (
    !configuration.objects?.enabled ||
    !magnetic ||
    (gesture && !gesture.magneticStarted)
  )
    return null;
  const measure = view?.measureCorrection;
  if (!measure) return null;
  const raw = proposed.position;
  const { moving } = magnetic;
  const translation = offset(raw, moving.origin);
  const base = moving.minY + translation.y;
  const previous = gesture?.magneticLock;
  const possible = [];
  for (const { target, candidates, proximity } of magnetic.groups) {
    const level = target.support ? target.maxY : target.minY;
    if (
      Math.abs(base - level) > magneticLimits.levelTolerance ||
      proximity.some((range) => {
        const shift = dot(translation, range.normal);
        return (
          range.minMoving + shift - range.maxTarget >
            magneticLimits.neighborGap ||
          range.minTarget - range.maxMoving - shift > magneticLimits.neighborGap
        );
      })
    )
      continue;
    for (const candidate of candidates) {
      const delta = correction(candidate, raw, placement.axes);
      if (!delta) continue;
      const key = `${target.key}/${candidate.id}`;
      const retained = key === previous?.key;
      const worldLimit = retained
        ? magneticLimits.releaseDistance
        : magneticLimits.acquireDistance;
      if (Math.hypot(delta.x, delta.z) > worldLimit) continue;
      const distance = measure(shifted(moving.center, translation), {
        ...delta,
        y: 0,
      });
      if (
        distance >
        (retained ? magneticLimits.releasePixels : magneticLimits.acquirePixels)
      )
        continue;
      const axes = placement.axes.filter(
        (axis) =>
          axis !== 'y' &&
          (candidate.anchor ||
            candidate.parts.some((part) => Math.abs(part.normal[axis]) > 1e-6)),
      );
      possible.push({
        candidate,
        target,
        key,
        delta,
        distance,
        axes,
        rank: candidate.anchor || candidate.parts.length === 2 ? 2 : 1,
      });
    }
  }
  if (!possible.length) return null;
  possible.sort(
    (a, b) =>
      b.rank - a.rank || a.distance - b.distance || a.key.localeCompare(b.key),
  );
  const active = possible.find((p) => p.key === previous?.key);
  // Keep the current relationship until release. Upgrade a line to a corner or
  // edge+center only on that target and only if it includes the held constraint.
  const selected = active
    ? possible.find(
        (p) =>
          p.target.key === active.target.key &&
          p.rank > active.rank &&
          active.candidate.parts.every((part) =>
            p.candidate.parts.some((c) => c.id === part.id),
          ),
      ) || active
    : possible[0];
  const position = {
    ...raw,
    x: raw.x + selected.delta.x,
    z: raw.z + selected.delta.z,
  };
  return {
    transform: { ...proposed, position },
    claimedAxes: selected.axes,
    guidance: guidanceFor(
      selected.candidate,
      position,
      selected.target,
      selected.key,
      selected.axes,
    ),
  };
}
