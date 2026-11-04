import { Group } from 'three';
import { createImportLoader } from './importLoader.js';

export function createImportRegistry({ load = createImportLoader() } = {}) {
  const entries = new Map();

  function acquire(source, blob, signal) {
    signal.throwIfAborted();
    const key = source.kind === 'remote' ? source.url : blob;
    let entry = entries.get(key);
    if (!entry) {
      const controller = new globalThis.AbortController();
      entry = { controller, users: 0, asset: null };
      const current = entry;
      current.ready = Promise.resolve()
        .then(() => load(source, blob, controller.signal))
        .then((asset) => {
          if (!current.users) {
            asset.dispose();
            controller.signal.throwIfAborted();
          }
          current.asset = asset;
          return asset;
        });
      entries.set(key, current);
    }
    entry.users++;
    let released = false;
    function release() {
      if (released) return;
      released = true;
      if (--entry.users) return;
      entries.delete(key);
      if (entry.asset) entry.asset.dispose();
      else entry.controller.abort();
    }
    return new Promise((resolve, reject) => {
      function cancel() {
        release();
        reject(signal.reason);
      }
      signal.addEventListener('abort', cancel, { once: true });
      entry.ready.then(
        (asset) => {
          signal.removeEventListener('abort', cancel);
          if (released) return;
          try {
            const normalized = new Group();
            normalized.position.fromArray(asset.offset);
            normalized.scale.setScalar(asset.scale);
            // Static imported geometry, textures and materials are immutable.
            normalized.add(asset.root.clone());
            const object = new Group();
            object.add(normalized);
            resolve({ object, release });
          } catch (error) {
            release();
            reject(error);
          }
        },
        (error) => {
          signal.removeEventListener('abort', cancel);
          release();
          reject(error);
        },
      );
    });
  }
  return { acquire };
}
