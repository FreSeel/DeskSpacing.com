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
    const transformControls = { setMode: vi.fn() };
    const dispose = bindKeyboard({ host, selection, transformControls });
    listener({ key: 'd', target: { closest: () => ({}) } });
    listener({ key: 'd', ctrlKey: true });
    expect(selection.deletePicked).not.toHaveBeenCalled();
    listener({ key: 'Delete' });
    expect(selection.deletePicked).toHaveBeenCalledOnce();
    listener({ key: 'r' });
    expect(transformControls.setMode).toHaveBeenLastCalledWith('rotate');
    listener({ key: 'r' });
    expect(transformControls.setMode).toHaveBeenLastCalledWith('translate');
    dispose();
    expect(host.removeEventListener).toHaveBeenCalledWith('keydown', listener);
  });
});
