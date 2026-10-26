import { Box3, Matrix4, Vector3 } from 'three';
import { products } from '../catalog/products.js';

export const dimensionAxes = [
  { axis: 'x', label: 'W', name: 'Width' },
  { axis: 'z', label: 'D', name: 'Depth' },
  { axis: 'y', label: 'H', name: 'Height' },
];

// Only the selected object's derived bounds are cached. This is not scene state:
// geometry versions and descendant transforms invalidate the cache automatically.
export function createObjectDimensions() {
  let previous = [];
  const bounds = new Box3();
  const vertex = new Vector3();
  const instance = new Matrix4();
  function read(object) {
    object.updateWorldMatrix(true, true);
    // Catalog rotation establishes the authored W/D frame (many legacy models
    // were exported sideways). User rotation is deliberately excluded.
    const authored = new Matrix4().makeRotationY(
      products[object.userData.objectName]?.rotationY || 0,
    );
    const signature = [object, ...authored.elements];
    const meshes = [];
    function visit(node, matrix) {
      signature.push(node, node.visible);
      if (!node.visible) return;
      signature.push(...matrix.elements);
      if (node.isMesh && node.geometry.attributes.position) {
        const geometry = node.geometry;
        const position = geometry.attributes.position;
        signature.push(
          geometry,
          position,
          position.version,
          position.data?.version,
        );
        for (const attribute of geometry.morphAttributes.position || [])
          signature.push(attribute, attribute.version);
        signature.push(...(node.morphTargetInfluences || []));
        if (node.isSkinnedMesh) {
          for (const bone of node.skeleton.bones)
            signature.push(...bone.matrixWorld.elements);
        }
        if (node.isInstancedMesh)
          signature.push(
            node.count,
            node.instanceMatrix,
            node.instanceMatrix.version,
          );
        meshes.push({ node, matrix });
      }
      for (const child of node.children)
        visit(child, new Matrix4().multiplyMatrices(matrix, child.matrix));
    }
    // Exclude the selected root's placement/rotation. Descendant authored
    // rotations/scales still contribute to its physical, local-axis extents.
    visit(object, authored);
    if (
      signature.length !== previous.length ||
      signature.some((value, i) => value !== previous[i])
    ) {
      previous = signature;
      bounds.makeEmpty();
      for (const { node, matrix } of meshes) {
        const count = node.isInstancedMesh ? node.count : 1;
        for (let i = 0; i < count; i++) {
          const transform = matrix.clone();
          if (node.isInstancedMesh) {
            node.getMatrixAt(i, instance);
            transform.multiply(instance);
          }
          // Transform actual vertices, not child AABBs: rotating a child AABB
          // would overestimate the bounds of curved or diagonal geometry.
          for (
            let index = 0;
            index < node.geometry.attributes.position.count;
            index++
          ) {
            node.getVertexPosition(index, vertex).applyMatrix4(transform);
            bounds.expandByPoint(vertex);
          }
        }
      }
    }
    if (
      bounds.isEmpty() ||
      ![...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite)
    )
      return null;
    const size = bounds.getSize(new Vector3());
    const matrix = new Matrix4().multiplyMatrices(
      object.matrixWorld,
      authored.clone().invert(),
    );
    const dimensions = {};
    for (const { axis } of dimensionAxes) {
      const direction = new Vector3();
      direction[axis] = size[axis];
      const origin = new Vector3().applyMatrix4(matrix);
      dimensions[axis] = direction.applyMatrix4(matrix).distanceTo(origin);
    }
    return { bounds, dimensions, matrix };
  }
  return {
    read,
    clear() {
      previous = [];
      bounds.makeEmpty();
    },
  };
}
