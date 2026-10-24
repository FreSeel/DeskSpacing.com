import { products } from '../catalog/products.js';

export function createModelLoader({ THREE }) {
  const loader = new THREE.GLTFLoader();
  return {
    load(product) {
      const path = products[product]?.modelPath;
      if (!path)
        return Promise.reject(new Error(`No model configured for ${product}`));
      return new Promise((resolve, reject) => {
        loader.load(
          path,
          (gltf) => {
            // Preserve the historical first-root transform convention. Keeping the
            // entire scene changes authored origins for existing saved setups.
            const object = gltf.scene.children[0];
            if (!object) {
              reject(new Error(`Model has no root: ${path}`));
              return;
            }
            gltf.scene.traverse((child) => {
              if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
              }
            });
            resolve({ object, resourceRoot: gltf.scene });
          },
          undefined,
          (cause) =>
            reject(
              new Error(`Could not load ${product}. Please try again.`, {
                cause,
              }),
            ),
        );
      });
    },
  };
}
