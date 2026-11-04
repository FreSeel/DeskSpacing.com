import { importedType } from '../projects/projectRecords.js';
import { objectToRecord } from '../sharing/sceneRecords.js';
import { localModelSource, remoteModelSource } from './importSource.js';

export function createModelImports({
  state,
  actions,
  factory,
  ready = Promise.resolve(),
}) {
  const pending = new Map();
  const statuses = new WeakMap();
  let latest;
  let latestStatus;
  let disposed = false;
  const unsubscribe = state.subscribeInvalidation(() => {
    for (const controller of pending.values()) controller.abort();
  });

  function start(load) {
    if (disposed) throw new Error('Model imports are unavailable.');
    const controller = new globalThis.AbortController();
    const { signal } = controller;
    const status = { state: 'loading' };
    // A task owns its status. The service only retains active jobs and the most
    // recent handle, so completed imports do not accumulate in memory.
    const task = Object.freeze({
      result: Promise.resolve().then(async () => {
        try {
          await ready;
          signal.throwIfAborted();
          const object = await load(signal);
          if (!object) {
            status.state = 'cancelled';
            return null;
          }
          status.state = 'success';
          status.objectId = object.userData.objectId;
          return object;
        } catch (error) {
          if (signal.aborted) {
            status.state = 'cancelled';
            return null;
          }
          status.state = 'failure';
          status.message = error.message;
          throw error;
        } finally {
          pending.delete(task);
          if (latest === task) latest = undefined;
        }
      }),
    });
    statuses.set(task, status);
    pending.set(task, controller);
    latest = task;
    latestStatus = status;
    return task;
  }

  function find(objectId) {
    return state.objects.find(
      (object) =>
        object.userData.objectId === objectId &&
        object.userData.type === importedType,
    );
  }

  function newRecord(source, metadata) {
    return {
      type: importedType,
      objectId: globalThis.crypto.randomUUID(),
      asset: {
        ...source,
        id: globalThis.crypto.randomUUID(),
        attribution: metadata.attribution,
        license: metadata.license,
      },
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    };
  }

  return {
    importModelFromFile: (file, metadata = {}) =>
      start((signal) =>
        actions.addImported(newRecord(localModelSource(file), metadata), {
          blob: file,
          signal,
          place: true,
        }),
      ),
    importModelFromUrl: (url, metadata = {}) =>
      start((signal) =>
        actions.addImported(newRecord(remoteModelSource(url), metadata), {
          signal,
          place: true,
        }),
      ),
    cancelImport(task = latest) {
      const controller = pending.get(task);
      if (!controller || controller.signal.aborted) return false;
      controller.abort();
      return true;
    },
    getImportStatus(task) {
      return {
        ...((task ? statuses.get(task) : latestStatus) || { state: 'idle' }),
      };
    },
    removeImportedObject(objectId) {
      const object = find(objectId);
      return object ? actions.remove(object) : false;
    },
    duplicateImportedObject(objectId) {
      const object = find(objectId);
      const record = object && {
        ...objectToRecord(object),
        objectId: globalThis.crypto.randomUUID(),
      };
      return start((signal) => {
        if (!object || !state.has(object) || object.userData.missingAsset)
          throw new Error('Choose an available imported model to duplicate.');
        return actions.addImported(record, {
          blob: factory.importedFile(object),
          signal,
          duplicate: object,
        });
      });
    },
    getMissingAssets() {
      return state.objects
        .filter((object) => object.userData.missingAsset)
        .map((object) => ({
          ...objectToRecord(object),
          message: object.userData.missingAsset,
        }));
    },
    retryMissingAsset(objectId, file) {
      const target = find(objectId);
      return start((signal) => {
        if (!target?.userData.missingAsset || !state.has(target))
          throw new Error('This imported model is no longer missing.');
        const record = objectToRecord(target);
        if (file) {
          if (record.asset.kind !== 'local')
            throw new Error(
              'Only a missing local model can be relinked to a file.',
            );
          const source = localModelSource(file);
          record.asset = {
            ...record.asset,
            ...source,
            id: globalThis.crypto.randomUUID(),
          };
        }
        return actions.addImported(record, {
          blob: file || factory.importedFile(target),
          signal,
          target,
        });
      });
    },
    dispose() {
      disposed = true;
      unsubscribe();
      for (const controller of pending.values()) controller.abort();
    },
  };
}
