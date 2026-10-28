import { Matrix4, Vector3 } from 'three';
import { createObjectDimensions } from '../measurements/objectDimensions.js';
import {
  defaultUnit,
  fromInches,
  toInches,
  radiansToDegrees,
  degreesToRadians,
} from '../measurements/units.js';
import { objectToRecord } from '../sharing/sceneRecords.js';
import { limits, validateRecords } from '../sharing/legacyCodec.js';

const axes = ['x', 'y', 'z'];
const dimensionAxes = { width: 'x', height: 'y', depth: 'z' };
const dimensionIndices = { width: 0, height: 1, depth: 2 };
const identity = new Matrix4();

function unitOption({ unit = defaultUnit } = {}) {
  if (unit !== 'cm' && unit !== 'in')
    throw new Error('Transformation units must be cm or in.');
  return unit;
}

function patchFields(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be a field patch.`);
  const fields = Object.keys(value);
  if (fields.some((key) => !allowed.includes(key)))
    throw new Error(`Unsupported ${label} field.`);
  return fields;
}

function finite(value, label) {
  if (!Number.isFinite(value))
    throw new Error(`${label} must be a finite number.`);
}

function invertibleParent(object) {
  object.parent?.updateWorldMatrix(true, false);
  const determinant = object.parent?.matrixWorld.determinant() ?? 1;
  return Number.isFinite(determinant) && determinant !== 0;
}

export function localPositionFromWorld(object, position) {
  if (!invertibleParent(object))
    throw new Error('The parent transform cannot be inverted.');
  const local = new Vector3(position.x, position.y, position.z);
  object.parent?.worldToLocal(local);
  if (!local.toArray().every(Number.isFinite))
    throw new Error('Position must have finite local coordinates.');
  return local;
}

// Geometry parameters are editable only in the primitive frame the factory
// creates and the legacy format can restore. No scale is baked into vertices.
function canonicalPrimitiveFrame(object) {
  object.updateWorldMatrix(true, true);
  return (
    object.parent?.isScene === true &&
    object.parent.matrixWorld.equals(identity) &&
    object.scale.toArray().every((value) => value === 1) &&
    object.children[0]?.matrix.equals(identity)
  );
}

export function createNumericalTransforms({ factory } = {}) {
  const readers = new WeakMap();
  const primitiveDimensions = (object) =>
    factory?.primitiveDimensions?.(object);

  function capabilities(object) {
    const movable =
      !object.userData.type?.includes('NoSelect') &&
      object.rotation.order === 'XYZ';
    let dimensions = [];
    if (
      factory?.resizePrimitive &&
      object.rotation.order === 'XYZ' &&
      primitiveDimensions(object) &&
      canonicalPrimitiveFrame(object)
    ) {
      const product = object.userData.objectName;
      if (product === 'referenceBox' && movable)
        dimensions = ['width', 'height', 'depth'];
      else if (product === 'referenceSphere' && movable)
        dimensions = ['diameter'];
      else if (product === 'customDesk') dimensions = ['width', 'depth'];
    }
    return {
      position: movable && invertibleParent(object) ? [...axes] : [],
      rotationDegrees: movable ? [...axes] : [],
      dimensions,
    };
  }

  function read(object, options) {
    const unit = unitOption(options);
    const position = object.getWorldPosition(new Vector3());
    const parameters = primitiveDimensions(object);
    let dimensions = null;
    // Avoid feeding Float32 bounding-box error back into an editable parameter.
    // Catalog and noncanonical objects still use actual derived model bounds.
    if (parameters && canonicalPrimitiveFrame(object)) {
      const sphere = object.userData.type.includes('Sphere');
      dimensions = Object.fromEntries(
        Object.entries(dimensionIndices).map(([name, index]) => [
          name,
          fromInches(sphere ? parameters[0] * 2 : parameters[index], unit),
        ]),
      );
      if (sphere) dimensions.diameter = dimensions.width;
    } else {
      if (!readers.has(object)) readers.set(object, createObjectDimensions());
      const measurement = readers.get(object).read(object);
      if (measurement)
        dimensions = Object.fromEntries(
          Object.entries(dimensionAxes).map(([name, axis]) => [
            name,
            fromInches(measurement.dimensions[axis], unit),
          ]),
        );
    }
    return {
      unit,
      positionSpace: 'world',
      position: Object.fromEntries(
        axes.map((axis) => [axis, fromInches(position[axis], unit)]),
      ),
      rotationSpace: 'local',
      rotationOrder: object.rotation.order,
      rotationDegrees: Object.fromEntries(
        axes.map((axis) => [axis, radiansToDegrees(object.rotation[axis])]),
      ),
      dimensions,
      capabilities: capabilities(object),
    };
  }

  // Build a serializable candidate without mutating any scene values. The
  // action applies it only after every field and cross-field constraint passes.
  function prepare(object, patch, options) {
    const unit = unitOption(options);
    const sections = patchFields(
      patch,
      ['position', 'rotationDegrees', 'dimensions'],
      'transformation',
    );
    const allowed = capabilities(object);
    const record = objectToRecord(object);
    for (const section of sections) {
      const fields = patchFields(patch[section], allowed[section], section);
      for (const field of fields) finite(patch[section][field], field);
      if (section === 'position' && fields.length) {
        const world = object.getWorldPosition(new Vector3());
        let changed = false;
        for (const axis of fields) {
          const value = patch.position[axis];
          if (value === fromInches(world[axis], unit)) continue;
          world[axis] = toInches(value, unit);
          changed = true;
        }
        if (
          world.toArray().some(
            (value) =>
              !Number.isFinite(value) || Math.abs(value) > limits.coordinate,
          )
        )
          throw new Error('Position exceeds the supported coordinate range.');
        // Preserve native local bits on read/apply and unit-switch no-ops.
        if (changed)
          record.position = localPositionFromWorld(object, world).toArray();
      } else if (section === 'rotationDegrees') {
        for (const axis of fields) {
          const value = patch.rotationDegrees[axis];
          if (value !== radiansToDegrees(object.rotation[axis]))
            record.rotation[axes.indexOf(axis)] = degreesToRadians(value);
        }
      } else if (section === 'dimensions') {
        for (const name of fields) {
          const value = patch.dimensions[name];
          const index = name === 'diameter' ? 0 : dimensionIndices[name];
          const multiplier = name === 'diameter' ? 2 : 1;
          if (
            value !== fromInches(record.dimensions[index] * multiplier, unit)
          )
            record.dimensions[index] = toInches(value, unit) / multiplier;
        }
      }
    }
    validateRecords([record]);
    return record;
  }
  return { read, prepare, capabilities };
}
