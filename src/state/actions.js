import { createRecord, defaults, isDesk } from '../catalog/configuration.js';
import { deskOffsets } from '../catalog/products.js';
import { limits, validateRecords } from '../sharing/legacyCodec.js';
import { createTransformActions } from './transformActions.js';
import { createSpacingActions } from './spacingActions.js';
import { createHistory, sameArray } from './history.js';
import { objectToRecord } from '../sharing/sceneRecords.js';
import {
  importedType,
  validateProjectRecords,
} from '../projects/projectRecords.js';
import { createSurfaceGeometry } from '../snapping/surfaceGeometry.js';
import { supportsPosition } from '../snapping/surface.js';

export function createActions({
  state,
  selection,
  factory,
  invalidateScene = () => {},
  historyLimit = 100,
}) {
  const history = createHistory({
    state,
    selection,
    factory,
    invalidateScene,
    limit: historyLimit,
  });
  const transforms = createTransformActions({
    state,
    invalidateScene,
    factory,
    history,
  });
  const spacing = createSpacingActions({ state, transforms });
  let latestDeskRequest = 0;
  function removeObject(object) {
    if (selection.pickedObject === object) selection.unselectPickedObject();
    return state.remove(object);
  }
  function clearObjects() {
    selection.unselectPickedObject();
    state.clear();
  }
  // A load can finish during a gesture. Commit its final live transform first;
  // membership notifications then end the native gizmo and clear snap guides.
  function edit(label, mutation) {
    transforms.commit();
    return history.transaction(label, mutation);
  }
  function remove(object) {
    if (!state.has(object)) return false;
    return edit('Delete object', () => removeObject(object));
  }
  function reset() {
    return edit('Clear setup', clearObjects);
  }
  function requireCapacity(target) {
    if (!target && state.objects.length >= limits.objects)
      throw new Error(
        `The scene has reached its supported ${limits.objects}-object limit.`,
      );
  }
  async function add(product, options = {}) {
    const desk = isDesk(product);
    const target = desk
      ? state.objects.find((object) => object.userData.type.includes('Desk'))
      : options.replace
        ? selection.pickedObject
        : null;
    // Capture both identity and placement at click time, never at load completion.
    const record = createRecord(product, {
      ...options,
      deskOffset: state.deskOffset,
    });
    if (target && !desk) {
      record.position[0] = target.position.x;
      record.position[2] = target.position.z;
    }
    validateRecords([record]);
    // A newer valid desk request supersedes every older pending desk load.
    const deskRequest = desk ? ++latestDeskRequest : 0;
    const generation = state.generation;
    const stale = () =>
      generation !== state.generation ||
      (desk && deskRequest !== latestDeskRequest) ||
      (target && !state.has(target));
    let object;
    try {
      object = await factory.create(record);
    } catch (error) {
      if (desk && stale()) return null;
      throw error;
    }
    let stored = false;
    try {
      if (stale()) return null;
      requireCapacity(target);
      return edit(target ? 'Replace object' : 'Add object', () => {
        if (stale()) return null;
        requireCapacity(target);
        // Allocate identity before removal, matching existing instance names.
        state.add(object, record);
        stored = true;
        if (target) removeObject(target);
        if (desk) {
          const offset = deskOffsets[product];
          const difference = offset - state.deskOffset;
          for (const existing of state.objects) {
            if (
              existing !== object &&
              !existing.userData.type.includes('Furniture')
            )
              existing.position.y += difference;
          }
          state.deskOffset = offset;
        }
        selection.pickEnabled = true;
        // Inspect desks after creation; selection keeps their manipulation lock.
        if (desk || !record.dimensions || !record.type.includes('NoSelect'))
          selection.pick(object);
        return object;
      });
    } finally {
      if (!stored && !state.has(object)) factory.dispose(object);
    }
  }

  const surfaces = createSurfaceGeometry();
  function importPosition() {
    const position = { x: 0, y: 0, z: -57 };
    const origin = { x: 0, y: 0, z: 0 };
    const desk = state.objects.find((object) =>
      isDesk(object.userData.objectName),
    );
    const floor = state.objects.find(
      (object) => object.userData.objectName === 'floor',
    );
    const target =
      (desk && surfaces.target(desk)) || (floor && surfaces.target(floor));
    if (!target)
      return [position.x, desk ? 31.7 + state.deskOffset : 0, position.z];
    if (
      !supportsPosition(target, { center: origin, origin, minY: 0 }, position)
    ) {
      const [a, b, c] = target.triangles[0];
      position.x = (a.x + b.x + c.x) / 3;
      position.z = (a.z + b.z + c.z) / 3;
    }
    return [position.x, target.height, position.z];
  }

  async function addImported(
    record,
    { blob, signal, place, target, duplicate } = {},
  ) {
    validateProjectRecords([record]);
    const generation = state.generation;
    const object = await factory.createImported(record, { blob, signal });
    let stored = false;
    try {
      signal.throwIfAborted();
      if (
        generation !== state.generation ||
        (target && !state.has(target)) ||
        (duplicate && !state.has(duplicate))
      )
        return null;
      requireCapacity(target);
      return edit(
        target ? 'Recover model' : place ? 'Import model' : 'Duplicate model',
        () => {
          requireCapacity(target);
          if (place) record = { ...record, position: importPosition() };
          if (target) removeObject(target);
          state.add(object, record);
          stored = true;
          selection.pickEnabled = true;
          selection.pick(object);
          return object;
        },
      );
    } finally {
      if (!stored && !state.has(object)) factory.dispose(object);
    }
  }

  async function restore(records) {
    validateRecords(records);
    const current = state.objects.map(objectToRecord);
    if (
      records.length === current.length &&
      records.every((record, index) => {
        const previous = current[index];
        return (
          record.type === previous.type &&
          record.product === previous.product &&
          record.texture === previous.texture &&
          ['position', 'rotation', 'dimensions'].every((key) =>
            sameArray(record[key] || [], previous[key] || []),
          )
        );
      })
    )
      return false;
    return restoreRecords(
      records,
      (record) => factory.create(record),
      state.invalidate(),
    );
  }

  function restoreProject(records, { files, signal, generation }) {
    validateProjectRecords(records);
    return restoreRecords(
      records,
      (record) =>
        record.type === importedType
          ? factory.createImported(record, {
              blob: files.get(record.asset.id),
              signal,
              allowMissing: true,
            })
          : factory.create(record),
      generation,
      signal,
      4,
    );
  }

  async function restoreRecords(
    records,
    create,
    generation,
    signal,
    batchSize = records.length || 1,
  ) {
    const loaded = [];
    const stale = () => generation !== state.generation || signal?.aborted;
    let committed = false;
    try {
      // Stage instances in temporary ownership until the whole restore is ready.
      // Limit concurrent downloads when restoring projects with external assets.
      for (let start = 0; start < records.length; start += batchSize) {
        if (stale()) return false;
        const results = await Promise.allSettled(
          records.slice(start, start + batchSize).map(create),
        );
        for (const result of results)
          if (result.status === 'fulfilled') loaded.push(result.value);
        if (stale()) return false;
        const failure = results.find((result) => result.status === 'rejected');
        if (failure) throw failure.reason;
      }
      if (stale()) return false;
      committed = edit('Restore setup', () => {
        clearObjects();
        selection.pickEnabled = true;
        records.forEach((record, index) => {
          const object = state.add(loaded[index], record);
          if (isDesk(record.product))
            state.deskOffset = deskOffsets[record.product];
          if (!record.dimensions && !object.userData.missingAsset)
            selection.pick(object);
        });
        return true;
      });
      return committed;
    } finally {
      if (!committed)
        for (const object of loaded)
          if (!state.has(object)) factory.dispose(object);
    }
  }
  async function initialize() {
    // Independent requests preserve the responsive default-loading behavior.
    const results = await Promise.allSettled(
      defaults.map(({ product, ...options }) => add(product, options)),
    );
    // Keep readiness/loading accurate even when one request fails early.
    const failed = results.find((result) => result.status === 'rejected');
    if (failed) throw failed.reason;
  }
  function dispose() {
    transforms.dispose();
    history.dispose();
    clearObjects();
  }
  return {
    add,
    addImported,
    restoreProject,
    remove,
    reset,
    restore,
    initialize,
    transforms,
    spacing,
    history,
    dispose,
  };
}
