import { setTimeout } from 'node:timers/promises';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createObjectStore } from '../../src/state/objectStore.js';
import { createActions } from '../../src/state/actions.js';
import { createRecord } from '../../src/catalog/configuration.js';
import { disposeResources } from '../../src/models/resources.js';
import { encodeSetup, limits } from '../../src/sharing/legacyCodec.js';
import { validateProjectRecords } from '../../src/projects/projectRecords.js';
import { objectToRecord } from '../../src/sharing/sceneRecords.js';
import { createSharing } from '../../src/sharing/createSharing.js';
import { createLocalProjects } from '../../src/projects/localProjects.js';

function deferred() {
  let resolve, reject;
  const promise = new Promise((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
function setup() {
  const scene = new THREE.Scene();
  const factory = {
    create: vi.fn(async () => new THREE.Group()),
    dispose: vi.fn(),
  };
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
  const actions = createActions({ state, selection, factory });
  return { scene, state, selection, factory, actions };
}
function seedCatalog({ state, factory }, count) {
  for (let index = 0; index < count; index++)
    state.add(new THREE.Group(), createRecord('defaultMouse'));
  // Seeding bypasses actions so the boundary tests start with empty history.
  factory.create.mockClear();
}

describe('object state and asynchronous actions', () => {
  it('accepts the 500th catalog object, rejects the 501st without changing state, and serializes the valid scene', async () => {
    const app = setup();
    seedCatalog(app, limits.objects - 1);
    const { actions, state, selection, factory } = app;
    const last = await actions.add('defaultMouse');
    const before = state.objects;
    const records = before.map(objectToRecord);
    expect(before).toHaveLength(limits.objects);
    expect(encodeSetup(records)).toContain('defaultMouse');
    expect(validateProjectRecords(records)).toHaveLength(limits.objects);
    const sharing = createSharing({
      state,
      actions,
      getLocation: () => 'https://test.example/mainApp.html',
    });
    expect(sharing.createLink()).toContain('customSetup=');
    const storage = { write: vi.fn() };
    const projects = createLocalProjects({
      state,
      actions,
      factory,
      modelImports: {},
      storage,
    });
    await projects.save('capacity');
    expect(storage.write.mock.calls[0][1].records).toHaveLength(limits.objects);
    projects.dispose();
    const rejected = new THREE.Group();
    factory.create.mockResolvedValueOnce(rejected);
    await expect(actions.add('defaultMouse')).rejects.toThrow(
      'supported 500-object limit',
    );
    expect(state.objects).toEqual(before);
    expect(selection.pickedObject).toBe(last);
    expect(
      factory.dispose.mock.calls.filter(([object]) => object === rejected),
    ).toHaveLength(1);
    expect(actions.history.undo()).toBe(true);
    expect(state.objects).toHaveLength(limits.objects - 1);
    expect(actions.history.undo()).toBe(false);
    expect(actions.history.redo()).toBe(true);
    expect(state.objects).toHaveLength(limits.objects);
    await actions.restoreProject(records, {
      files: new Map(),
      signal: new globalThis.AbortController().signal,
      generation: state.invalidate(),
    });
    expect(state.objects).toHaveLength(limits.objects);
  });

  it('replaces at capacity and restores capacity after deletion through undo and redo', async () => {
    const app = setup();
    seedCatalog(app, limits.objects - 1);
    const { actions, state, selection } = app;
    const original = await actions.add('defaultMouse');
    selection.pick(original);
    const replacement = await actions.add('MXMaster3', { replace: true });
    expect(state.objects).toHaveLength(limits.objects);
    expect(state.has(original)).toBe(false);
    expect(state.has(replacement)).toBe(true);
    expect(actions.remove(replacement)).toBe(true);
    expect(state.objects).toHaveLength(limits.objects - 1);
    const added = await actions.add('defaultMouse');
    expect(state.objects).toHaveLength(limits.objects);
    actions.history.undo();
    expect(state.has(added)).toBe(false);
    actions.history.undo();
    expect(state.has(replacement)).toBe(true);
    expect(state.objects).toHaveLength(limits.objects);
    actions.history.redo();
    expect(state.objects).toHaveLength(limits.objects - 1);
    actions.history.redo();
    expect(state.objects).toHaveLength(limits.objects);
  });

  it('checks concurrent asynchronous catalog adds when they commit and releases the rejected load', async () => {
    const app = setup();
    seedCatalog(app, limits.objects - 1);
    const { actions, state, selection, factory } = app;
    const first = deferred();
    const second = deferred();
    factory.create
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const one = actions.add('defaultMouse');
    const two = actions.add('defaultMouse');
    first.resolve(new THREE.Group());
    const committed = await one;
    const rejected = new THREE.Group();
    second.resolve(rejected);
    await expect(two).rejects.toThrow('supported 500-object limit');
    expect(state.objects).toHaveLength(limits.objects);
    expect(selection.pickedObject).toBe(committed);
    expect(
      factory.dispose.mock.calls.filter(([object]) => object === rejected),
    ).toHaveLength(1);
    actions.history.undo();
    expect(state.objects).toHaveLength(limits.objects - 1);
    expect(actions.history.canUndo).toBe(false);
  });

  it('restores 500 records and rejects larger shared or project scenes before invalidating or replacing', async () => {
    const { actions, state, selection, factory } = setup();
    const original = await actions.add('defaultMouse');
    const records = Array.from({ length: limits.objects }, () =>
      createRecord('defaultMouse'),
    );
    const generation = state.generation;
    await expect(actions.restore([...records, records[0]])).rejects.toThrow(
      'too many objects',
    );
    expect(() =>
      actions.restoreProject([...records, records[0]], {
        files: new Map(),
        signal: new globalThis.AbortController().signal,
        generation,
      }),
    ).toThrow('too many objects');
    expect(state.objects).toEqual([original]);
    expect(selection.pickedObject).toBe(original);
    expect(state.generation).toBe(generation);
    expect(factory.create).toHaveBeenCalledTimes(1);
    await actions.restore(records);
    expect(state.objects).toHaveLength(limits.objects);
    expect(actions.history.undo()).toBe(true);
    expect(state.objects).toEqual([original]);
    expect(actions.history.redo()).toBe(true);
    expect(state.objects).toHaveLength(limits.objects);
  });

  it('releases an allocated object once when a commit rolls back', async () => {
    const { actions, state, selection, factory } = setup();
    const original = await actions.add('defaultMouse');
    const candidate = new THREE.Group();
    factory.create.mockResolvedValueOnce(candidate);
    const pick = selection.pick;
    selection.pick = function (object) {
      if (object === candidate) throw new Error('selection failure');
      pick.call(this, object);
    };
    await expect(actions.add('QCKSmall')).rejects.toThrow('selection failure');
    expect(state.objects).toEqual([original]);
    expect(selection.pickedObject).toBe(original);
    expect(
      factory.dispose.mock.calls.filter(([object]) => object === candidate),
    ).toHaveLength(1);
  });
  it('waits for all default loads after an early failure and keeps successful objects', async () => {
    const { actions, state, factory } = setup();
    const load = deferred();
    factory.create
      .mockRejectedValueOnce(new Error('offline'))
      .mockReturnValueOnce(load.promise);
    const settled = vi.fn();
    const pending = actions.initialize().catch((error) => {
      settled(error);
    });
    await setTimeout(0);
    expect(settled).not.toHaveBeenCalled();
    load.resolve(new THREE.Group());
    await pending;
    expect(settled).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'offline' }),
    );
    expect(state.objects).toHaveLength(5);
  });
  it('tracks unique names and disposes only registered objects', () => {
    const { state, scene, factory } = setup();
    const first = state.add(new THREE.Group(), createRecord('defaultMouse'));
    const second = state.add(new THREE.Group(), createRecord('defaultMouse'));
    expect(first.name).toBe('defaultMouse-0');
    expect(second.name).toBe('defaultMouse-1');
    state.remove(first);
    state.remove(first);
    expect(state.objects).toEqual([second]);
    expect(scene.children).toEqual([second]);
    expect(factory.dispose).toHaveBeenCalledOnce();
    const copy = state.objects;
    copy.pop();
    expect(state.objects).toHaveLength(1);
  });
  it('captures the replacement target and X/Z even when selection changes during loading', async () => {
    const { actions, state, selection, factory } = setup();
    const first = await actions.add('defaultMouse');
    const second = await actions.add('QCKSmall');
    first.position.set(10, 99, -20);
    selection.pick(first);
    const load = deferred();
    factory.create.mockReturnValueOnce(load.promise);
    const pending = actions.add('MXMaster3', { replace: true });
    selection.pick(second);
    first.position.x = 50;
    load.resolve(new THREE.Group());
    const added = await pending;
    expect(state.has(first)).toBe(false);
    expect(state.has(second)).toBe(true);
    expect(added.position.x).toBe(10);
    expect(added.position.z).toBe(-20);
    expect(added.position.y).toBe(createRecord('MXMaster3').position[1]);
  });
  it('keeps the current desk and accessory heights when a replacement fails', async () => {
    const { actions, state, factory } = setup();
    const desk = await actions.add('modernDesk');
    const mouse = await actions.add('defaultMouse');
    const height = mouse.position.y;
    factory.create.mockRejectedValueOnce(new Error('asset unavailable'));
    await expect(actions.add('standingDesk')).rejects.toThrow(
      'asset unavailable',
    );
    expect(state.has(desk)).toBe(true);
    expect(mouse.position.y).toBe(height);
  });
  it('disposes late completions after reset and does not repopulate the scene', async () => {
    const { actions, state, factory } = setup();
    const load = deferred();
    factory.create.mockReturnValueOnce(load.promise);
    const pending = actions.add('defaultMouse');
    actions.reset();
    const object = new THREE.Group();
    load.resolve(object);
    expect(await pending).toBeNull();
    expect(state.objects).toEqual([]);
    expect(factory.dispose).toHaveBeenCalledWith(object);
  });
  it('cancels a replacement if its original target was deleted while loading', async () => {
    const { actions, state, factory } = setup();
    const original = await actions.add('defaultMouse');
    const load = deferred();
    factory.create.mockReturnValueOnce(load.promise);
    const pending = actions.add('MXMaster3', { replace: true });
    actions.remove(original);
    load.resolve(new THREE.Group());
    expect(await pending).toBeNull();
    expect(state.objects).toEqual([]);
  });
  it('shifts existing accessories for a desk change while preserving furniture', async () => {
    const { actions, state } = setup();
    await actions.add('modernDesk');
    const mouse = await actions.add('defaultMouse');
    const chair = await actions.add('simpleChair');
    const y = mouse.position.y;
    const chairY = chair.position.y;
    await actions.add('customDesk', {
      dimensions: [50, 1, 20],
      texture: 'italianOak',
    });
    expect(mouse.position.y).toBe(y - 0.5);
    expect(chair.position.y).toBe(chairY);
    expect(state.deskOffset).toBe(-0.5);
    expect(
      state.objects.filter((object) => object.userData.type.includes('Desk')),
    ).toHaveLength(1);
    // Preserve the legacy new-model placement convention until separately revised.
    const added = await actions.add('defaultMouse');
    expect(added.position.y).toBe(y);
  });
  it('validates restoration before invalidation and commits only after every load succeeds', async () => {
    const { actions, state, factory } = setup();
    const original = await actions.add('defaultMouse');
    const generation = state.generation;
    await expect(actions.restore([{ product: 'missing' }])).rejects.toThrow(
      'Invalid setup',
    );
    expect(state.generation).toBe(generation);
    const load = deferred();
    factory.create.mockReturnValueOnce(load.promise);
    const record = createRecord('QCKSmall');
    record.position = [3, 4, 5];
    const pending = actions.restore([record]);
    expect(state.objects).toEqual([original]);
    load.resolve(new THREE.Group());
    await pending;
    expect(state.objects).toHaveLength(1);
    expect(state.objects[0].userData.objectName).toBe('QCKSmall');
    expect(state.objects[0].position.toArray()).toEqual([3, 4, 5]);
  });
  it('retains the current setup and releases staged models after a failed restore', async () => {
    const { actions, state, factory } = setup();
    const original = await actions.add('defaultMouse');
    const staged = new THREE.Group();
    factory.create
      .mockResolvedValueOnce(staged)
      .mockRejectedValueOnce(new Error('offline'));
    await expect(
      actions.restore([createRecord('QCKSmall'), createRecord('modernDesk')]),
    ).rejects.toThrow('offline');
    expect(state.objects).toEqual([original]);
    expect(factory.dispose).toHaveBeenCalledWith(staged);
    expect(factory.dispose).not.toHaveBeenCalledWith(original);
  });
  it('disposes each shared resource once within an owned model hierarchy', () => {
    const root = new THREE.Group();
    const geometry = new THREE.BoxGeometry();
    const texture = new THREE.Texture();
    const material = new THREE.MeshLambertMaterial({ map: texture });
    root.add(
      new THREE.Mesh(geometry, material),
      new THREE.Mesh(geometry, material),
    );
    for (const item of [geometry, texture, material]) vi.spyOn(item, 'dispose');
    disposeResources(root);
    for (const item of [geometry, texture, material])
      expect(item.dispose).toHaveBeenCalledOnce();
  });
});
