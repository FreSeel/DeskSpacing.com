import { decodeSetup, encodeSetup } from './legacyCodec.js';
import { objectToRecord } from './sceneRecords.js';
import { createShareUrl, readSetupParameter } from './shareUrl.js';

export function createSharing({ state, actions, getLocation }) {
  return {
    snapshot: () => state.objects.map(objectToRecord),
    createLink() {
      return createShareUrl(encodeSetup(this.snapshot()), getLocation());
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
