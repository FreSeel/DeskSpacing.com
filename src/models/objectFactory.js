import { textures } from '../catalog/products.js';
import { createModelLoader } from './modelLoader.js';
import { disposeResources } from './resources.js';
import { legacyColor } from '../scene/appearance.js';
import {
  createPrimitiveGeometry,
  readPrimitiveDimensions,
} from './primitiveGeometry.js';

export function createObjectFactory({ THREE, modelOptions }) {
  const models = createModelLoader(modelOptions);
  const textureLoader = new THREE.TextureLoader();
  const ownedResources = new WeakMap();
  const primitiveMeshes = new WeakMap();
  const released = new WeakSet();
  let disposed = false;
  async function create(record) {
    if (disposed) throw new Error('Object factory has been disposed.');
    if (!record.dimensions) {
      const { object, release } = await models.load(record.product);
      ownedResources.set(object, release);
      return object;
    }
    const geometry = createPrimitiveGeometry(
      THREE,
      record.type,
      record.dimensions,
    );
    let texture;
    try {
      if (record.texture !== 'null') {
        texture = await new Promise((resolve, reject) => {
          textureLoader.load(textures[record.texture], resolve, undefined, () =>
            reject(new Error(`Could not load texture: ${record.texture}`)),
          );
        });
      }
      if (disposed) throw new Error('Object factory has been disposed.');
    } catch (error) {
      geometry.dispose();
      texture?.dispose();
      throw error;
    }
    const material = new THREE.MeshLambertMaterial(
      texture ? { map: texture } : { color: legacyColor(THREE, 0x202020) },
    );
    material.name = record.texture;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const object = new THREE.Group();
    object.add(mesh);
    primitiveMeshes.set(object, mesh);
    return object;
  }
  function primitiveDimensions(object) {
    const mesh = primitiveMeshes.get(object);
    if (
      disposed ||
      released.has(object) ||
      !mesh ||
      object.children.length !== 1 ||
      object.children[0] !== mesh
    )
      return null;
    return readPrimitiveDimensions(object);
  }
  // Actions validate the complete proposed record before entering this method.
  // Allocate before swapping, so an allocation failure retains the old geometry.
  function preparePrimitiveResize(object, dimensions) {
    if (!primitiveDimensions(object))
      throw new Error('This object has no owned primitive geometry to resize.');
    const mesh = primitiveMeshes.get(object);
    const geometry = createPrimitiveGeometry(
      THREE,
      object.userData.type,
      dimensions,
    );
    let finished = false;
    return {
      commit() {
        if (finished) return;
        finished = true;
        const previous = mesh.geometry;
        mesh.geometry = geometry;
        previous.dispose();
      },
      cancel() {
        if (finished) return;
        finished = true;
        geometry.dispose();
      },
    };
  }
  function resizePrimitive(object, dimensions) {
    preparePrimitiveResize(object, dimensions).commit();
  }
  function dispose(object) {
    if (released.has(object)) return;
    released.add(object);
    const release = ownedResources.get(object);
    if (release) {
      release();
      ownedResources.delete(object);
    } else {
      disposeResources(object);
    }
  }
  return {
    create,
    primitiveDimensions,
    resizePrimitive,
    preparePrimitiveResize,
    dispose,
    disposeAll() {
      disposed = true;
      models.dispose();
    },
  };
}
