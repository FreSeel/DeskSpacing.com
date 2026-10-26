import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  cards,
  categories,
  describeProduct,
} from '../../src/catalog/presentation.js';
import { products } from '../../src/catalog/products.js';
import { resolveProduct } from '../../src/catalog/configuration.js';
import { siteSourcePath } from '../../scripts/site-layout.js';

describe('the preserved desktop library', () => {
  it('exposes all original categories and choices without compatibility-only records', () => {
    expect(categories.map((c) => c.label)).toEqual([
      'Desks',
      'Monitors',
      'Keyboards',
      'Mouse',
      'Mousepads',
      'Speakers and Audio Equipment',
      'Laptops',
      'Computer Towers',
      'Basic Shapes',
      'Chairs',
      'Miscellaneous',
    ]);
    expect(cards).toHaveLength(42);
    const ids = cards.flatMap((card) =>
      card.family
        ? card.select.options.flatMap((option) =>
            (card.stand ? [false, true] : [false]).map((stand) =>
              resolveProduct(card.family, option.value, stand),
            ),
          )
        : [card.product],
    );
    const compatibilityOnly = [
      'drawerDesk',
      'TKLKeyboardYGB',
      'mediumRGBMousepad',
    ];
    expect(ids).toHaveLength(104);
    expect(new Set(ids).size).toBe(104);
    expect(ids.sort()).toEqual(
      [
        ...Object.keys(products).filter(
          (id) => !compatibilityOnly.includes(id),
        ),
        'referenceBox',
        'referenceSphere',
      ].sort(),
    );
    expect(describeProduct('small16x9Monitor31NoStand').variation).toBe(
      '31.5" · No stand',
    );
    expect(describeProduct('default60PercentKeyboardYPGrad').variation).toBe(
      'Sunset',
    );
    expect(describeProduct('defaultFullKeyboardYPGrade').variation).toBe(
      'Sunset',
    );
  });
  it('uses real mounted thumbnails for every card, material and keyboard preview', () => {
    for (const card of cards) {
      expect(existsSync(siteSourcePath(card.thumbnail)), card.thumbnail).toBe(
        true,
      );
      for (const option of card.select?.options || []) {
        if (option.image)
          expect(existsSync(siteSourcePath(option.image)), option.image).toBe(
            true,
          );
        if (card.family) {
          const resolved = describeProduct(
            resolveProduct(card.family, option.value),
          );
          expect(
            existsSync(siteSourcePath(resolved.thumbnail)),
            resolved.thumbnail,
          ).toBe(true);
        }
      }
    }
  });
});
