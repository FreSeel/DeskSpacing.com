import * as THREE from 'three';
import { afterEach, expect, it, vi } from 'vitest';
import { createObjectFactory } from '../../src/models/objectFactory.js';
import { createObjectStore } from '../../src/state/objectStore.js';
import { createActions } from '../../src/state/actions.js';
import { objectToRecord } from '../../src/sharing/sceneRecords.js';
import { decodeSetup, encodeSetup } from '../../src/sharing/legacyCodec.js';

const fixtures = [];
async function setup() {
  const scene = new THREE.Scene();
  const factory = createObjectFactory({ THREE });
  const state = createObjectStore({ scene, disposeObject: factory.dispose });
  const selection = {
    pickedObject: null,
    pick(object) {
      this.pickedObject = object;
    },
    unselectPickedObject() {
      this.pickedObject = null;
    },
  };
  const invalidateScene = vi.fn();
  const actions = createActions({ state, selection, factory, invalidateScene });
  const reference = await actions.add('referenceBox', {
    dimensions: [4, 6, 8],
  });
  const object = await actions.add('referenceBox', { dimensions: [2, 3, 5] });
  reference.position.set(3.25, 7.75, -12.125);
  object.position.set(-18.5, 23.25, 41.75);
  const fixture = {
    scene,
    state,
    factory,
    actions,
    reference,
    object,
    invalidateScene,
  };
  fixtures.push(fixture);
  return fixture;
}
afterEach(() => {
  for (const { actions, factory } of fixtures.splice(0)) {
    actions.transforms.dispose();
    actions.reset();
    factory.disposeAll();
  }
});

for (const axis of ['x', 'y', 'z']) {
  for (const direction of [1, -1]) {
    it(`places rotated and scaled bounds along ${direction > 0 ? '+' : '-'}${axis}, preserving other world axes`, async () => {
      const { actions, object, reference } = await setup();
      object.rotation.set(0.2, -0.7, 0.1);
      reference.rotation.set(-0.4, 0.3, 0.15);
      object.scale.set(1.2, 0.7, 2.1);
      reference.scale.set(-0.6, 1.3, 0.8);
      const before = object.position.clone();
      const rotation = object.quaternion.toArray();
      const scale = object.scale.toArray();
      const geometry = object.children[0].geometry;
      const config = {
        axis,
        direction,
        unit: 'cm',
        clearance: 10.123456789,
      };
      expect(actions.spacing.place(object, reference, config)).toBe(true);
      const a = new THREE.Box3().setFromObject(object);
      const b = new THREE.Box3().setFromObject(reference);
      const gap =
        direction === 1 ? a.min[axis] - b.max[axis] : b.min[axis] - a.max[axis];
      expect(gap * 2.54).toBeCloseTo(config.clearance, 10);
      expect(
        actions.spacing.measure(object, reference, config).clearance,
      ).toBeCloseTo(config.clearance, 10);
      for (const other of ['x', 'y', 'z'].filter((key) => key !== axis))
        expect(object.position[other]).toBe(before[other]);
      expect(object.quaternion.toArray()).toEqual(rotation);
      expect(object.scale.toArray()).toEqual(scale);
      expect(object.children[0].geometry).toBe(geometry);
    });
  }
}

it('records a single placement, reapplies without drift, and round trips the position without saving a constraint', async () => {
  const { actions, state, object, reference, invalidateScene } = await setup();
  const config = {
    axis: 'x',
    direction: 1,
    unit: 'cm',
    clearance: 10.123456789,
  };
  const before = objectToRecord(object);
  actions.spacing.place(object, reference, config);
  const after = objectToRecord(object);
  for (let i = 0; i < 100; i++)
    expect(actions.spacing.place(object, reference, config)).toBe(false);
  expect(objectToRecord(object)).toEqual(after);
  expect(invalidateScene).toHaveBeenCalledOnce();
  expect(actions.transforms.undo()).toBe(true);
  expect(objectToRecord(object)).toEqual(before);
  expect(actions.transforms.undo()).toBe(false);
  expect(actions.transforms.redo()).toBe(true);
  expect(objectToRecord(object)).toEqual(after);
  reference.position.x += 5;
  expect(objectToRecord(object)).toEqual(after);
  expect(
    actions.spacing.measure(object, reference, config).clearance,
  ).toBeCloseTo(config.clearance - 5 * 2.54, 10);
  const records = [objectToRecord(reference), after];
  await actions.restore(decodeSetup(encodeSetup(records)));
  expect(state.objects.map(objectToRecord)).toEqual(records);
  expect(
    actions.spacing.measure(state.objects[1], state.objects[0], config)
      .clearance,
  ).toBeCloseTo(config.clearance - 5 * 2.54, 10);
});

it('updates measurements after resizing, child transforms, native moves, and undo', async () => {
  const { actions, object, reference } = await setup();
  const config = { axis: 'x', direction: 1, unit: 'in' };
  object.position.x = 20;
  reference.position.x = 0;
  expect(actions.spacing.measure(object, reference, config).clearance).toBe(17);
  actions.transforms.setDimensions(reference, { width: 10 });
  expect(actions.spacing.measure(object, reference, config).clearance).toBe(14);
  actions.transforms.undo();
  expect(actions.spacing.measure(object, reference, config).clearance).toBe(17);
  reference.children[0].position.x = 2;
  expect(actions.spacing.measure(object, reference, config).clearance).toBe(15);
  reference.position.x = 3;
  expect(actions.spacing.measure(object, reference, config).clearance).toBe(12);
});

it('uses signed directed clearance, including zero contact and disjoint other-axis projections', async () => {
  const { actions, object, reference } = await setup();
  object.position.set(0, 200, 300);
  reference.position.set(0, -200, -300);
  const config = { axis: 'x', direction: 1, unit: 'in', clearance: 0 };
  expect(actions.spacing.measure(object, reference, config).clearance).toBe(-3);
  actions.spacing.place(object, reference, config);
  expect(object.position.toArray()).toEqual([3, 200, 300]);
  expect(actions.spacing.measure(object, reference, config).clearance).toBe(0);
  expect(
    actions.spacing.measure(object, reference, { ...config, direction: -1 })
      .clearance,
  ).toBe(-6);
});

it('handles transformed parents without changing unrelated world coordinates', async () => {
  const { actions, scene, object, reference } = await setup();
  const parent = new THREE.Group();
  scene.add(parent);
  parent.position.set(20, -8, 12);
  parent.rotation.set(0.3, -0.4, 0.1);
  parent.scale.set(1.5, 0.7, 1.1);
  parent.add(object);
  const before = object.getWorldPosition(new THREE.Vector3());
  const rotation = object.quaternion.toArray();
  const config = {
    axis: 'z',
    direction: -1,
    clearance: 7.654321,
    unit: 'cm',
  };
  actions.spacing.place(object, reference, config);
  const after = object.getWorldPosition(new THREE.Vector3());
  expect(after.x).toBeCloseTo(before.x, 10);
  expect(after.y).toBeCloseTo(before.y, 10);
  expect(object.quaternion.toArray()).toEqual(rotation);
  expect(
    actions.spacing.measure(object, reference, config).clearance,
  ).toBeCloseTo(config.clearance, 10);
  actions.transforms.undo();
  expect(
    object.getWorldPosition(new THREE.Vector3()).distanceTo(before),
  ).toBeLessThan(1e-10);
});

it('retains a 10 cm clearance near both coordinate limits without repeated-placement drift', async () => {
  const { actions, object, reference } = await setup();
  object.rotation.set(0.2, 0.5, -0.3);
  object.scale.set(1.25, 0.75, 1.5);
  reference.rotation.set(-0.15, 0.35, 0.1);
  reference.scale.set(1.2, 0.8, 1.4);
  let maximumErrorCm = 0;
  for (const origin of [0, 999900, -999900]) {
    reference.position.set(origin, origin + 5.25, origin - 12.125);
    for (const axis of ['x', 'y', 'z']) {
      for (const direction of [1, -1]) {
        const config = { axis, direction, unit: 'cm', clearance: 10 };
        actions.spacing.place(object, reference, config);
        const position = object.position.toArray();
        const error = Math.abs(
          actions.spacing.measure(object, reference, config).clearance - 10,
        );
        maximumErrorCm = Math.max(maximumErrorCm, error);
        expect(error).toBeLessThanOrEqual(1e-8);
        for (let i = 0; i < 100; i++)
          expect(actions.spacing.place(object, reference, config)).toBe(false);
        expect(object.position.toArray()).toEqual(position);
      }
    }
  }
  console.info('10 cm clearance maximum absolute error (cm):', maximumErrorCm);
});

it('rejects invalid input, stale references, missing geometry, locks and pending gestures without a move', async () => {
  const { actions, object, reference, state } = await setup();
  const config = { axis: 'x', direction: 1, clearance: 10, unit: 'cm' };
  const before = objectToRecord(object);
  const reject = (patch = {}) => {
    expect(() =>
      actions.spacing.place(object, reference, { ...config, ...patch }),
    ).toThrow();
    expect(objectToRecord(object)).toEqual(before);
    expect(actions.transforms.canUndo).toBe(false);
  };
  for (const clearance of [-1, NaN, Infinity, '', '10', null, 1e100])
    reject({ clearance });
  reject({ axis: 'w' });
  reject({ direction: 0 });
  reject({ unit: 'm' });
  expect(() => actions.spacing.place(object, object, config)).toThrow(
    'different',
  );
  reference.visible = false;
  reject();
  reference.visible = true;
  reference.children[0].material.visible = false;
  reject();
  reference.children[0].material.visible = true;
  object.userData.type += 'NoSelect';
  expect(() => actions.spacing.place(object, reference, config)).toThrow(
    'cannot move',
  );
  object.userData.type = before.type;
  actions.transforms.begin(object);
  reject();
  actions.transforms.commit();
  object.add(reference);
  expect(() => actions.spacing.place(object, reference, config)).toThrow(
    'hierarchy',
  );
  object.remove(reference);
  state.remove(reference);
  reject();
});
