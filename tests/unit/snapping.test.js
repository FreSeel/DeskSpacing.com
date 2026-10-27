import { expect, it, vi } from 'vitest';
import { createSnappingResolver } from '../../src/snapping/resolveSnapping.js';
import {
  defaultSnapping,
  spacingLimits,
} from '../../src/snapping/configuration.js';
import {
  createSnappingPreference,
  snappingPreferenceKey,
} from '../../src/snapping/preference.js';
import { toInches, fromInches } from '../../src/measurements/units.js';

const resolve = createSnappingResolver();
const context = (spacing = 1) => ({
  proposed: {
    position: { x: 2.76, y: 30.55, z: -2.76 },
    quaternion: [0, 0.2, 0, 0.98],
    scale: [2, 3, 4],
  },
  configuration: { enabled: true, grid: { spacing } },
  placement: { axes: ['x', 'z'] },
  mode: 'translate',
});

it.each([1, 0.5, 1 / 2.54, 2.5 / 2.54, 5 / 2.54])(
  'snaps signed world coordinates to integer multiples of %s without altering height, rotation or scale',
  (spacing) => {
    const input = context(spacing);
    const before = globalThis.structuredClone(input);
    const { transform, guidance } = resolve(input);
    expect(transform.position.x / spacing).toBeCloseTo(
      Math.round(2.76 / spacing),
      12,
    );
    expect(transform.position.z).toBe(-transform.position.x);
    expect(transform.position.y).toBe(30.55);
    expect(transform.quaternion).toBe(input.proposed.quaternion);
    expect(transform.scale).toBe(input.proposed.scale);
    expect(guidance.axes).toEqual(['x', 'z']);
    expect(input).toEqual(before);
  },
);

it('rounds ties symmetrically, normalizes negative zero and does not accumulate rounding', () => {
  const input = context(0.5);
  input.proposed.position = { x: -0.75, y: 0, z: -0.001 };
  let result = resolve(input);
  expect(result.transform.position).toEqual({ x: -1, y: 0, z: 0 });
  for (let i = 0; i < 1000; i++)
    result = resolve({ ...input, proposed: result.transform });
  expect(result.transform.position).toEqual({ x: -1, y: 0, z: 0 });
});

it('preserves free movement, bypass, rotation and scale proposals', () => {
  for (const overrides of [
    { configuration: defaultSnapping },
    { bypass: true },
    { mode: 'rotate' },
    { mode: 'scale' },
    { configuration: { enabled: true, grid: { spacing: 0 } } },
  ]) {
    const input = { ...context(), ...overrides };
    expect(resolve(input)).toEqual({
      transform: input.proposed,
      guidance: null,
    });
  }
});

it('holds the authored origin on press/tremor and acquires only deliberately moved axes', () => {
  const input = context();
  input.placement.axes = ['x', 'y', 'z'];
  input.gesture = { origin: { x: 2.76, y: 30.55, z: -2.76 }, acquiredAxes: [] };
  expect(resolve(input).transform.position).toEqual(input.gesture.origin);
  input.proposed.position.x += 0.001;
  expect(resolve(input).transform.position).toEqual(input.gesture.origin);
  input.proposed.position.x = 3.4;
  expect(resolve(input).transform.position).toEqual({
    x: 3,
    y: 30.55,
    z: -2.76,
  });
  input.gesture.acquiredAxes = ['x'];
  input.proposed.position.x = 2.8;
  expect(resolve(input).transform.position.x).toBe(3);
});

it('uses world axes independently of camera context and supports another strategy without another drag path', () => {
  const first = context();
  expect(resolve({ ...first, view: { camera: 'top' } })).toEqual(
    resolve({ ...first, view: { camera: 'side' } }),
  );
  const strategy = vi.fn((input) => ({
    transform: { ...input.proposed, position: { x: 42, y: 30.55, z: 0 } },
    guidance: { kind: 'future' },
  }));
  const next = createSnappingResolver([strategy]);
  const input = {
    ...first,
    object: { id: 1 },
    nearbyObjects: [{ id: 2 }],
    placement: { axes: ['x'], surface: { normal: [0, 1, 0] } },
  };
  expect(next(input).transform.position.x).toBe(42);
  expect(strategy).toHaveBeenCalledWith(input);
});

function storageHost(saved = null) {
  const listeners = new Map();
  return {
    localStorage: { getItem: vi.fn(() => saved), setItem: vi.fn() },
    addEventListener: (name, handler) => listeners.set(name, handler),
    removeEventListener: (name) => listeners.delete(name),
    dispatch: (event) => listeners.get('storage')?.(event),
  };
}

it('persists canonical spacing independently of unit display and synchronizes other tabs', () => {
  const host = storageHost();
  const preference = createSnappingPreference(host);
  expect(preference.configuration).toEqual(defaultSnapping);
  preference.setEnabled(true);
  preference.setSpacing(toInches(2.5, 'cm'));
  for (let i = 0; i < 1000; i++)
    fromInches(preference.configuration.grid.spacing, i % 2 ? 'cm' : 'in');
  expect(preference.configuration.grid.spacing).toBe(2.5 / 2.54);
  const saved = host.localStorage.setItem.mock.lastCall;
  expect(saved[0]).toBe(snappingPreferenceKey);
  expect(createSnappingPreference(storageHost(saved[1])).configuration).toEqual(
    preference.configuration,
  );
  const update = vi.fn();
  preference.subscribe(update);
  host.dispatch({
    key: snappingPreferenceKey,
    newValue: JSON.stringify(defaultSnapping),
    storageArea: {},
  });
  expect(preference.configuration.enabled).toBe(true);
  host.dispatch({ key: null, newValue: null, storageArea: host.localStorage });
  expect(preference.configuration).toEqual(defaultSnapping);
  preference.dispose();
  update.mockClear();
  host.dispatch({
    key: snappingPreferenceKey,
    newValue: saved[1],
    storageArea: host.localStorage,
  });
  expect(update).not.toHaveBeenCalled();
});

it('rejects invalid/small spacing and works with corrupt or disabled storage', () => {
  for (const saved of [
    'broken',
    '{"enabled":true,"grid":{"spacing":-1}}',
    'null',
    '[]',
  ]) {
    const preference = createSnappingPreference(storageHost(saved));
    expect(preference.configuration.grid.spacing).toBe(1);
    for (const value of [NaN, Infinity, -1, 0, spacingLimits.min / 2, 101, '2'])
      expect(preference.setSpacing(value)).toBe(false);
  }
  const host = storageHost();
  Object.defineProperty(host, 'localStorage', {
    get() {
      throw new Error('disabled');
    },
  });
  const preference = createSnappingPreference(host);
  preference.setEnabled(true);
  expect(preference.setSpacing(2)).toBe(true);
  expect(preference.configuration).toEqual({
    enabled: true,
    grid: { spacing: 2 },
  });
  preference.dispose();
});

it('holds a snapped cell across midpoint tremor, releases beyond the band and ignores stale spacing', () => {
  const input = context();
  input.gesture = {
    origin: { x: 0, y: 0, z: 0 },
    acquiredAxes: ['x', 'z'],
    gridCell: { spacing: 1, indices: { x: 2 } },
  };
  for (const x of [2.49, 2.51, 2.499, 2.501]) {
    input.proposed.position.x = x;
    expect(resolve(input).transform.position.x).toBe(2);
  }
  input.proposed.position.x = 2.56;
  expect(resolve(input).transform.position.x).toBe(3);
  input.configuration.grid.spacing = 0.5;
  expect(resolve(input).transform.position.x).toBe(2.5);
});
