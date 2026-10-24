import { expect, it } from 'vitest';
import { products, deskOffsets, textures } from '../../src/catalog/products.js';
import baseline from '../fixtures/catalog-baseline.json';

it('preserves every legacy product ID, authored placement, dimensions and asset path', () => {
  expect(Object.keys(products)).toEqual(Object.keys(baseline));
  for (const [id, original] of Object.entries(baseline)) {
    expect(products[id]).toMatchObject({
      position: original.slice(0, 3),
      rotationY: original[3] || 0,
      modelPath: original[4] || null,
      dimensions: { imperial: original[5] || '', metric: original[6] || '' },
    });
  }
  expect(deskOffsets.customDesk).toBe(-0.5);
  expect(textures.darkParquet).toBe('textures/darkParquet.jpg');
});
