import { objectToRecord } from '../sharing/sceneRecords.js';
import { decodeSetup } from '../sharing/legacyCodec.js';
import { importedType, validateProjectRecords } from './projectRecords.js';
import { createProjectStorage } from './projectStorage.js';

function validateId(id) {
  if (typeof id !== 'string' || !id.trim() || id.length > 200)
    throw new Error('Choose a project name of 1 to 200 characters.');
}

export function createLocalProjects({
  state,
  actions,
  factory,
  modelImports,
  ready = Promise.resolve(),
  storage = createProjectStorage(),
  onMissingAssets = () => {},
}) {
  let disposed = false;
  let opening;
  const unsubscribe = state.subscribeInvalidation(() => opening?.abort());

  function checkAvailable() {
    if (disposed) throw new Error('Local projects are unavailable.');
  }

  return {
    async save(id) {
      await ready;
      checkAvailable();
      validateId(id);
      const records = [];
      const files = new Map();
      for (const object of state.objects) {
        const record = objectToRecord(object);
        records.push(record);
        if (record.type === importedType && record.asset.kind === 'local') {
          const blob = factory.importedFile(object);
          if (blob) files.set(record.asset.id, blob);
        }
      }
      validateProjectRecords(records);
      await storage.write(id, { version: 1, records, files });
    },
    async open(id) {
      await ready;
      checkAvailable();
      validateId(id);
      const generation = state.invalidate();
      const controller = new globalThis.AbortController();
      const { signal } = controller;
      opening = controller;
      try {
        const project = await storage.read(id).catch((error) => {
          if (!signal.aborted) throw error;
        });
        if (signal.aborted) return { restored: false };
        if (project === undefined)
          throw new Error('This local project could not be found.');
        // Allow a legacy setup string if a caller seeded storage with one.
        const records =
          typeof project === 'string' ? decodeSetup(project) : project?.records;
        const files = project?.files || new Map();
        if (
          typeof project !== 'string' &&
          (project?.version !== 1 || !(files instanceof Map))
        )
          throw new Error('This local project uses an unsupported format.');
        const restored = await actions.restoreProject(records, {
          files,
          signal,
          generation,
        });
        if (!restored) return { restored };
        const missingAssets = modelImports.getMissingAssets();
        if (missingAssets.length) onMissingAssets(missingAssets);
        return { restored, missingAssets };
      } finally {
        if (opening === controller) opening = null;
      }
    },
    async list() {
      checkAvailable();
      return storage.list();
    },
    async delete(id) {
      checkAvailable();
      validateId(id);
      await storage.delete(id);
    },
    dispose() {
      disposed = true;
      opening?.abort();
      unsubscribe();
    },
  };
}
