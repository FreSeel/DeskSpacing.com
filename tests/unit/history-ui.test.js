import { expect, it, vi } from 'vitest';
import { bindHistoryUI } from '../../src/ui/historyUI.js';
import { bindKeyboard } from '../../src/interactions/keyboard.js';
function target() {
  const listeners = new Map();
  return {
    disabled: true,
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name) => listeners.delete(name),
    fire: (name, event) => listeners.get(name)?.(event),
    listeners,
  };
}
it('updates button availability and removes subscriptions and click listeners', () => {
  const undo = target(),
    redo = target();
  let update;
  const unsubscribe = vi.fn();
  const history = {
    canUndo: false,
    canRedo: false,
    undo: vi.fn(),
    redo: vi.fn(),
    subscribe(fn) {
      update = fn;
      fn();
      return unsubscribe;
    },
  };
  const dispose = bindHistoryUI({
    document: {
      getElementById: (id) => (id === 'undoTransform' ? undo : redo),
    },
    history,
    onError: vi.fn(),
  });
  expect(undo.disabled).toBe(true);
  expect(redo.disabled).toBe(true);
  history.canUndo = true;
  update();
  expect(undo.disabled).toBe(false);
  undo.fire('click');
  expect(history.undo).toHaveBeenCalledOnce();
  history.canUndo = false;
  history.canRedo = true;
  update();
  expect(redo.disabled).toBe(false);
  dispose();
  expect(unsubscribe).toHaveBeenCalledOnce();
  expect(undo.listeners.size + redo.listeners.size).toBe(0);
});
it('preserves native undo in editable fields, prevents default only on success and cleans up keyboard listeners', () => {
  const host = target();
  const history = { undo: vi.fn(() => false), redo: vi.fn(() => true) };
  const cleanup = bindKeyboard({
    host,
    history,
    selection: {},
    transformControls: {},
  });
  const event = {
    key: 'z',
    ctrlKey: true,
    target: { closest: (selector) => selector === '.editor-shell' },
    preventDefault: vi.fn(),
  };
  host.fire('keydown', event);
  expect(event.preventDefault).not.toHaveBeenCalled();
  for (const editable of ['input', 'textarea', 'select', 'contenteditable']) {
    host.fire('keydown', {
      ...event,
      target: {
        closest: (selector) => (selector.startsWith('input') ? editable : true),
      },
    });
  }
  expect(history.undo).toHaveBeenCalledOnce();
  host.fire('keydown', { ...event, key: 'y' });
  expect(history.redo).toHaveBeenCalledOnce();
  expect(event.preventDefault).toHaveBeenCalledOnce();
  cleanup();
  expect(host.listeners.size).toBe(0);
});
