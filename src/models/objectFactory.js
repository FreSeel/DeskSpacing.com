import { textures } from '../catalog/products.js';
import { createModelLoader } from './modelLoader.js';
import { disposeResources } from './resources.js';

export function createObjectFactory({ THREE }) {
  const models = createModelLoader({ THREE });
  const textureLoader = new THREE.TextureLoader();
  const ownedResources = new WeakMap();
  async function create(record) {
    if (!record.dimensions) {
      const { object, resourceRoot } = await models.load(record.product);
      // Keep all loaded resources owned, including the unused historical roots.
      // Each load is independent. Do not cache parsed models without sharing ownership.
      ownedResources.set(object, resourceRoot);
      return object;
    }
    const geometry = record.type.includes('Sphere')
      ? new THREE.OctahedronBufferGeometry(record.dimensions[0], 5)
      : new THREE.BoxBufferGeometry(...record.dimensions);
    let texture;
    try {
      if (record.texture !== 'null') {
        texture = await new Promise((resolve, reject) => {
          textureLoader.load(textures[record.texture], resolve, undefined, () =>
            reject(new Error(`Could not load texture: ${record.texture}`)),
          );
        });
      }
    } catch (error) {
      geometry.dispose();
      throw error;
    }
    const material = new THREE.MeshLambertMaterial(
      texture ? { map: texture } : { color: 0x202020 },
    );
    material.name = record.texture;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const object = new THREE.Group();
    object.add(mesh);
    return object;
  }
  function dispose(object) {
    const resourceRoot = ownedResources.get(object);
    // Adding the first root to the live scene detaches it from the glTF scene.
    if (resourceRoot) {
      resourceRoot.add(object);
      disposeResources(resourceRoot);
      resourceRoot.remove(object);
      ownedResources.delete(object);
    } else {
      disposeResources(object);
    }
  }
  return { create, dispose };
}
