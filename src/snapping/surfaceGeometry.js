import { Vector3 } from 'three';
import { supportKind } from '../catalog/placement.js';
import { createObjectDimensions } from '../measurements/objectDimensions.js';
import { convexHull, cross, subtract } from './footprint.js';
import { visibleInHierarchy } from './objectFootprints.js';

const epsilon = 1e-3; // inches; lowest-contact vertex tolerance
const planeTolerance = 1e-2; // inches; authored tabletop tessellation noise

export function createSurfaceGeometry() {
  const readers = new WeakMap();
  function read(object) {
    if (!visibleInHierarchy(object)) return null;
    if (!readers.has(object))
      readers.set(
        object,
        createObjectDimensions({
          collectGeometry: true,
          includeMesh(mesh) {
            for (let node = mesh; node; node = node.parent)
              if (node.userData.snappingIgnore || node.isHelper) return false;
            return (
              Array.isArray(mesh.material) ? mesh.material : [mesh.material]
            ).every(
              (material) =>
                material &&
                material.visible !== false &&
                material.opacity !== 0,
            );
          },
        }),
      );
    const measurement = readers.get(object).read(object);
    if (!measurement) return null;
    return measurement.geometry.map(({ vertices, indices }) => ({
      vertices: vertices.map((vertex) =>
        vertex.clone().applyMatrix4(measurement.matrix),
      ),
      indices,
    }));
  }
  function moving(object) {
    const geometry = read(object);
    if (!geometry) return null;
    const physical = geometry.flatMap(({ vertices, indices }) =>
      [...new Set(indices.flat())].map((index) => vertices[index]),
    );
    let minY = Infinity;
    for (const point of physical) minY = Math.min(minY, point.y);
    // Use actual lowest vertices, not the pivot or corners of a rotated AABB.
    const contact = [];
    for (const point of physical)
      if (point.y - minY <= epsilon) contact.push(point);
    if (!contact.length) return null;
    let minX = Infinity,
      maxX = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity;
    for (const p of contact) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    }
    return {
      origin: object.getWorldPosition(new Vector3()),
      minY,
      center: { x: (minX + maxX) / 2, y: minY, z: (minZ + maxZ) / 2 },
      footprint: convexHull(contact).map(({ x, z }) => ({ x, y: minY, z })),
    };
  }
  function target(object) {
    const kind = supportKind(object.userData.objectName);
    if (!kind) return null;
    const geometry = read(object);
    if (!geometry) return null;
    const planes = [];
    for (const { vertices, indices } of geometry) {
      for (const triangle of indices) {
        const points = triangle.map((i) => vertices[i]);
        const [a, b, c] = points;
        if (Math.max(a.y, b.y, c.y) - Math.min(a.y, b.y, c.y) > planeTolerance)
          continue;
        const area = Math.abs(cross(subtract(b, a), subtract(c, a))) / 2;
        if (area < 1e-8) continue;
        const height = (a.y + b.y + c.y) / 3;
        let plane = planes.find(
          (candidate) => Math.abs(candidate.height - height) <= planeTolerance,
        );
        if (!plane) {
          plane = { height, area: 0, triangles: [] };
          planes.push(plane);
        }
        plane.area += area;
        plane.triangles.push(points);
      }
    }
    // Controlled fallback for known desks/floors: the highest broad horizontal
    // plane. Small trim/leg caps are not tabletops. Keep triangles, including
    // concavities and holes; a desk's bounding rectangle is not a support area.
    const levels = planes;
    const largest = Math.max(0, ...levels.map((plane) => plane.area));
    const plane = levels
      .filter((p) => p.area >= largest * 0.25)
      .sort((a, b) => b.height - a.height)[0];
    if (!plane) return null;
    let minX = Infinity,
      maxX = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity;
    for (const triangle of plane.triangles)
      for (const p of triangle) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minZ = Math.min(minZ, p.z);
        maxZ = Math.max(maxZ, p.z);
      }
    return {
      ...plane,
      kind,
      key: object.uuid,
      bounds: { minX, maxX, minZ, maxZ },
    };
  }
  return {
    prepare(object, objects, movingObjects = new Set([object])) {
      return {
        moving: moving(object),
        targets: objects
          .filter(
            (other) => !movingObjects.has(other) && visibleInHierarchy(other),
          )
          .map(target)
          .filter(Boolean)
          .sort((a, b) => a.key.localeCompare(b.key)),
      };
    },
  };
}
