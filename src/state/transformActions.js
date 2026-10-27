const snapshot = (object) => ({
  position: object.position.toArray(),
  rotation: object.rotation.toArray(),
  scale: object.scale.toArray(),
});
const equal = (left, right) =>
  ['position', 'rotation', 'scale'].every((key) =>
    left[key].every((value, index) => value === right[key][index]),
  );

// Bounded gesture snapshots are history, not a parallel live scene model.
// Membership changes clear this transform-only history (including desk shifts).
export function createTransformActions({ state, invalidateScene }) {
  const undo = [],
    redo = [],
    listeners = new Set();
  let pending = null;
  const notify = () => listeners.forEach((update) => update());
  const clear = () => {
    pending = null;
    undo.length = redo.length = 0;
    notify();
  };
  const unsubscribe = state.subscribe(clear);
  function restore(source, destination, key) {
    if (pending || !source.length) return false;
    const entry = source.pop();
    if (!state.has(entry.object)) {
      clear();
      return false;
    }
    entry.object.position.fromArray(entry[key].position);
    entry.object.rotation.fromArray(entry[key].rotation);
    entry.object.scale.fromArray(entry[key].scale);
    destination.push(entry);
    invalidateScene();
    notify();
    return true;
  }
  return {
    get canUndo() {
      return !pending && undo.length > 0;
    },
    get canRedo() {
      return !pending && redo.length > 0;
    },
    begin(object) {
      if (!state.has(object)) return;
      pending = { object, before: snapshot(object) };
      notify();
    },
    moveWorldPosition(object, position) {
      if (!state.has(object)) return;
      const local = object.position
        .clone()
        .set(position.x, position.y, position.z);
      object.parent?.worldToLocal(local);
      object.position.copy(local);
      invalidateScene();
    },
    commit() {
      if (!pending) return;
      const entry = pending;
      pending = null;
      if (state.has(entry.object)) {
        entry.after = snapshot(entry.object);
        if (!equal(entry.before, entry.after)) {
          undo.push(entry);
          if (undo.length > 100) undo.shift();
          redo.length = 0;
        }
      }
      notify();
    },
    undo: () => restore(undo, redo, 'before'),
    redo: () => restore(redo, undo, 'after'),
    subscribe(update) {
      listeners.add(update);
      update();
      return () => listeners.delete(update);
    },
    dispose() {
      unsubscribe();
      clear();
      listeners.clear();
    },
  };
}
