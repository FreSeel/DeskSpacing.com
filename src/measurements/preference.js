import { defaultUnit, normalizeUnit } from './units.js';

export const measurementPreferenceKey = 'deskspacing.unit';

// Match appearance preferences: localStorage, with an in-memory fallback.
export function createMeasurementPreference(host) {
  let unit = defaultUnit;
  const subscribers = new Set();
  try {
    unit = normalizeUnit(host.localStorage.getItem(measurementPreferenceKey));
  } catch {
    // Disabled storage should not disable the selector.
  }
  function apply(value) {
    const next = normalizeUnit(value);
    if (next === unit) return;
    unit = next;
    subscribers.forEach((update) => update(unit));
  }
  function storage(event) {
    if (event.key !== measurementPreferenceKey && event.key !== null) return;
    try {
      if (event.storageArea !== host.localStorage) return;
    } catch {
      return;
    }
    apply(event.newValue);
  }
  host.addEventListener('storage', storage);
  return {
    get unit() {
      return unit;
    },
    setUnit(value) {
      apply(value);
      try {
        host.localStorage.setItem(measurementPreferenceKey, unit);
      } catch {
        // Keep the current session usable when persistence is unavailable.
      }
    },
    subscribe(update) {
      subscribers.add(update);
      update(unit);
      return () => subscribers.delete(update);
    },
    dispose() {
      host.removeEventListener('storage', storage);
      subscribers.clear();
    },
  };
}
