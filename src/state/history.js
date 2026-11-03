export const sameArray = (left, right) =>
  left.length === right.length &&
  left.every((value, index) => value === right[index]);

export const sameValues = (left, right) =>
  ['position', 'rotation', 'scale', 'dimensions'].every((key) =>
    sameArray(left[key] || [], right[key] || []),
  );

export function captureValues(object, factory) {
  return {
    position: object.position.toArray(),
    rotation: object.rotation.toArray(),
    scale: object.scale.toArray(),
    dimensions: factory?.primitiveDimensions?.(object) || null,
  };
}

export function applyTransformValues(object, values) {
  if (!sameArray(object.position.toArray(), values.position))
    object.position.fromArray(values.position);
  if (!sameArray(object.rotation.toArray(), values.rotation))
    object.rotation.fromArray(values.rotation);
  if (!sameArray(object.scale.toArray(), values.scale))
    object.scale.fromArray(values.scale);
}

// Bounded checkpoints of editable values, with retained instance identities.
// Live Three.js objects remain authoritative; no geometry/texture is copied.
export function createHistory({
  state,
  selection,
  factory,
  invalidateScene = () => {},
  limit = 100,
}) {
  if (!Number.isInteger(limit) || limit < 1)
    throw new Error('History limit must be a positive integer.');
  const undo = [],
    redo = [],
    listeners = new Set();
  let pending = null;
  let mutating = 0;
  let restoring = false;
  let disposed = false;
  let enabled = true;
  const notify = () => listeners.forEach((update) => update());
  const capture = () => ({
    entries: state.objects.map((object) => ({
      object,
      parent: object.parent,
      values: captureValues(object, factory),
    })),
    deskOffset: state.deskOffset,
    selected: selection?.pickedObject || null,
  });
  const retain = (snapshot) =>
    snapshot.entries.forEach(({ object }) => state.retain(object));
  const release = (snapshot) =>
    snapshot.entries.forEach(({ object }) => state.release(object));
  function discard(stack) {
    for (const entry of stack.splice(0)) {
      release(entry.before);
      release(entry.after);
    }
  }
  function clear() {
    if (pending) release(pending.before);
    pending = null;
    discard(undo);
    discard(redo);
    notify();
  }
  const equal = (left, right) =>
    left.deskOffset === right.deskOffset &&
    left.entries.length === right.entries.length &&
    left.entries.every((entry, index) => {
      const other = right.entries[index];
      return (
        entry.object === other.object &&
        entry.parent === other.parent &&
        sameValues(entry.values, other.values)
      );
    });

  function begin(label = 'Edit setup') {
    if (disposed || restoring || pending) return false;
    const before = capture();
    retain(before);
    pending = { label, before };
    notify();
    return true;
  }
  function commit() {
    if (!pending || restoring) return false;
    const entry = pending;
    const after = capture();
    pending = null;
    const changed = !equal(entry.before, after);
    if (changed && enabled) {
      retain(after);
      undo.push({ ...entry, after });
      discard(redo);
      if (undo.length > limit) discard(undo.splice(0, undo.length - limit));
    } else release(entry.before);
    notify();
    return changed;
  }

  function apply(snapshot) {
    // All fallible geometry allocations happen before any scene mutation.
    const resizes = [];
    try {
      for (const { object, values } of snapshot.entries) {
        if (
          values.dimensions &&
          !sameArray(
            values.dimensions,
            factory?.primitiveDimensions?.(object) || [],
          )
        ) {
          resizes.push(
            factory.preparePrimitiveResize(object, values.dimensions),
          );
        }
      }
    } catch (error) {
      resizes.forEach((resize) => resize.cancel());
      throw error;
    }
    restoring = true;
    try {
      // Undo also cancels asynchronous loads started against the old setup.
      state.invalidate();
      state.batch(() => {
        const objects = new Set(snapshot.entries.map(({ object }) => object));
        const current = selection?.pickedObject;
        const membershipChanged =
          state.objects.length !== objects.size ||
          state.objects.some((object) => !objects.has(object));
        const selected =
          !membershipChanged || objects.has(current)
            ? current
            : objects.has(snapshot.selected)
              ? snapshot.selected
              : null;
        if (current && !objects.has(current)) selection.unselectPickedObject();
        resizes.forEach((resize) => resize.commit());
        snapshot.entries.forEach(({ object, values }) =>
          applyTransformValues(object, values),
        );
        state.restoreMembership(snapshot.entries);
        if (state.deskOffset !== snapshot.deskOffset)
          state.deskOffset = snapshot.deskOffset;
        if (selected && selection?.pickedObject !== selected) {
          selection.pickEnabled = true;
          selection.pick(selected);
        }
      });
      invalidateScene();
    } finally {
      restoring = false;
    }
  }
  function cancel() {
    if (!pending || disposed) return false;
    const entry = pending;
    if (!equal(capture(), entry.before)) apply(entry.before);
    pending = null;
    release(entry.before);
    notify();
    return true;
  }
  function transaction(label, edit) {
    if (disposed || restoring) throw new Error('History is unavailable.');
    if (mutating) return edit();
    if (pending) throw new Error('Finish the active gesture before editing.');
    mutating++;
    try {
      return state.batch(() => {
        begin(label);
        try {
          const result = edit();
          if (result?.then)
            throw new Error(
              'History transactions must be synchronous. Load assets before committing.',
            );
          commit();
          return result;
        } catch (error) {
          cancel();
          throw error;
        }
      });
    } finally {
      mutating--;
    }
  }
  function travel(source, destination, key) {
    if (disposed || !enabled || pending || restoring || !source.length)
      return false;
    const entry = source.at(-1);
    apply(entry[key]);
    source.pop();
    destination.push(entry);
    notify();
    return true;
  }
  // Raw store edits outside actions cannot safely be mixed with checkpoints.
  const unsubscribe = state.subscribe(() => {
    if (!mutating && !restoring) clear();
  });
  return {
    begin,
    commit,
    cancel,
    transaction,
    clear,
    undo: () => travel(undo, redo, 'before'),
    redo: () => travel(redo, undo, 'after'),
    get canUndo() {
      return !disposed && enabled && !pending && !restoring && undo.length > 0;
    },
    get canRedo() {
      return !disposed && enabled && !pending && !restoring && redo.length > 0;
    },
    get isPending() {
      return pending !== null;
    },
    get isRestoring() {
      return restoring;
    },
    get isTransacting() {
      return mutating > 0;
    },
    setEnabled(value) {
      enabled = Boolean(value);
      clear();
    },
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
