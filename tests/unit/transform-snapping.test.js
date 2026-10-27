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
