import { products, textures, deskOffsets } from '../catalog/products.js';

// Both published writers use the same records; mobile wraps primitives with '*'.
export const limits = { characters: 100_000, objects: 500, coordinate: 1_000_000, dimension: 10_000 };
const primitiveShapes = { floor: 'Box', customDesk: 'Box', referenceBox: 'Box', referenceSphere: 'Sphere' };

function invalid(reason) {
  throw new Error(`Invalid setup: ${reason}`);
}

function vector(value, label) {
  const parts = value.split(',');
  if (parts.at(-1) === '') parts.pop();
  if (parts.length !== 3 || parts.some((part) => !part.trim())) invalid(label);
  const values = parts.map(Number);
  if (values.some((number) => !Number.isFinite(number) || Math.abs(number) > limits.coordinate)) invalid(label);
  return values;
}

export function validateRecords(records) {
  if (!Array.isArray(records) || records.length > limits.objects) invalid('too many objects');
  for (const record of records) {
    const { type, product, position, rotation, dimensions, texture } = record;
    if (typeof type !== 'string' || !/^[A-Za-z]+$/.test(type)) invalid('object type');
    for (const [label, values] of Object.entries({ position, rotation })) {
      if (!Array.isArray(values) || values.length !== 3 || values.some((n) => !Number.isFinite(n) || Math.abs(n) > limits.coordinate)) invalid(label);
    }
    if (type.includes('Primitive')) {
      if (!Object.hasOwn(primitiveShapes, product) || !type.includes(primitiveShapes[product])) invalid('primitive');
      if (!Array.isArray(dimensions) || dimensions.length !== 3) invalid('dimensions');
      const size = type.includes('Sphere') ? dimensions.slice(0, 1) : dimensions;
      if (size.some((n) => !Number.isFinite(n) || n <= 0 || n > limits.dimension)) invalid('dimensions');
      if (type.includes('Sphere') && (dimensions[1] !== -1 || dimensions[2] !== -1)) invalid('sphere dimensions');
      if (texture !== 'null' && !Object.hasOwn(textures, texture)) invalid('texture');
    } else if (!Object.hasOwn(products, product) || !products[product].modelPath || dimensions) {
      invalid('product');
    }
    if (type.includes('Desk') && !Object.hasOwn(deskOffsets, product)) invalid('desk');
  }
  return records;
}

export function decodeSetup(input) {
  if (typeof input !== 'string' || input.length > limits.characters) invalid('length');
  const text = input.trim();
  if (!text.startsWith('[') || !text.endsWith(']')) invalid('missing brackets');
  const body = text.slice(1, -1).trim();
  if (!body) return [];
  const tokens = body.split(/\s+/);
  if (tokens.length > limits.objects) invalid('too many objects');
  const records = tokens.map((token) => {
    const marker = ['^', '*'].includes(token[0]) ? token[0] : '';
    if (marker) {
      if (!token.endsWith(marker)) invalid('unclosed primitive');
      token = token.slice(1, -1);
    }
    const fields = token.split('|');
    if (fields.pop() !== '' || fields.length !== (marker ? 6 : 4)) invalid('fields');
    const [type, product, position, rotation, dimensions, texture] = fields;
    if (Boolean(marker) !== type.includes('Primitive')) invalid('primitive marker');
    return {
      type, product,
      position: vector(position, 'position'), rotation: vector(rotation, 'rotation'),
      ...(marker ? { dimensions: vector(dimensions, 'dimensions'), texture } : {}),
    };
  });
  return validateRecords(records);
}

export function encodeSetup(records, marker = '^') {
  validateRecords(records);
  if (!['^', '*'].includes(marker)) invalid('primitive marker');
  const vectorText = (values) => `${values.join(',')},|`;
  return `[ ${records.map((record) => {
    const { type, product, position, rotation, dimensions, texture } = record;
    const fields = `${type}|${product}|${vectorText(position)}${vectorText(rotation)}`;
    return dimensions ? `${marker}${fields}${vectorText(dimensions)}${texture}|${marker}` : fields;
  }).join(' ')}${records.length ? ' ' : ''}]`;
}
