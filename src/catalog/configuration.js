import { products, deskOffsets } from './products.js';

export const primitives = {
  floor: {
    type: 'PrimitiveBoxFloorFurnitureNoSelect',
    position: [0, 0, -40],
    dimensions: [100, 2, 70],
    texture: 'darkParquet',
  },
  customDesk: {
    type: 'FurniturePrimitiveBoxDeskNoSelect',
    position: products.customDesk.position,
    texture: 'lightAlderwood',
  },
  referenceBox: { type: 'PrimitiveBox', texture: 'null' },
  referenceSphere: { type: 'PrimitiveSphere', texture: 'null' },
};

export const defaults = [
  { product: 'floor', ...primitives.floor, rotation: [0, 0, 0] },
  { product: 'modernDesk', type: 'DeskNoSelect' },
  { product: 'small16x9Monitor28', type: 'Monitor' },
  { product: 'defaultMouse' },
  { product: 'default60PercentKeyboardAllGrey' },
  { product: 'QCKSmall' },
];

// Family IDs also name the existing Form / Stand / Image elements in the catalog.
export const families = {
  small16x9Monitor: { stand: true },
  largeCurved16x9Monitor: { stand: true },
  flat21x9Monitor: { stand: true },
  curved21x9Monitor: { stand: true },
  curved32x9Monitor: { stand: true },
  default60PercentKeyboard: { preview: true },
  '75PercentKeyboard': { preview: true },
  defaultFullKeyboard: { preview: true },
  TKLKeyboard: { preview: true },
  deskSpacingSpeaker: {},
  studioMonitorSpeaker: {},
  alexDesk: {},
  bekantLShaped: {},
  linnmonDesk: {},
};

export function resolveProduct(family, variation = '', noStand = false) {
  const id = `${family}${variation}${noStand ? 'NoStand' : ''}`;
  if (!Object.hasOwn(products, id)) throw new Error(`Unknown product: ${id}`);
  return id;
}

export function isDesk(product) {
  return Object.hasOwn(deskOffsets, product);
}

// Preserve authored model Y coordinates. Historically these defaults were computed
// once at startup; only existing accessories and new primitives follow desk changes.
// Changing that placement convention is deliberately separate from extraction.
export function createRecord(
  product,
  { type, dimensions, texture, deskOffset = 0 } = {},
) {
  const definition = Object.hasOwn(products, product)
    ? products[product]
    : Object.hasOwn(primitives, product)
      ? primitives[product]
      : null;
  if (!definition) throw new Error(`Unknown product: ${product}`);
  const primitive = Object.hasOwn(primitives, product)
    ? primitives[product]
    : null;
  let position = [...(definition.position || [0, 0, -57])];
  if (product === 'referenceBox' || product === 'referenceSphere') {
    if (!dimensions) throw new Error(`Dimensions are required for ${product}`);
    const halfHeight =
      product === 'referenceSphere' ? dimensions[0] : dimensions[1] / 2;
    position = [0, 31.7 + deskOffset + (halfHeight - 0.5), -57];
  }
  return {
    type: type || definition.type,
    product,
    position,
    rotation: [0, definition.rotationY || 0, 0],
    ...(primitive
      ? {
          dimensions: dimensions || primitive.dimensions,
          texture: texture || primitive.texture,
        }
      : {}),
  };
}
