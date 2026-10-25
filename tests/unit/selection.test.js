import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {
  createSelection,
  findObjectRoot,
} from '../../src/interactions/selection.js';
import { bindKeyboard } from '../../src/interactions/keyboard.js';

describe('selection and keyboard ownership', () => {
  it('resolves deeply nested meshes to their registered root', () => {
    const root = new THREE.Group();
    const nested = new THREE.Group();
    const mesh = new THREE.Mesh();
    root.add(nested);
    nested.add(mesh);
    expect(findObjectRoot(mesh, new Set([root]))).toBe(root);
    expect(findObjectRoot(mesh, new Set())).toBeNull();
  });
  it('detaches and removes only the selected object and respects disabled picking', () => {
    const object = { userData: { type: 'Mouse' } };
    const transformControls = { attach: vi.fn(), detach: vi.fn() };
    const removeObject = vi.fn();
    const selection = createSelection({
      THREE,
      transformControls,
      getObjects: () => [object],
      removeObject,
    });
    selection.pick(object);
    selection.pickEnabled = false;
    selection.deletePicked();
    expect(removeObject).not.toHaveBeenCalled();
    selection.pickEnabled = true;
    selection.deletePicked();
    expect(removeObject).toHaveBeenCalledWith(object);
    expect(selection.pickedObject).toBeNull();
    expect(transformControls.detach).toHaveBeenCalled();
  });
  it('keeps text editing and modified shortcuts out of scene actions and removes its listener', () => {
    let listener;
    const host = {
      addEventListener: (_event, fn) => {
        listener = fn;
      },
      removeEventListener: vi.fn(),
    };
    const selection = { deletePicked: vi.fn(), unselectPickedObject: vi.fn() };
    let mode = 'translate';
    const transformControls = {
      getMode: () => mode,
      setMode: vi.fn((value) => {
        mode = value;
      }),
    };
    const target = {
      closest: (selector) =>
        selector === '[data-workspace-shortcuts]' ? {} : null,
    };
    const press = (key) => listener({ key, target, preventDefault: vi.fn() });
    const dispose = bindKeyboard({ host, selection, transformControls });
    listener({ key: 'd', target: { closest: () => ({}) } });
    listener({ key: 'd', ctrlKey: true });
    expect(selection.deletePicked).not.toHaveBeenCalled();
    listener({ key: 'd' }); // Outside workspace scope.
    expect(selection.deletePicked).not.toHaveBeenCalled();
    press('Delete');
    expect(selection.deletePicked).toHaveBeenCalledOnce();
    press('r');
    expect(transformControls.setMode).toHaveBeenLastCalledWith('rotate');
    press('r');
    expect(transformControls.setMode).toHaveBeenLastCalledWith('translate');
    host.document = { querySelector: () => ({}) };
    press('d'); // Open modal suspends scene shortcuts.
    expect(selection.deletePicked).toHaveBeenCalledOnce();
    dispose();
    expect(host.removeEventListener).toHaveBeenCalledWith('keydown', listener);
  });
});

it('notifies only changed selection, including NoSelect, and unsubscribes', () => {
  const object = { userData: { type: 'DeskNoSelect' } };
  const controls = { attach: vi.fn(), detach: vi.fn() };
  const selection = createSelection({
    THREE,
    transformControls: controls,
    getObjects: () => [object],
    removeObject: vi.fn(),
  });
  const listener = vi.fn();
  const unsubscribe = selection.subscribe(listener);
  expect(listener).toHaveBeenLastCalledWith(null);
  selection.pick(object);
  expect(listener).toHaveBeenLastCalledWith(object);
  expect(controls.attach).not.toHaveBeenCalled();
  selection.pick(object);
  expect(listener).toHaveBeenCalledTimes(2);
  selection.deletePicked();
  expect(listener).toHaveBeenLastCalledWith(null);
  unsubscribe();
  selection.pick(object);
  expect(listener).toHaveBeenCalledTimes(3);
});
