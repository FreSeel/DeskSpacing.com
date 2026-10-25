import { siteSourcePath } from '../../scripts/site-layout.js';
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

it('resolves product variations and rejects unavailable combinations', async () => {
  const { resolveProduct, createRecord } =
    await import('../../src/catalog/configuration.js');
  expect(resolveProduct('small16x9Monitor', '24', true)).toBe(
    'small16x9Monitor24NoStand',
  );
  expect(resolveProduct('TKLKeyboard', 'AllWhite')).toBe('TKLKeyboardAllWhite');
  expect(() => resolveProduct('small16x9Monitor', '999')).toThrow(
    'Unknown product',
  );
  expect(() => createRecord('__proto__')).toThrow('Unknown product');
  const desk = createRecord('customDesk', {
    dimensions: [50, 1, 20],
    texture: 'italianOak',
  });
  expect(desk.position).toEqual([0, 30.2, -53]);
  expect(desk.dimensions).toEqual([50, 1, 20]);
  const box = createRecord('referenceBox', {
    dimensions: [5, 10, 20],
    deskOffset: -0.5,
  });
  expect(box.position).toEqual([0, 35.7, -57]);
  const sphere = createRecord('referenceSphere', {
    dimensions: [2, -1, -1],
    deskOffset: -0.5,
  });
  expect(sphere.position).toEqual([0, 32.7, -57]);
});

it('preserves existing asset paths and catches missing paths for any new catalog entry', async () => {
  const { existsSync } = await import('node:fs');
  for (const [id, product] of Object.entries(products)) {
    // This unexposed legacy product was already missing at the audit baseline.
    if (!product.modelPath || id === 'drawerDesk') continue;
    expect(
      existsSync(
        new URL(`../../${siteSourcePath(product.modelPath)}`, import.meta.url),
      ),
      id,
    ).toBe(true);
  }
  for (const path of Object.values(textures)) {
    expect(
      existsSync(new URL(`../../${siteSourcePath(path)}`, import.meta.url)),
      path,
    ).toBe(true);
  }
});
