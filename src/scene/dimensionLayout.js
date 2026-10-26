import { Vector3 } from 'three';
import { dimensionAxes } from '../measurements/objectDimensions.js';

const dot = (point, normal) => point.x * normal.x + point.y * normal.y;
const overlaps = (a, b) =>
  Math.abs(a.x - b.x) < (a.width + b.width) / 2 + 8 &&
  Math.abs(a.y - b.y) < (a.height + b.height) / 2 + 8;

// Project local dimension edges through the same camera as the object. Offsets
// are in CSS pixels for legibility; measured values never use screen distances.
export function layoutDimensions({
  bounds,
  matrix,
  camera,
  width,
  height,
  labelSizes,
}) {
  const corners = [];
  for (let index = 0; index < 8; index++) {
    const point = new Vector3(
      index & 1 ? bounds.max.x : bounds.min.x,
      index & 2 ? bounds.max.y : bounds.min.y,
      index & 4 ? bounds.max.z : bounds.min.z,
    )
      .applyMatrix4(matrix)
      .project(camera);
    corners.push({
      x: ((point.x + 1) * width) / 2,
      y: ((1 - point.y) * height) / 2,
      z: point.z,
    });
  }
  // Crossing the near plane gives misleading projected edges. Hide until the
  // object is back in view, rather than pinning labels to unrelated screen spots.
  if (
    corners.some(
      (point) =>
        !Number.isFinite(point.x + point.y) || point.z < -1 || point.z > 1,
    )
  )
    return [];
  const center = corners.reduce(
    (sum, point) => ({ x: sum.x + point.x / 8, y: sum.y + point.y / 8 }),
    { x: 0, y: 0 },
  );
  const placed = [];
  for (const { axis } of dimensionAxes) {
    const bit = { x: 1, y: 2, z: 4 }[axis];
    const size = labelSizes[axis];
    const candidates = [];
    for (let index = 0; index < 8; index++) {
      if (index & bit) continue;
      const a = corners[index];
      const b = corners[index | bit];
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      // An edge-on dimension still has a real size. Use a radial leader when
      // its projected span collapses, keeping the label readable while orbiting.
      const radial = Math.hypot(midpoint.x - center.x, midpoint.y - center.y);
      let normal =
        length >= 2
          ? { x: -(b.y - a.y) / length, y: (b.x - a.x) / length }
          : radial > 0
            ? {
                x: (midpoint.x - center.x) / radial,
                y: (midpoint.y - center.y) / radial,
              }
            : { x: 0, y: -1 };
      if (
        dot({ x: midpoint.x - center.x, y: midpoint.y - center.y }, normal) < 0
      )
        normal = { x: -normal.x, y: -normal.y };
      const support = Math.max(...corners.map((point) => dot(point, normal)));
      const labelRadius =
        (Math.abs(normal.x) * size.width + Math.abs(normal.y) * size.height) /
        2;
      const gap = Math.max(
        22,
        support - dot(midpoint, normal) + labelRadius + 10,
      );
      for (let extra = 0; extra <= 96; extra += 24) {
        const distance = gap + extra;
        const offset = (point) => ({
          x: point.x + normal.x * distance,
          y: point.y + normal.y * distance,
        });
        const label = { ...offset(midpoint), ...size };
        if (
          label.x - size.width / 2 < 8 ||
          label.x + size.width / 2 > width - 8 ||
          label.y - size.height / 2 < 56 ||
          label.y + size.height / 2 > height - 76 ||
          placed.some((item) => overlaps(label, item.label))
        )
          continue;
        candidates.push({
          axis,
          a,
          b,
          start: offset(a),
          end: offset(b),
          normal,
          label,
          score: distance + 10 / Math.max(length, 1),
        });
        break;
      }
    }
    candidates.sort((a, b) => a.score - b.score);
    if (candidates.length) placed.push(candidates[0]);
  }
  return placed;
}
