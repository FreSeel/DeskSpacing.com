// Primitive parameters, not Float32 vertex bounds, retain the exact requested
// size. Both history and the legacy writer read the current geometry here.
export function readPrimitiveDimensions(object) {
  if (!object.userData.type?.includes('Primitive')) return null;
  const parameters = object.children[0]?.geometry?.parameters;
  if (!parameters) return null;
  return object.userData.type.includes('Sphere')
    ? [Number(parameters.radius), -1, -1]
    : [parameters.width, parameters.height, parameters.depth].map(Number);
}

export function createPrimitiveGeometry(THREE, type, dimensions) {
  return type.includes('Sphere')
    ? // Preserve r116's detail=5 tessellation with modern detail=31.
      new THREE.OctahedronGeometry(dimensions[0], 31)
    : new THREE.BoxGeometry(...dimensions);
}
