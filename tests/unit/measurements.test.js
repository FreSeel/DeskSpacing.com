import { expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {
  formatMeasurement,
  formatMeasurementText,
  fromInches,
  toInches,
} from '../../src/measurements/units.js';
import {
  createMeasurementPreference,
  measurementPreferenceKey,
} from '../../src/measurements/preference.js';
import { createObjectFactory } from '../../src/models/objectFactory.js';
import { createRecord } from '../../src/catalog/configuration.js';
import { createObjectStore } from '../../src/state/objectStore.js';
import { objectToRecord } from '../../src/sharing/sceneRecords.js';
import { decodeSetup, encodeSetup } from '../../src/sharing/legacyCodec.js';

it('converts inches and centimeters exactly at the boundary and formats only for display', () => {
  expect(fromInches(1, 'cm')).toBe(2.54);
  expect(toInches(2.54, 'cm')).toBe(1);
  expect(toInches(100, 'in')).toBe(100);
  const inches = toInches(100, 'cm');
  for (let i = 0; i < 1000; i++) {
    expect(formatMeasurement(inches, 'in')).toBe('39.37');
    expect(formatMeasurement(inches, 'cm')).toBe('100');
  }
  expect(inches).toBe(100 / 2.54);
  expect(Number(formatMeasurement(0.0001, 'in'))).toBeGreaterThan(0);
  expect(formatMeasurementText('31.5" display · Size (inches)', 'cm')).toBe(
    '80.01 cm display · Size (cm)',
  );
});

function hostWithStorage(saved) {
  const listeners = new Map();
  return {
    localStorage: { getItem: vi.fn(() => saved), setItem: vi.fn() },
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: (name) => listeners.delete(name),
    dispatchStorage(event) {
      listeners.get('storage')?.(event);
    },
  };
}

it('defaults to inches, restores preferences, synchronizes storage and cleans up', () => {
  for (const saved of [null, 'invalid', 'in', 'cm']) {
    const host = hostWithStorage(saved);
    const preference = createMeasurementPreference(host);
    expect(preference.unit).toBe(saved === 'cm' ? 'cm' : 'in');
    const update = vi.fn();
    const unsubscribe = preference.subscribe(update);
    preference.setUnit('cm');
    expect(host.localStorage.setItem).toHaveBeenLastCalledWith(
      measurementPreferenceKey,
      'cm',
    );
    host.dispatchStorage({
      key: measurementPreferenceKey,
      newValue: 'in',
      storageArea: {},
    });
    expect(preference.unit).toBe('cm');
    host.dispatchStorage({
      key: null,
      newValue: null,
      storageArea: host.localStorage,
    });
    expect(preference.unit).toBe('in');
    unsubscribe();
    update.mockClear();
    preference.setUnit('cm');
    expect(update).not.toHaveBeenCalled();
    preference.dispose();
    host.dispatchStorage({
      key: measurementPreferenceKey,
      newValue: 'in',
      storageArea: host.localStorage,
    });
    expect(preference.unit).toBe('cm');
  }
});

it('remains usable when storage reads and writes fail', () => {
  const host = hostWithStorage(null);
  Object.defineProperty(host, 'localStorage', {
    get() {
      throw new Error('Storage blocked');
    },
  });
  const preference = createMeasurementPreference(host);
  expect(preference.unit).toBe('in');
  preference.setUnit('cm');
  expect(preference.unit).toBe('cm');
  preference.dispose();
});

it('maps a 30 × 20 × 10 cm box and a 10 cm radius sphere to real geometry and legacy records', async () => {
  const factory = createObjectFactory({ THREE });
  const state = createObjectStore({
    scene: new THREE.Scene(),
    disposeObject: factory.dispose,
  });
  for (const [product, centimeters] of [
    ['referenceBox', [30, 20, 10]],
    ['referenceSphere', [10]],
  ]) {
    const dimensions = centimeters.map((value) => toInches(value, 'cm'));
    if (product === 'referenceSphere') dimensions.push(-1, -1);
    const record = createRecord(product, { dimensions });
    const object = state.add(await factory.create(record), record);
    const size = new THREE.Box3()
      .setFromObject(object)
      .getSize(new THREE.Vector3())
      .toArray();
    const expected = product === 'referenceBox' ? centimeters : [20, 20, 20];
    size.forEach((value, axis) =>
      expect(fromInches(value, 'cm')).toBeCloseTo(expected[axis], 4),
    );
    const before = objectToRecord(object);
    expect(decodeSetup(encodeSetup([before]))).toEqual([before]);
    for (const unit of ['cm', 'in', 'cm']) {
      const labels = size.map((value) => formatMeasurement(value, unit));
      if (unit === 'cm') expect(labels).toEqual(expected.map(String));
      expect(objectToRecord(object)).toEqual(before);
    }
  }
  state.clear();
  factory.disposeAll();
});
