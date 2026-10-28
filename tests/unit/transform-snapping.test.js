import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { createObjectStore } from '../../src/state/objectStore.js';
import { createTransformActions } from '../../src/state/transformActions.js';
import { bindSnapping } from '../../src/interactions/snapping.js';
import { createSnappingPreference } from '../../src/snapping/preference.js';
import { createRecord } from '../../src/catalog/configuration.js';
import { objectToRecord } from '../../src/sharing/sceneRecords.js';
import { encodeSetup, decodeSetup } from '../../src/sharing/legacyCodec.js';
import { bindKeyboard } from '../../src/interactions/keyboard.js';

function setup() {
  const events = new Map();
  const host = {
    addEventListener(type, handler) {
      if (!events.has(type)) events.set(type, new Set());
      events.get(type).add(handler);
    },
    removeEventListener(type, handler) {
      events.get(type)?.delete(handler);
    },
    dispatchEvent(event) {
      events.get(event.type)?.forEach((handler) => handler(event));
    },
  };
  const canvas = new THREE.EventDispatcher();
  const state = createObjectStore({
    scene: new THREE.Scene(),
    disposeObject: vi.fn(),
  });
  const object = state.add(new THREE.Group(), createRecord('defaultMouse'));
  object.position.set(0.23, 30.55, -0.23);
  object.rotation.y = 0.3;
  const controls = new THREE.EventDispatcher();
  Object.assign(controls, {
    object,
    mode: 'translate',
    axis: 'XZ',
    getMode: () => controls.mode,
    pointerUp: () => controls.dispatchEvent({ type: 'mouseUp' }),
  });
  const invalidateScene = vi.fn();
  const view = {
    transformControls: controls,
    controls: {},
    camera: new THREE.PerspectiveCamera(),
    invalidateScene,
  };
  const transforms = createTransformActions({ state, invalidateScene });
  const snapping = createSnappingPreference(host);
  const onGuidance = vi.fn();
  const dispose = bindSnapping({
    host,
    canvas,
    view,
    state,
    snapping,
    transforms,
    onGuidance,
  });
  const start = () => controls.dispatchEvent({ type: 'mouseDown' });
  const end = () => controls.dispatchEvent({ type: 'mouseUp' });
  const move = (x, z = -0.23) => {
    object.position.set(x, 30.55, z);
    controls.dispatchEvent({ type: 'objectChange' });
  };
  return {
    host,
    canvas,
    state,
    object,
    controls,
    view,
    transforms,
    snapping,
    dispose,
    start,
    end,
    move,
    onGuidance,
  };
}

it('resolves native proposals with no press jump, one history action, and exact save/undo/redo', () => {
  const s = setup();
  const before = objectToRecord(s.object);
  const scale = s.object.scale.toArray();
  s.snapping.setEnabled(true);
  s.start();
  s.move(0.23);
  expect(s.object.position.x).toBe(0.23);
  for (let i = 1; i <= 30; i++) s.move(i / 3, -i / 4);
  s.move(10, -7.6);
  expect(s.transforms.canUndo).toBe(false);
  s.end();
  const after = objectToRecord(s.object);
  expect(after.position).toEqual([10, 30.55, -8]);
  expect(after.rotation).toEqual(before.rotation);
  expect(s.object.scale.toArray()).toEqual(scale);
  expect(decodeSetup(encodeSetup([after]))).toEqual([after]);
  expect(s.transforms.undo()).toBe(true);
  expect(objectToRecord(s.object)).toEqual(before);
  expect(s.transforms.undo()).toBe(false);
  expect(s.transforms.redo()).toBe(true);
  expect(objectToRecord(s.object)).toEqual(after);
  s.dispose();
});

it('supports free movement, Alt bypass/release, preference toggles without moving, and blur cleanup', () => {
  const s = setup();
  s.start();
  s.move(1.234);
  expect(s.object.position.x).toBe(1.234);
  s.snapping.setEnabled(true);
  expect(s.object.position.x).toBe(1.234);
  s.move(1.234);
  expect(s.object.position.x).toBe(1);
  s.host.dispatchEvent({ type: 'keydown', altKey: true });
  s.move(1.567);
  expect(s.object.position.x).toBe(1.567);
  expect(s.onGuidance).toHaveBeenLastCalledWith(null, true);
  s.host.dispatchEvent({ type: 'keyup', altKey: false });
  s.move(1.567);
  expect(s.object.position.x).toBe(2);
  s.host.dispatchEvent({ type: 'blur' });
  expect(s.transforms.canUndo).toBe(true);
  expect(s.view.controls.enabled).toBe(true);
  s.start();
  s.move(3.1);
  expect(s.object.position.x).toBe(3);
  s.end();
  s.dispose();
  s.start();
  s.move(4.1);
  expect(s.object.position.x).toBe(4.1);
});

it('keeps locked height and dimensions and snaps world space under a transformed parent', () => {
  const s = setup();
  const parent = s.object.parent;
  parent.position.x = 10;
  parent.scale.x = 2;
  s.controls.axis = 'X';
  s.snapping.setEnabled(true);
  s.start();
  s.move(1.7);
  expect(s.object.getWorldPosition(new THREE.Vector3()).x).toBe(13);
  expect(s.object.position.x).toBe(1.5);
  expect(s.object.position.y).toBe(30.55);
  s.end();
});

it('records unsnapped rotation, ignores empty gestures, clears redo on edits and history on membership changes', () => {
  const s = setup();
  s.start();
  s.end();
  expect(s.transforms.canUndo).toBe(false);
  s.controls.mode = 'rotate';
  s.snapping.setEnabled(true);
  s.start();
  s.object.rotation.y = 0.7654321;
  s.controls.dispatchEvent({ type: 'objectChange' });
  s.end();
  expect(s.object.rotation.y).toBe(0.7654321);
  s.transforms.undo();
  expect(s.object.rotation.y).toBe(0.3);
  s.start();
  s.object.rotation.y = 0.567;
  s.end();
  expect(s.transforms.canRedo).toBe(false);
  s.state.deskOffset = 1;
  expect(s.transforms.canUndo).toBe(false);
  s.start();
  s.object.rotation.y = 0.9;
  s.end();
  s.state.remove(s.object);
  expect(s.transforms.undo()).toBe(false);
});

it('routes undo/redo shortcuts only from the workspace and preserves editing/dialog shortcuts', () => {
  const s = setup();
  const transforms = { undo: vi.fn(), redo: vi.fn() };
  const cleanup = bindKeyboard({
    host: s.host,
    transformControls: s.controls,
    selection: {},
    transforms,
  });
  const preventDefault = vi.fn();
  const target = {
    closest: (selector) => selector === '[data-workspace-shortcuts]',
  };
  s.host.dispatchEvent({
    type: 'keydown',
    key: 'z',
    ctrlKey: true,
    target,
    preventDefault,
  });
  expect(transforms.undo).toHaveBeenCalledOnce();
  s.host.dispatchEvent({
    type: 'keydown',
    key: 'z',
    metaKey: true,
    shiftKey: true,
    target,
    preventDefault,
  });
  expect(transforms.redo).toHaveBeenCalledOnce();
  s.host.document = { querySelector: () => true };
  s.host.dispatchEvent({
    type: 'keydown',
    key: 'z',
    ctrlKey: true,
    target,
    preventDefault,
  });
  expect(transforms.undo).toHaveBeenCalledOnce();
  cleanup();
});

it('ends a gesture when asynchronous membership changes invalidate its captured origin', () => {
  const s = setup();
  s.snapping.setEnabled(true);
  s.start();
  s.move(2.6);
  const finish = vi.spyOn(s.controls, 'pointerUp');
  s.state.add(new THREE.Group(), createRecord('QCKSmall'));
  expect(finish).toHaveBeenCalledWith(null);
  expect(s.transforms.canUndo).toBe(false);
  expect(s.view.controls.enabled).toBe(true);
  expect(s.onGuidance).toHaveBeenLastCalledWith(null, false);
});

function surfaceSetup() {
  const s = setup();
  s.object.position.set(-8, 12.4, 0);
  s.object.rotation.set(0, 0, 0);
  s.object.add(
    new THREE.Mesh(
      new THREE.BoxGeometry(2, 4, 2),
      new THREE.MeshBasicMaterial(),
    ),
  );
  const desk = new THREE.Group();
  desk.add(
    new THREE.Mesh(
      new THREE.BoxGeometry(12, 2, 8),
      new THREE.MeshBasicMaterial(),
    ),
  );
  s.state.add(
    desk,
    createRecord('customDesk', { dimensions: [12, 2, 8], texture: 'null' }),
  );
  desk.position.set(0, 9, 0);
  s.view.camera.position.set(0, 30, 50);
  s.view.camera.lookAt(0, 10, 0);
  s.view.camera.updateMatrixWorld();
  s.canvas.clientWidth = 800;
  s.canvas.clientHeight = 600;
  s.snapping.setEnabled(true);
  s.snapping.setGridEnabled(false);
  s.snapping.setSurfaceEnabled(true);
  s.controls.axis = 'X';
  const move = (x, y = 12.4) => {
    s.object.position.set(x, y, 0);
    s.controls.dispatchEvent({ type: 'objectChange' });
  };
  return { ...s, desk, move };
}

it('releases surface contact continuously, bypasses all strategies, and saves one exact undoable transform', () => {
  const s = surfaceSetup();
  const before = objectToRecord(s.object);
  s.start();
  s.move(-8);
  expect(s.object.position.y).toBe(12.4);
  s.move(-5);
  expect(s.object.position.y).toBe(12);
  s.move(7);
  expect(s.object.position.toArray()).toEqual([7, 12, 0]);
  expect(s.onGuidance).toHaveBeenLastCalledWith(null, false);
  s.move(8);
  expect(s.object.position.y).toBe(12);
  s.move(4);
  expect(s.onGuidance.mock.lastCall[0].surface).toBeDefined();
  s.host.dispatchEvent({ type: 'keydown', altKey: true });
  s.move(4.123);
  expect(s.object.position.toArray()).toEqual([4.123, 12, 0]);
  expect(s.onGuidance).toHaveBeenLastCalledWith(null, true);
  s.host.dispatchEvent({ type: 'keyup', altKey: false });
  s.move(4.2);
  expect(s.onGuidance.mock.lastCall[0].surface).toBeDefined();
  s.end();
  const after = objectToRecord(s.object);
  expect(decodeSetup(encodeSetup([after]))).toEqual([after]);
  s.transforms.undo();
  expect(objectToRecord(s.object)).toEqual(before);
  s.transforms.redo();
  expect(objectToRecord(s.object)).toEqual(after);
  s.desk.position.y += 5;
  expect(objectToRecord(s.object)).toEqual(after); // no parent/attachment
  s.dispose();
});

it('allows deliberate vertical release without repeatedly reacquiring and trapping the object', () => {
  const s = surfaceSetup();
  s.controls.axis = 'XYZ';
  s.start();
  s.move(0);
  expect(s.object.position.y).toBe(12);
  s.move(0, 13.4); // within the held vertical band
  expect(s.object.position.y).toBe(12);
  s.move(0, 14.39);
  expect(s.object.position.y).toBe(12);
  s.move(0, 14.41); // fine pointer step across release; no two-inch jump
  expect(s.object.position.y).toBeCloseTo(12.02, 10);
  s.move(0, 14.5); // must not immediately recapture at the rebased height
  expect(s.object.position.y).toBeCloseTo(12.11, 10);
  s.move(0, 15.5);
  expect(s.object.position.y).toBeCloseTo(13.11, 10);
  s.move(0, 15.6);
  expect(s.object.position.y).toBeCloseTo(13.21, 10);
  s.move(0, 15); // deliberate return within acquisition band
  expect(s.object.position.y).toBeCloseTo(12, 10);
  s.end();
  s.dispose();
});

it.each(['surface', 'master'])(
  'disabling %s during contact keeps native height continuous and clears feedback',
  (toggle) => {
    const s = surfaceSetup();
    s.start();
    s.move(0);
    expect(s.object.position.y).toBe(12);
    if (toggle === 'surface') s.snapping.setSurfaceEnabled(false);
    else s.snapping.setEnabled(false);
    expect(s.object.position.y).toBe(12);
    s.move(0.7);
    expect(s.object.position.toArray()).toEqual([0.7, 12, 0]);
    expect(s.onGuidance).toHaveBeenLastCalledWith(null, false);
    s.end();
    s.dispose();
  },
);

it('invalidates a hidden descendant support during a drag and preserves the release height', () => {
  const s = surfaceSetup();
  s.start();
  s.move(0);
  expect(s.onGuidance.mock.lastCall[0].surface).toBeDefined();
  s.desk.children[0].visible = false;
  s.move(1);
  expect(s.onGuidance).toHaveBeenLastCalledWith(null, false);
  expect(s.object.position.y).toBe(12);
  s.end();
  s.dispose();
});

it('drops magnetic guides when the target mesh becomes hidden during the same gesture', () => {
  const s = surfaceSetup();
  s.snapping.setSurfaceEnabled(false);
  s.snapping.setObjectsEnabled(true);
  const peer = new THREE.Group();
  peer.add(
    new THREE.Mesh(
      new THREE.BoxGeometry(2, 4, 2),
      new THREE.MeshBasicMaterial(),
    ),
  );
  s.state.add(peer, createRecord('referenceBox', { dimensions: [2, 4, 2] }));
  peer.position.set(2, 12.4, 5);
  s.start();
  s.move(2.1);
  expect(s.object.position.x).toBeCloseTo(2, 10);
  peer.children[0].visible = false;
  s.move(2.1);
  expect(s.object.position.x).toBe(2.1);
  expect(s.onGuidance).toHaveBeenLastCalledWith(null, false);
  s.end();
  s.dispose();
});

it('preserves the exact native local transform in free mode beneath a rotated, nonuniform parent', () => {
  const s = setup();
  const parent = s.object.parent;
  parent.position.set(8.31, -2.27, 3.14);
  parent.rotation.set(0.13, 0.72, -0.21);
  parent.scale.set(1.37, 0.83, 2.19);
  s.start();
  s.object.position.set(1.23456789, 30.55, -0.987654321);
  const native = s.object.position.toArray();
  s.controls.dispatchEvent({ type: 'objectChange' });
  expect(s.object.position.toArray()).toEqual(native);
  s.end();
  s.dispose();
});
