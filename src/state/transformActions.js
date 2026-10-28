import {
  createNumericalTransforms,
  localPositionFromWorld,
} from './numericalTransforms.js';

const sameArray = (left, right) =>
  left.length === right.length &&
  left.every((value, index) => value === right[index]);
const equal = (left, right) =>
  ['position', 'rotation', 'scale', 'dimensions'].every((key) =>
    sameArray(left[key] || [], right[key] || []),
  );

// History holds bounded before/after values, never another live scene model.
// Membership changes clear history, including desk shifts and restored scenes.
export function createTransformActions({ state, invalidateScene, factory }) {
  const undo = [],
    redo = [],
    listeners = new Set();
  const numerical = createNumericalTransforms({ factory });
  let pending = null;
  let disposed = false;
  const snapshot = (object) => ({
    position: object.position.toArray(),
    rotation: object.rotation.toArray(),
    scale: object.scale.toArray(),
    dimensions: factory?.primitiveDimensions?.(object) || null,
  });
  const notify = () => listeners.forEach((update) => update());
  const clear = () => {
    pending = null;
    undo.length = redo.length = 0;
    notify();
  };
  const unsubscribe = state.subscribe(clear);
  function apply(object, values) {
    const dimensions = factory?.primitiveDimensions?.(object);
    if (values.dimensions && !sameArray(values.dimensions, dimensions || []))
      factory.resizePrimitive(object, values.dimensions);
    // Allocate geometry before changing transforms, retaining the old state
    // and history if allocation fails.
    if (!sameArray(object.position.toArray(), values.position))
      object.position.fromArray(values.position);
    if (!sameArray(object.rotation.toArray(), values.rotation))
      object.rotation.fromArray(values.rotation);
    if (!sameArray(object.scale.toArray(), values.scale))
      object.scale.fromArray(values.scale);
  }
  function remember(entry) {
    if (equal(entry.before, entry.after)) return false;
    undo.push(entry);
    if (undo.length > 100) undo.shift();
    redo.length = 0;
    return true;
  }
  function restore(source, destination, key) {
    if (disposed || pending || !source.length) return false;
    const entry = source.at(-1);
    if (!state.has(entry.object) || entry.object.parent !== entry.parent) {
      clear();
      return false;
    }
    apply(entry.object, entry[key]);
    source.pop();
    destination.push(entry);
    invalidateScene();
    notify();
    return true;
  }
  function update(object, patch, options) {
    if (disposed || !state.has(object))
      throw new Error('The object is no longer available for editing.');
    if (pending)
      throw new Error('Finish the active transform gesture before editing.');
    const record = numerical.prepare(object, patch, options);
    const before = snapshot(object);
    const after = {
      position: record.position,
      rotation: [...record.rotation, object.rotation.order],
      scale: [...before.scale],
      dimensions: before.dimensions ? record.dimensions : null,
    };
    if (equal(before, after)) return false;
    apply(object, after);
    remember({ object, parent: object.parent, before, after });
    invalidateScene();
    notify();
    return true;
  }
  return {
    // UI reads after an invalidated render to see the final native/snapped
    // transform without polling or dispatching edits.
    read: (object, options) =>
      !disposed && state.has(object) ? numerical.read(object, options) : null,
    update,
    setPosition: (object, position, options) =>
      update(object, { position }, options),
    setRotationDegrees: (object, rotationDegrees) =>
      update(object, { rotationDegrees }),
    setDimensions: (object, dimensions, options) =>
      update(object, { dimensions }, options),
    get canUndo() {
      return !disposed && !pending && undo.length > 0;
    },
    get canRedo() {
      return !disposed && !pending && redo.length > 0;
    },
    get isTransforming() {
      return pending !== null;
    },
    begin(object) {
      if (disposed || pending || !state.has(object)) return false;
      pending = { object, parent: object.parent, before: snapshot(object) };
      notify();
      return true;
    },
    // Internal gesture correction in world inches. The snapping adapter owns
    // begin/commit and native proposals; numerical edits never call it.
    moveWorldPosition(object, position) {
      if (disposed || !state.has(object)) return false;
      const local = localPositionFromWorld(object, position);
      if (object.position.equals(local)) return false;
      object.position.copy(local);
      invalidateScene();
      return true;
    },
    commit() {
      if (!pending) return false;
      const entry = pending;
      pending = null;
      let changed = false;
      if (state.has(entry.object) && entry.object.parent === entry.parent) {
        entry.after = snapshot(entry.object);
        changed = remember(entry);
      }
      notify();
      return changed;
    },
    undo: () => restore(undo, redo, 'before'),
    redo: () => restore(redo, undo, 'after'),
    subscribe(update) {
      if (disposed) return () => {};
      listeners.add(update);
      update();
      return () => listeners.delete(update);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      clear();
      listeners.clear();
    },
  };
}
