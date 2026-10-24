import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { products } from '../catalog/products.js';
import { optimizedModels } from '../catalog/optimizedModels.js';
import { disposeResources, estimateResourceBytes } from './resources.js';

// Cache by URL, including in-flight requests. Active instances share immutable
// geometry/textures; their transforms, materials and skeletons are independent.
export function createModelLoader({
  loader = new GLTFLoader(),
  maxIdleBytes = 32 * 1024 * 1024,
} = {}) {
  loader.setMeshoptDecoder?.(MeshoptDecoder);
  const entries = new Map();
  let disposed = false;

  function evictIdle() {
    const idle = [...entries.values()].filter(
      (entry) => entry.root && entry.users === 0,
    );
    let bytes = idle.reduce((sum, entry) => sum + entry.bytes, 0);
    for (const entry of idle.sort((a, b) => a.lastUsed - b.lastUsed)) {
      if (!disposed && bytes <= maxIdleBytes) break;
      entries.delete(entry.path);
      disposeResources(entry.root);
      bytes -= entry.bytes;
    }
  }

  return {
    async load(product) {
      if (disposed) throw new Error('Model loader has been disposed.');
      const sourcePath = products[product]?.modelPath;
      const path = optimizedModels[sourcePath] || sourcePath;
      if (!path) throw new Error(`No model configured for ${product}`);
      let entry = entries.get(path);
      if (!entry) {
        entry = { path, users: 0, root: null, bytes: 0, lastUsed: 0 };
        entries.set(path, entry);
        entry.promise = new Promise((resolve, reject) =>
          loader.load(path, resolve, undefined, reject),
        )
          .then((gltf) => {
            if (disposed || !gltf.scene.children[0]) {
              disposeResources(gltf.scene);
              throw new Error(
                disposed
                  ? 'Model loader has been disposed.'
                  : `Model has no root: ${path}`,
              );
            }
            gltf.scene.traverse((child) => {
              if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                child.geometry.computeBoundingBox();
              }
            });
            entry.root = gltf.scene;
            entry.bytes = estimateResourceBytes(gltf.scene);
            return gltf.scene;
          })
          .catch((cause) => {
            entries.delete(path);
            throw new Error(`Could not load ${product}. Please try again.`, {
              cause,
            });
          });
      }
      entry.users++;
      try {
        const root = await entry.promise;
        if (disposed) throw new Error('Model loader has been disposed.');
        // Preserve the historical first-root transform convention and skeletons.
        const object = clone(root.children[0]);
        const materials = new Map();
        object.traverse((child) => {
          if (!child.material) return;
          const copy = (material) => {
            if (!materials.has(material))
              materials.set(material, material.clone());
            return materials.get(material);
          };
          child.material = Array.isArray(child.material)
            ? child.material.map(copy)
            : copy(child.material);
        });
        let released = false;
        return {
          object,
          release() {
            if (released) return;
            released = true;
            for (const material of materials.values()) material.dispose();
            const skeletons = new Set();
            object.traverse((child) => {
              if (child.skeleton) skeletons.add(child.skeleton);
            });
            for (const skeleton of skeletons) skeleton.dispose();
            entry.users--;
            entry.lastUsed = Date.now();
            evictIdle();
          },
        };
      } catch (error) {
        entry.users--;
        evictIdle();
        throw error;
      }
    },
    dispose() {
      disposed = true;
      evictIdle();
    },
  };
}
