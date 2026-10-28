import { Vector3 } from 'three';
import { createObjectDimensions } from '../measurements/objectDimensions.js';
import { convexHull } from './footprint.js';

export function visibleInHierarchy(object) {
  for (let node = object; node; node = node.parent)
    if (!node.visible) return false;
  return true;
}

export function eligibleTarget(object, movingObjects) {
  if (movingObjects.has(object) || !visibleInHierarchy(object)) return false;
  const type = object.userData.type || '';
  // Desks are inspectable, locked support objects. Floors and other NoSelect
  // roots are not interactive alignment targets. Only store members enter here.
  return !type.includes('NoSelect') || type.includes('Desk');
}

export function createObjectFootprints() {
  const readers = new WeakMap();
  function read(object) {
    if (!visibleInHierarchy(object)) return null;
    if (!readers.has(object))
      readers.set(
        object,
        createObjectDimensions({
          includeMesh: (mesh) =>
            (Array.isArray(mesh.material)
              ? mesh.material
              : [mesh.material]
            ).every((material) => material && material.visible !== false),
        }),
      );
    const measurement = readers.get(object).read(object);
    if (!measurement) return null;
    const { bounds, matrix } = measurement;
    const corners = [];
    for (let index = 0; index < 8; index++)
      corners.push(
        new Vector3(
          index & 1 ? bounds.max.x : bounds.min.x,
          index & 2 ? bounds.max.y : bounds.min.y,
          index & 4 ? bounds.max.z : bounds.min.z,
        ).applyMatrix4(matrix),
      );
    const minY = Math.min(...corners.map((p) => p.y));
    const maxY = Math.max(...corners.map((p) => p.y));
    const points = convexHull(corners).map(({ x, z }) => ({ x, y: minY, z }));
    if (points.length < 3) return null;
    const center = bounds.getCenter(new Vector3()).applyMatrix4(matrix);
    center.y = minY;
    return {
      key: `${object.name}:${object.uuid}`,
      points,
      center: { x: center.x, y: center.y, z: center.z },
      origin: object.getWorldPosition(new Vector3()),
      minY,
      maxY,
      support: (object.userData.type || '').includes('Desk'),
    };
  }
  return {
    read,
    prepare(object, objects, movingObjects = new Set([object])) {
      const moving = read(object);
      const targets = objects
        .filter((target) => eligibleTarget(target, movingObjects))
        .map(read)
        .filter(Boolean)
        .sort((a, b) => a.key.localeCompare(b.key));
      return { moving, targets };
    },
  };
}
