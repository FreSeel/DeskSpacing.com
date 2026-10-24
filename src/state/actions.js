import { createRecord, defaults, isDesk } from '../catalog/configuration.js';
import { deskOffsets } from '../catalog/products.js';
import { validateRecords } from '../sharing/legacyCodec.js';

export function createActions({ state, selection, factory }) {
  function remove(object) {
    if (selection.pickedObject === object) selection.unselectPickedObject();
    state.remove(object);
  }
  function reset() {
    selection.unselectPickedObject();
    state.clear();
  }
  async function add(product, options = {}) {
    selection.pickEnabled = true;
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
    const generation = state.generation;
    const object = await factory.create(record);
    if (generation !== state.generation || (target && !state.has(target))) {
      factory.dispose(object);
      return null;
    }
    // Allocate identity before removal, matching existing instance names.
    state.add(object, record);
    if (target) remove(target);
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
    // Primitive desks/floors historically did not attach the gizmo on creation.
    if (!record.dimensions || !record.type.includes('NoSelect'))
      selection.pick(object);
    return object;
  }

  async function restore(records) {
    validateRecords(records);
    const generation = state.invalidate();
    // Load into temporary ownership; a failed asset leaves the current setup intact.
    const results = await Promise.allSettled(
      records.map((record) => factory.create(record)),
    );
    const failed = results.find((result) => result.status === 'rejected');
    if (generation !== state.generation || failed) {
      for (const result of results)
        if (result.status === 'fulfilled') factory.dispose(result.value);
      if (failed && generation === state.generation) throw failed.reason;
      return false;
    }
    reset();
    selection.pickEnabled = true;
    records.forEach((record, index) => {
      const object = state.add(results[index].value, record);
      if (isDesk(record.product))
        state.deskOffset = deskOffsets[record.product];
      if (!record.dimensions) selection.pick(object);
    });
    return true;
  }
  async function initialize() {
    // Independent requests preserve the responsive default-loading behavior.
    return Promise.all(
      defaults.map(({ product, ...options }) => add(product, options)),
    );
  }
  return { add, remove, reset, restore, initialize };
}
