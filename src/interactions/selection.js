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
  const selection = {
    pickedObject: null,
    pickEnabled: true,
    unselectPickedObject() {
      selection.pickedObject = null;
      transformControls.detach();
    },
    pick(object) {
      if (!selection.pickEnabled || !object) return;
      transformControls.detach();
      if (!object.userData.type.includes('NoSelect'))
        transformControls.attach(object);
      selection.pickedObject = object;
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
