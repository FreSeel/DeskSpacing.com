import { textures } from '../catalog/products.js';
import { createModelLoader } from './modelLoader.js';
import { disposeResources } from './resources.js';
import { legacyColor } from '../scene/appearance.js';

export function createObjectFactory({ THREE, modelOptions }) {
  const models = createModelLoader(modelOptions);
  const textureLoader = new THREE.TextureLoader();
  const ownedResources = new WeakMap();
  const released = new WeakSet();
  let disposed = false;
  async function create(record) {
    if (disposed) throw new Error('Object factory has been disposed.');
    if (!record.dimensions) {
      const { object, release } = await models.load(record.product);
      ownedResources.set(object, release);
      return object;
    }
    const geometry = record.type.includes('Sphere')
      ? // r116 subdivided edges 2^detail times; modern detail means detail + 1.
        new THREE.OctahedronGeometry(record.dimensions[0], 31)
      : new THREE.BoxGeometry(...record.dimensions);
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
    return object;
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
    dispose,
    disposeAll() {
      disposed = true;
      models.dispose();
    },
  };
}
