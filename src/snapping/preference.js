import {
  defaultSnapping,
  normalizeSnapping,
  validSpacing,
} from './configuration.js';

export const snappingPreferenceKey = 'deskspacing.snapping';

export function createSnappingPreference(host) {
  let configuration = defaultSnapping;
  const subscribers = new Set();
  function read(value) {
    try {
      return normalizeSnapping(JSON.parse(value));
    } catch {
      return defaultSnapping;
    }
  }
  try {
    configuration = read(host.localStorage.getItem(snappingPreferenceKey));
  } catch {
    // Storage can be unavailable; retain usable in-memory preferences.
  }
  function apply(value, persist = false) {
    configuration = normalizeSnapping(value);
    if (persist) {
      try {
        host.localStorage.setItem(
          snappingPreferenceKey,
          JSON.stringify(configuration),
        );
      } catch {
        // The current session still works when storage is blocked or full.
      }
    }
    subscribers.forEach((update) => update(configuration));
  }
  function storage(event) {
    if (event.key !== snappingPreferenceKey && event.key !== null) return;
    try {
      if (event.storageArea !== host.localStorage) return;
    } catch {
      return;
    }
    apply(read(event.newValue));
  }
  host.addEventListener('storage', storage);
  return {
    get configuration() {
      return configuration;
    },
    setEnabled(enabled) {
      apply({ ...configuration, enabled }, true);
    },
    setSpacing(spacing) {
      if (!validSpacing(spacing)) return false;
      apply(
        { ...configuration, grid: { ...configuration.grid, spacing } },
        true,
      );
      return true;
    },
    subscribe(update) {
      subscribers.add(update);
      update(configuration);
      return () => subscribers.delete(update);
    },
    dispose() {
      host.removeEventListener('storage', storage);
      subscribers.clear();
    },
  };
}
