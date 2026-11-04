import { importedType } from '../projects/projectRecords.js';
import { readPrimitiveDimensions } from '../models/primitiveGeometry.js';

// This is the only codec adapter aware of Three.js. The wire format stays plain data.
export function objectToRecord(object) {
  const record = {
    type: object.userData.type,
    product: object.userData.objectName,
    position: object.position.toArray(),
    rotation: object.rotation.toArray().slice(0, 3),
  };
  if (record.type === importedType) {
    delete record.product;
    record.objectId = object.userData.objectId;
    record.asset = { ...object.userData.asset };
    record.scale = object.scale.toArray();
  }
  if (record.type.includes('Primitive')) {
    const mesh = object.children[0];
    record.dimensions = readPrimitiveDimensions(object);
    record.texture = mesh.material.name;
  }
  return record;
}
