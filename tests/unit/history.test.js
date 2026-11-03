import * as THREE from 'three';
import { afterEach, expect, it, vi } from 'vitest';
import { createObjectFactory } from '../../src/models/objectFactory.js';
import { createObjectStore } from '../../src/state/objectStore.js';
import { createActions } from '../../src/state/actions.js';
import { objectToRecord } from '../../src/sharing/sceneRecords.js';
const cleanups = [];
afterEach(() => cleanups.splice(0).forEach((cleanup) => cleanup()));
function setup(historyLimit = 100) {
  const factory = createObjectFactory({ THREE });
  const dispose = vi.fn(factory.dispose);
  const scene = new THREE.Scene();
  const state = createObjectStore({ scene, disposeObject: dispose });
  const selection = {
    pickedObject: null,
    pick(object) {
      this.pickedObject = object;
    },
    unselectPickedObject() {
      this.pickedObject = null;
    },
  };
  const actions = createActions({ state, factory, selection, historyLimit });
  cleanups.push(() => {
    actions.dispose();
    factory.disposeAll();
  });
  return {
    actions,
    history: actions.history,
    state,
    selection,
    factory,
    dispose,
    add: () => actions.add('referenceBox', { dimensions: [3, 4, 5] }),
  };
}
it('orders mixed edits, preserves identities and serialization through repeated complete cycles', async () => {
  const s = setup();
  expect(s.history.canUndo).toBe(false);
  expect(s.history.undo()).toBe(false);
  expect(s.history.redo()).toBe(false);
  const a = await s.add();
  const b = await s.add();
  const identity = [a.uuid, a.name, a.userData];
  s.actions.transforms.setPosition(a, { x: 12 });
  s.actions.transforms.setRotationDegrees(a, { y: 37 });
  s.actions.transforms.setDimensions(a, { width: 8 });
  s.selection.pick(b);
  s.actions.remove(b);
  const final = s.state.objects.map(objectToRecord);
  for (let cycle = 0; cycle < 20; cycle++) {
    for (let i = 0; i < 6; i++) expect(s.history.undo()).toBe(true);
    expect(s.state.objects).toEqual([]);
    expect(s.history.undo()).toBe(false);
    for (let i = 0; i < 6; i++) expect(s.history.redo()).toBe(true);
    expect(s.history.redo()).toBe(false);
    expect(s.state.objects.map(objectToRecord)).toEqual(final);
    expect([a.uuid, a.name, a.userData]).toEqual(identity);
  }
  s.selection.unselectPickedObject();
  s.history.undo();
  expect(s.selection.pickedObject).toBe(b);
  s.history.undo();
  await s.add();
  expect(s.history.canRedo).toBe(false);
});
it('bounds retention and releases abandoned redo objects exactly once', async () => {
  const s = setup(2);
  const a = await s.add();
  s.actions.remove(a);
  await s.add();
  await s.add();
  expect(s.dispose.mock.calls.filter(([object]) => object === a)).toHaveLength(
    1,
  );
  s.history.undo();
  s.history.undo();
  expect(s.history.undo()).toBe(false);
  const abandoned = await s.add();
  s.history.undo();
  await s.add();
  expect(s.history.canRedo).toBe(false);
  expect(
    s.dispose.mock.calls.filter(([object]) => object === abandoned),
  ).toHaveLength(1);
});
it('groups nested edits atomically and rolls back failed transactions without losing redo', async () => {
  const s = setup();
  const a = await s.add();
  s.history.clear();
  const before = objectToRecord(a);
  s.history.transaction('combined', () => {
    s.actions.transforms.setPosition(a, { x: 10 });
    s.actions.transforms.setRotationDegrees(a, { y: 30 });
  });
  expect(s.history.undo()).toBe(true);
  expect(objectToRecord(a)).toEqual(before);
  expect(s.history.undo()).toBe(false);
  expect(() =>
    s.history.transaction('failed', () => {
      s.actions.remove(a);
      throw new Error('fail');
    }),
  ).toThrow('fail');
  expect(s.state.objects).toEqual([a]);
  expect(s.history.canRedo).toBe(true);
  s.history.transaction('empty', () => {});
  expect(s.history.canRedo).toBe(true);
});
it('coalesces gestures, cancels changes, and ignores return-to-origin gestures', async () => {
  const s = setup();
  const a = await s.add();
  s.history.clear();
  const start = a.position.clone();
  s.actions.transforms.begin(a);
  for (let i = 0; i < 100; i++) a.position.x = i;
  s.actions.transforms.cancel();
  expect(a.position.equals(start)).toBe(true);
  expect(s.history.canUndo).toBe(false);
  s.actions.transforms.begin(a);
  a.position.x++;
  a.position.copy(start);
  s.actions.transforms.commit();
  expect(s.history.canUndo).toBe(false);
  for (let i = 0; i < 2; i++) {
    s.actions.transforms.begin(a);
    a.position.x++;
    s.actions.transforms.commit();
  }
  s.history.undo();
  s.history.undo();
  expect(a.position.equals(start)).toBe(true);
  expect(s.history.undo()).toBe(false);
});
it('keeps history and scene intact after failed resize allocation; preserves deliberate deselection', async () => {
  const s = setup();
  const a = await s.add();
  s.actions.transforms.setDimensions(a, { width: 9 });
  const after = objectToRecord(a);
  const allocation = vi
    .spyOn(s.factory, 'preparePrimitiveResize')
    .mockImplementation(() => {
      throw new Error('allocation');
    });
  expect(() => s.history.undo()).toThrow('allocation');
  expect(objectToRecord(a)).toEqual(after);
  expect(s.history.canUndo).toBe(true);
  allocation.mockRestore();
  s.selection.unselectPickedObject();
  s.history.undo();
  expect(s.selection.pickedObject).toBeNull();
});
it('restores setups atomically and releases an asynchronous load invalidated by undo', async () => {
  const s = setup();
  const a = await s.add();
  const record = {
    ...objectToRecord(a),
    position: [40, 30, 20],
    dimensions: [8, 9, 10],
  };
  await s.actions.restore([record]);
  const restored = s.state.objects[0];
  expect(restored).not.toBe(a);
  s.history.undo();
  expect(s.state.objects).toEqual([a]);
  s.history.redo();
  expect(s.state.objects).toEqual([restored]);
  expect(objectToRecord(restored)).toEqual(record);
  let resolve;
  const originalCreate = s.factory.create;
  const staged = await originalCreate(record);
  vi.spyOn(s.factory, 'create').mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const release = vi.spyOn(s.factory, 'dispose');
  const pending = s.add();
  s.history.undo();
  resolve(staged);
  expect(await pending).toBeNull();
  expect(s.state.objects).toEqual([a]);
  expect(release).toHaveBeenCalledWith(staged);
});
