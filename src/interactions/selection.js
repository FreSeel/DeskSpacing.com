export function findObjectRoot(hit, objects) {
  for (let current = hit; current; current = current.parent) {
    if (objects.has(current)) return current;
  }
  return null;
}

export function createSelection({
  THREE,
  camera,
  transformControls,
  getObjects,
  removeObject,
}) {
  const raycaster = new THREE.Raycaster();
  const hits = [];
  const listeners = new Set();
  const notify = () =>
    listeners.forEach((listener) => listener(selection.pickedObject));
  const selection = {
    pickedObject: null,
    pickEnabled: true,
    subscribe(listener) {
      listeners.add(listener);
      listener(selection.pickedObject);
      return () => listeners.delete(listener);
    },
    unselectPickedObject() {
      const changed = selection.pickedObject !== null;
      selection.pickedObject = null;
      transformControls.detach();
      if (changed) notify();
    },
    pick(object) {
      if (!selection.pickEnabled || !object) return;
      transformControls.detach();
      if (!object.userData.type.includes('NoSelect'))
        transformControls.attach(object);
      const changed = selection.pickedObject !== object;
      selection.pickedObject = object;
      if (changed) notify();
    },
    deletePicked() {
      if (selection.pickedObject && selection.pickEnabled) {
        const object = selection.pickedObject;
        selection.unselectPickedObject();
        removeObject(object);
      }
      return getObjects();
    },
    mouseSelect(position) {
      if (!selection.pickEnabled) return;
      const objects = getObjects().filter(
        (object) => !object.userData.type.includes('NoSelect'),
      );
      const roots = new Set(objects);
      camera.updateMatrixWorld();
      for (const object of objects) object.updateWorldMatrix(true, true);
      raycaster.setFromCamera(position, camera);
      // Raycaster orders hits by distance. Resolve nested meshes to the owned root.
      hits.length = 0;
      raycaster.intersectObjects(objects, true, hits);
      for (const hit of hits) {
        const root = findObjectRoot(hit.object, roots);
        if (root && !root.userData.type.includes('NoSelect')) {
          selection.pick(root);
          break;
        }
      }
      hits.length = 0;
    },
  };
  return selection;
}
