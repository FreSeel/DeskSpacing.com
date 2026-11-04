import { importedType } from '../projects/projectRecords.js';
import { decodeSetup, encodeSetup } from './legacyCodec.js';
import { objectToRecord } from './sceneRecords.js';
import { createShareUrl, readSetupParameter } from './shareUrl.js';

export function createSharing({ state, actions, getLocation }) {
  return {
    snapshot: () => state.objects.map(objectToRecord),
    createLink() {
      const records = this.snapshot();
      if (records.some(({ type }) => type === importedType))
        throw new Error(
          'Share links support catalog objects only. Imported models can be kept in a local project.',
        );
      return createShareUrl(encodeSetup(records), getLocation());
    },
    restore(text) {
      return actions.restore(decodeSetup(text));
    },
    async loadFromUrl() {
      const text = readSetupParameter(getLocation());
      if (text === null) return actions.initialize();
      return this.restore(text);
    },
  };
}
