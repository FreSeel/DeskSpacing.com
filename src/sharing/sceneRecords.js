// This is the only codec adapter aware of Three.js. The wire format stays plain data.
export function objectToRecord(object) {
  const record = {
    type: object.userData.type,
    product: object.userData.objectName,
    position: object.position.toArray(),
    rotation: object.rotation.toArray().slice(0, 3),
  };
  if (record.type.includes('Primitive')) {
    const mesh = object.children[0];
    const dimensions = mesh.geometry.parameters;
    record.dimensions = record.type.includes('Sphere')
      ? [Number(dimensions.radius), -1, -1]
      : [dimensions.width, dimensions.height, dimensions.depth].map(Number);
    record.texture = mesh.material.name;
  }
  return record;
}
