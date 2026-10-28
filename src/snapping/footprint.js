// Plain X/Z geometry shared by the proxy adapter and the magnetic resolver.
export const dot = (a, b) => a.x * b.x + a.z * b.z;
export const subtract = (a, b) => ({ x: a.x - b.x, z: a.z - b.z });
export const cross = (a, b) => a.x * b.z - a.z * b.x;

export function convexHull(points) {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.z - b.z);
  const half = (list) => {
    const hull = [];
    for (const p of list) {
      while (
        hull.length > 1 &&
        cross(subtract(hull.at(-1), hull.at(-2)), subtract(p, hull.at(-1))) <=
          1e-9
      )
        hull.pop();
      hull.push(p);
    }
    return hull.slice(0, -1);
  };
  return [...half(sorted), ...half(sorted.reverse())];
}

export function edges(points) {
  return points
    .map((a, i) => {
      const b = points[(i + 1) % points.length];
      const length = Math.hypot(b.x - a.x, b.z - a.z);
      const tangent = { x: (b.x - a.x) / length, z: (b.z - a.z) / length };
      return { a, b, tangent, normal: { x: -tangent.z, z: tangent.x } };
    })
    .filter((edge) => Number.isFinite(edge.tangent.x + edge.tangent.z));
}

export function prepareFootprintProximity(left, right) {
  // Separating-axis rejection avoids treating overlapping world AABBs of
  // diagonal footprints as nearby geometry. Hulls are convex and tiny (4–6).
  const normals = [];
  for (const { normal } of [...edges(left), ...edges(right)]) {
    if (!normals.some((n) => Math.abs(cross(n, normal)) < 1e-5))
      normals.push(normal);
  }
  return normals.map((normal) => {
    const a = left.map((p) => dot(p, normal));
    const b = right.map((p) => dot(p, normal));
    return {
      normal,
      minMoving: Math.min(...a),
      maxMoving: Math.max(...a),
      minTarget: Math.min(...b),
      maxTarget: Math.max(...b),
    };
  });
}
