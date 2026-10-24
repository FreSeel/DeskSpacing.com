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
  return {
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
      onChange();
      return object;
    },
    remove(object) {
      const index = objects.indexOf(object);
      if (index < 0) return false;
      objects.splice(index, 1);
      scene.remove(object);
      disposeObject(object);
      onChange();
      return true;
    },
    clear() {
      generation++;
      for (const object of [...objects]) this.remove(object);
      deskOffset = 0;
    },
  };
}
