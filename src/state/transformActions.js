import {
  createNumericalTransforms,
  localPositionFromWorld,
} from './numericalTransforms.js';
import {
  createHistory,
  captureValues,
  sameValues,
  sameArray,
  applyTransformValues,
} from './history.js';

export function createTransformActions({
  state,
  invalidateScene,
  factory,
  history: sharedHistory,
}) {
  const history =
    sharedHistory || createHistory({ state, factory, invalidateScene });
  const numerical = createNumericalTransforms({ factory });
  let gesture = null;
  let disposed = false;
  const unsubscribe = history.subscribe(() => {
    if (!history.isPending) gesture = null;
  });
  function update(object, patch, options) {
    if (disposed || !state.has(object))
      throw new Error('The object is no longer available for editing.');
    if (history.isPending && !history.isTransacting)
      throw new Error('Finish the active transform gesture before editing.');
    const record = numerical.prepare(object, patch, options);
    const before = captureValues(object, factory);
    const after = {
      position: record.position,
      rotation: [...record.rotation, object.rotation.order],
      scale: record.scale || before.scale,
      dimensions: before.dimensions ? record.dimensions : null,
    };
    if (sameValues(before, after)) return false;
    return history.transaction('Transform object', () => {
      if (
        after.dimensions &&
        !sameArray(after.dimensions, before.dimensions || [])
      )
        factory.resizePrimitive(object, after.dimensions);
      applyTransformValues(object, after);
      invalidateScene();
      return true;
    });
  }
  return {
    // UI reads live transforms after rendering, including the snapped result.
    read: (object, options) =>
      !disposed && state.has(object) ? numerical.read(object, options) : null,
    update,
    setPosition: (object, position, options) =>
      update(object, { position }, options),
    setRotationDegrees: (object, rotationDegrees) =>
      update(object, { rotationDegrees }),
    setScale: (object, scale) =>
      update(object, {
        scale:
          typeof scale === 'number' ? { x: scale, y: scale, z: scale } : scale,
      }),
    setDimensions: (object, dimensions, options) =>
      update(object, { dimensions }, options),
    // Compatibility aliases; there is only one history for all editing actions.
    get canUndo() {
      return history.canUndo;
    },
    get canRedo() {
      return history.canRedo;
    },
    get isTransforming() {
      return history.isPending && !history.isTransacting;
    },
    begin(object) {
      if (disposed || history.isPending || !state.has(object)) return false;
      if (!history.begin('Transform object')) return false;
      gesture = { object, parent: object.parent };
      return true;
    },
    // The snapping adapter owns begin/commit; restores never enter this path.
    moveWorldPosition(object, position) {
      if (disposed || !state.has(object)) return false;
      const local = localPositionFromWorld(object, position);
      if (object.position.equals(local)) return false;
      object.position.copy(local);
      invalidateScene();
      return true;
    },
    commit() {
      if (!gesture) return false;
      const entry = gesture;
      gesture = null;
      if (!state.has(entry.object) || entry.object.parent !== entry.parent) {
        history.clear();
        return false;
      }
      return history.commit();
    },
    cancel() {
      if (!gesture) return false;
      gesture = null;
      return history.cancel();
    },
    undo: history.undo,
    redo: history.redo,
    subscribe: history.subscribe,
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      gesture = null;
      if (!sharedHistory) history.dispose();
    },
  };
}
