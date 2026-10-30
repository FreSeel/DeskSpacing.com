import { createObjectDimensions } from './objectDimensions.js';

// The same authored geometry box used by dimension/footprint readers, projected
// through the complete world matrix. This is a conservative box measurement,
// not a closest-surface query or a collision test.
export function createProjectedBounds() {
  const readers = new WeakMap();
  function includeMesh(mesh) {
    for (let node = mesh; node; node = node.parent)
      if (!node.visible || node.isHelper || node.userData.snappingIgnore)
        return false;
    return (
      Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    ).every(
      (material) =>
        material && material.visible !== false && material.opacity !== 0,
    );
  }
  return {
    read(object, axis, direction) {
      if (!object) return null;
      for (let node = object; node; node = node.parent)
        if (!node.visible) return null;
      if (!readers.has(object))
        readers.set(object, createObjectDimensions({ includeMesh }));
      const measurement = readers.get(object).read(object);
      if (!measurement) return null;
      const { bounds, matrix } = measurement;
      const row = { x: 0, y: 1, z: 2 }[axis];
      if (row === undefined || ![1, -1].includes(direction)) return null;
      const e = matrix.elements;
      let nearOffset = Infinity;
      let farOffset = -Infinity;
      for (let index = 0; index < 8; index++) {
        const x = index & 1 ? bounds.max.x : bounds.min.x;
        const y = index & 2 ? bounds.max.y : bounds.min.y;
        const z = index & 4 ? bounds.max.z : bounds.min.z;
        // Keep extents relative to the origin. Computing a placement from
        // world min minus world origin would accumulate cancellation error.
        const offset =
          direction * (e[row] * x + e[row + 4] * y + e[row + 8] * z);
        nearOffset = Math.min(nearOffset, offset);
        farOffset = Math.max(farOffset, offset);
      }
      const origin = direction * e[row + 12];
      const min = origin + nearOffset;
      const max = origin + farOffset;
      if (![origin, min, max, nearOffset, farOffset].every(Number.isFinite))
        return null;
      // Fresh plain values; the underlying dimension reader reuses its Box3.
      return { min, max, origin, nearOffset, farOffset };
    },
  };
}
