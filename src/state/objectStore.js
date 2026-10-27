// Owns membership and identity. Three.js transforms remain the source of truth;
// saving takes a plain-data snapshot rather than maintaining a second mutable copy.
export function createObjectStore({
  scene,
  disposeObject,
  onChange = () => {},
}) {
  const objects = [];
  let generation = 0;
  let deskOffset = 0;
  const listeners = new Set();
  const changed = () => {
    onChange();
    listeners.forEach((update) => update());
  };
  return {
    subscribe(update) {
      listeners.add(update);
      return () => listeners.delete(update);
    },
    get objects() {
      return [...objects];
    },
    get generation() {
      return generation;
    },
    get deskOffset() {
      return deskOffset;
    },
    set deskOffset(value) {
      deskOffset = value;
      changed();
    },
    invalidate() {
      return ++generation;
    },
    has(object) {
      return objects.includes(object);
    },
    add(object, record) {
      let next = 0;
      for (const existing of objects) {
        if (existing.userData.objectName === record.product) {
          next = Math.max(next, Number(existing.name.split('-').at(-1)) + 1);
        }
      }
      object.name = `${record.product}-${next}`;
      object.userData.type = record.type;
      object.userData.objectName = record.product;
      object.position.set(...record.position);
      object.rotation.set(...record.rotation);
      objects.push(object);
      scene.add(object);
      changed();
      return object;
    },
    remove(object) {
      const index = objects.indexOf(object);
      if (index < 0) return false;
      objects.splice(index, 1);
      scene.remove(object);
      disposeObject(object);
      changed();
      return true;
    },
    clear() {
      generation++;
      for (const object of [...objects]) this.remove(object);
      deskOffset = 0;
      changed();
    },
  };
}
