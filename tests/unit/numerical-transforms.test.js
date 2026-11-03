import * as THREE from 'three';
import { afterEach, expect, it, vi } from 'vitest';
import { createObjectFactory } from '../../src/models/objectFactory.js';
import { createObjectStore } from '../../src/state/objectStore.js';
import { createActions } from '../../src/state/actions.js';
import { objectToRecord } from '../../src/sharing/sceneRecords.js';
import {
  encodeSetup,
  decodeSetup,
  limits,
} from '../../src/sharing/legacyCodec.js';
import { createObjectDimensions } from '../../src/measurements/objectDimensions.js';

const fixtures = [];
function setup(engine = THREE) {
  const model = new THREE.Group();
  const root = new THREE.Group();
  root.add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.75, 0.7)));
  model.add(root);
  let loaded = false;
  const factory = createObjectFactory({
    THREE: engine,
    modelOptions: {
      loader: {
        load(_path, complete) {
          loaded = true;
          complete({ scene: model });
        },
      },
    },
  });
  const scene = new THREE.Scene();
  const invalidateScene = vi.fn();
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
  const actions = createActions({ state, selection, factory, invalidateScene });
  const box = async () => {
    const object = await actions.add('referenceBox', { dimensions: [3, 4, 5] });
    actions.history.clear();
    return object;
  };
  const fixture = {
    actions,
    transforms: actions.transforms,
    factory,
    scene,
    state,
    invalidateScene,
    box,
    disposeUnusedTemplate() {
      if (loaded) return;
      root.children[0].geometry.dispose();
      root.children[0].material.dispose();
    },
  };
  fixtures.push(fixture);
  return fixture;
}

afterEach(() => {
  for (const { actions, factory, disposeUnusedTemplate } of fixtures.splice(
    0,
  )) {
    actions.dispose();
    factory.disposeAll();
    // The synthetic loader template is unused in primitive-only cases.
    disposeUnusedTemplate();
  }
});

it('applies a precise combined edit to the live object as one undoable, serializable action', async () => {
  const s = setup();
  const object = await s.box();
  const mesh = object.children[0];
  const geometry = mesh.geometry;
  const disposed = vi.spyOn(geometry, 'dispose');
  const material = mesh.material;
  const before = objectToRecord(object);
  const name = object.name;
  const width = 30.123456789;
  expect(
    s.transforms.update(
      object,
      {
        position: { x: -25.4123456789, y: 76.2, z: 0 },
        rotationDegrees: { x: 10.25, y: 45.123456789, z: -0.375 },
        dimensions: { width, height: 20, depth: 10 },
      },
      { unit: 'cm' },
    ),
  ).toBe(true);
  expect(object.position.toArray()).toEqual([
    -25.4123456789 / 2.54,
    76.2 / 2.54,
    0,
  ]);
  expect(object.rotation.y).toBe(45.123456789 * (Math.PI / 180));
  expect(mesh.geometry.parameters.width).toBe(width / 2.54);
  expect(s.transforms.read(object, { unit: 'cm' }).dimensions.width).toBe(
    (width / 2.54) * 2.54,
  );
  expect(object.scale.toArray()).toEqual([1, 1, 1]);
  expect(object.name).toBe(name);
  expect(mesh.material).toBe(material);
  expect(s.state.objects).toEqual([object]);
  expect(disposed).toHaveBeenCalledOnce();
  expect(s.invalidateScene).toHaveBeenCalledOnce();
  const after = objectToRecord(object);
  expect(s.transforms.undo()).toBe(true);
  expect(objectToRecord(object)).toEqual(before);
  expect(s.transforms.undo()).toBe(false);
  expect(s.transforms.redo()).toBe(true);
  expect(objectToRecord(object)).toEqual(after);
  await s.actions.restore(decodeSetup(encodeSetup([after])));
  expect(objectToRecord(s.state.objects[0])).toEqual(after);
  expect(s.transforms.canUndo).toBe(true);
});

it('preserves untouched axes and orientation, and never feeds rounded vertices or unit conversions back into edits', async () => {
  const s = setup();
  const object = await s.box();
  object.position.set(1.234567891234, 30.5500000007, -57.123456789);
  object.quaternion.setFromAxisAngle(
    new THREE.Vector3(1, 2, 3).normalize(),
    0.987654321,
  );
  const quaternion = object.quaternion.toArray();
  s.transforms.setPosition(object, { x: 12.34567891234 }, { unit: 'cm' });
  expect(object.position.y).toBe(30.5500000007);
  expect(object.position.z).toBe(-57.123456789);
  expect(object.quaternion.toArray()).toEqual(quaternion);
  const before = objectToRecord(object);
  const geometry = object.children[0].geometry;
  s.invalidateScene.mockClear();
  const changed = vi.fn();
  const unsubscribe = s.transforms.subscribe(changed);
  changed.mockClear();
  for (let i = 0; i < 100; i++) {
    const unit = i % 2 ? 'cm' : 'in';
    const { position, rotationDegrees, dimensions } = s.transforms.read(
      object,
      { unit },
    );
    expect(
      s.transforms.update(
        object,
        { position, rotationDegrees, dimensions },
        { unit },
      ),
    ).toBe(false);
  }
  expect(objectToRecord(object)).toEqual(before);
  expect(object.quaternion.toArray()).toEqual(quaternion);
  expect(object.children[0].geometry).toBe(geometry);
  expect(s.invalidateScene).not.toHaveBeenCalled();
  expect(changed).not.toHaveBeenCalled();
  unsubscribe();
});

it('keeps primitive dimensions independent of rotation and refreshes existing geometry readers after resize and history', async () => {
  const s = setup();
  const object = await s.box();
  const reader = createObjectDimensions();
  expect(reader.read(object).dimensions.x).toBe(3);
  s.transforms.setRotationDegrees(object, { x: 20, y: 48, z: -31 });
  const origin = object.position.toArray();
  s.transforms.setDimensions(
    object,
    { width: 30, height: 20, depth: 10 },
    { unit: 'cm' },
  );
  const measured = reader.read(object).dimensions;
  expect(measured.x * 2.54).toBeCloseTo(30, 4);
  expect(measured.y * 2.54).toBeCloseTo(20, 4);
  expect(measured.z * 2.54).toBeCloseTo(10, 4);
  expect(object.position.toArray()).toEqual(origin);
  s.transforms.undo();
  expect(reader.read(object).dimensions.x).toBeCloseTo(3, 10);
  s.transforms.redo();
  expect(reader.read(object).dimensions.x * 2.54).toBeCloseTo(30, 4);
});

it('resizes sphere diameter uniformly and persists radius without changing tessellation', async () => {
  const s = setup();
  const sphere = await s.actions.add('referenceSphere', {
    dimensions: [2, -1, -1],
  });
  const vertices = sphere.children[0].geometry.attributes.position.count;
  expect(s.transforms.read(sphere).capabilities.dimensions).toEqual([
    'diameter',
  ]);
  s.transforms.setDimensions(
    sphere,
    { diameter: 20.123456789 },
    { unit: 'cm' },
  );
  const record = objectToRecord(sphere);
  expect(record.dimensions).toEqual([20.123456789 / 2.54 / 2, -1, -1]);
  const values = s.transforms.read(sphere, { unit: 'cm' }).dimensions;
  expect(values.width).toBe(values.height);
  expect(values.height).toBe(values.depth);
  expect(values.depth).toBe(values.diameter);
  expect(sphere.children[0].geometry.attributes.position.count).toBe(vertices);
  expect(() => s.transforms.setDimensions(sphere, { width: 10 })).toThrow(
    'Unsupported',
  );
  await s.actions.restore(decodeSetup(encodeSetup([record])));
  expect(objectToRecord(s.state.objects[0])).toEqual(record);
  s.transforms.setDimensions(s.state.objects[0], {
    diameter: limits.dimension * 2,
  });
  expect(objectToRecord(s.state.objects[0]).dimensions[0]).toBe(
    limits.dimension,
  );
});

it('resizes only custom desktop width/depth, preserving locks, thickness, offsets and accessories', async () => {
  const s = setup();
  const desk = await s.actions.add('customDesk', {
    dimensions: [50, 1, 20],
    texture: 'null',
  });
  const accessory = await s.box();
  const position = desk.position.toArray();
  const accessoryBefore = objectToRecord(accessory);
  const offset = s.state.deskOffset;
  expect(s.transforms.read(desk).capabilities).toEqual({
    position: [],
    rotationDegrees: [],
    dimensions: ['width', 'depth'],
  });
  s.transforms.setDimensions(desk, { width: 140, depth: 70 }, { unit: 'cm' });
  expect(desk.children[0].geometry.parameters.height).toBe(1);
  expect(desk.position.toArray()).toEqual(position);
  expect(s.state.deskOffset).toBe(offset);
  expect(objectToRecord(accessory)).toEqual(accessoryBefore);
  expect(() => s.transforms.setPosition(desk, { x: 5 })).toThrow('Unsupported');
  expect(() => s.transforms.setRotationDegrees(desk, { y: 5 })).toThrow(
    'Unsupported',
  );
  expect(() => s.transforms.setDimensions(desk, { height: 5 })).toThrow(
    'Unsupported',
  );
  expect(s.transforms.undo()).toBe(true);
  expect(desk.children[0].geometry.parameters.width).toBe(50);
});

it('measures catalog import wrappers and keeps shared model geometry read-only', async () => {
  const s = setup();
  const object = await s.actions.add('appleStudioDisplay');
  s.actions.history.clear();
  const values = s.transforms.read(object, { unit: 'cm' });
  expect(values.dimensions.width).toBeCloseTo(140, 4);
  expect(values.dimensions.height).toBeCloseTo(75, 4);
  expect(values.dimensions.depth).toBeCloseTo(70, 4);
  expect(values.capabilities.dimensions).toEqual([]);
  expect(() =>
    s.transforms.setDimensions(object, { width: 200 }, { unit: 'cm' }),
  ).toThrow('Unsupported');
  expect(s.transforms.canUndo).toBe(false);
  expect(s.invalidateScene).not.toHaveBeenCalled();
});

it('rejects invalid patches atomically without destroying redo or replacing geometry', async () => {
  const s = setup();
  const object = await s.box();
  s.transforms.setPosition(object, { x: 5 });
  s.transforms.undo();
  const before = objectToRecord(object);
  const geometry = object.children[0].geometry;
  s.invalidateScene.mockClear();
  for (const patch of [
    { position: { x: NaN } },
    { position: { x: Infinity } },
    { position: { x: '' } },
    { position: { x: '12' } },
    { position: { x: limits.coordinate + 1 } },
    { rotationDegrees: { y: Infinity } },
    { rotationDegrees: { y: Number.MAX_VALUE } },
    { dimensions: { width: 0 } },
    { dimensions: { depth: -1 } },
    { dimensions: { height: limits.dimension + 1 } },
    { position: { x: 4 }, dimensions: { width: -1 } },
    { position: { q: 4 } },
    { scale: { x: 4 } },
    { position: [1, 2, 3] },
    { position: null },
  ])
    expect(() => s.transforms.update(object, patch)).toThrow();
  expect(() =>
    s.transforms.setPosition(object, { x: 10 }, { unit: 'm' }),
  ).toThrow();
  expect(objectToRecord(object)).toEqual(before);
  expect(object.children[0].geometry).toBe(geometry);
  expect(s.transforms.canRedo).toBe(true);
  expect(s.invalidateScene).not.toHaveBeenCalled();
});

it('converts world edits through current parent matrices and keeps local history exact', async () => {
  const s = setup();
  const object = await s.box();
  const local = object.position.toArray();
  s.scene.position.set(7, -3, 8);
  s.scene.rotation.set(0.2, 0.7, -0.1);
  s.scene.scale.set(1.3, 0.8, 2.1);
  const before = object.getWorldPosition(new THREE.Vector3());
  s.transforms.setPosition(object, { x: 25.4 }, { unit: 'cm' });
  const after = object.getWorldPosition(new THREE.Vector3());
  expect(after.x).toBeCloseTo(10, 10);
  expect(after.y).toBeCloseTo(before.y, 10);
  expect(after.z).toBeCloseTo(before.z, 10);
  expect(s.transforms.read(object).capabilities.dimensions).toEqual([]);
  const position = s.transforms.read(object, { unit: 'cm' }).position;
  expect(s.transforms.setPosition(object, position, { unit: 'cm' })).toBe(
    false,
  );
  s.transforms.undo();
  expect(object.position.toArray()).toEqual(local);
  s.scene.scale.y = 0;
  expect(s.transforms.read(object).capabilities.position).toEqual([]);
  expect(() => s.transforms.setPosition(object, { y: 10 })).toThrow();
});

it('protects an active gesture and clears history on membership changes', async () => {
  const s = setup();
  const object = await s.box();
  const before = objectToRecord(object);
  expect(s.transforms.begin(object)).toBe(true);
  expect(s.transforms.begin(object)).toBe(false);
  expect(s.transforms.isTransforming).toBe(true);
  expect(() => s.transforms.setPosition(object, { x: 10 })).toThrow(
    'active transform',
  );
  object.position.x = 7.123456789;
  expect(s.transforms.read(object).position.x).toBe(7.123456789);
  expect(s.transforms.commit()).toBe(true);
  expect(s.transforms.undo()).toBe(true);
  expect(objectToRecord(object)).toEqual(before);
  await s.box();
  expect(s.transforms.canRedo).toBe(false);
  s.actions.remove(object);
  expect(s.transforms.read(object)).toBeNull();
  expect(() => s.transforms.setPosition(object, { x: 10 })).toThrow(
    'no longer',
  );
});

it('retains object state and history when replacement geometry allocation fails', async () => {
  let fail = false;
  const s = setup({
    ...THREE,
    BoxGeometry: class extends THREE.BoxGeometry {
      constructor(...args) {
        if (fail) throw new Error('allocation failed');
        super(...args);
      }
    },
  });
  const object = await s.box();
  s.transforms.setDimensions(object, { width: 10 });
  const after = objectToRecord(object);
  const geometry = object.children[0].geometry;
  const dispose = vi.spyOn(geometry, 'dispose');
  s.invalidateScene.mockClear();
  fail = true;
  expect(() =>
    s.transforms.update(object, {
      position: { x: 10 },
      dimensions: { width: 20 },
    }),
  ).toThrow('allocation failed');
  expect(() => s.transforms.undo()).toThrow('allocation failed');
  expect(objectToRecord(object)).toEqual(after);
  expect(s.transforms.canUndo).toBe(true);
  expect(dispose).not.toHaveBeenCalled();
  expect(s.invalidateScene).not.toHaveBeenCalled();
  fail = false;
  expect(s.transforms.undo()).toBe(true);
  expect(object.children[0].geometry.parameters.width).toBe(3);
  expect(dispose).toHaveBeenCalledOnce();
});
