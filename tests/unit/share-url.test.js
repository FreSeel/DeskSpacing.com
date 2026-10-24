import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('../../js/share-url.js', import.meta.url),
  'utf8',
);
const window = { location: { href: 'http://localhost:5173/mainApp.html' } };
vm.runInNewContext(source, { window, URL });
const { create } = window.DeskSpacingURLs;

describe('deployment-aware sharing', () => {
  it.each([
    'http://localhost:5173/mainApp.html',
    'https://example.github.io/DeskSpacing.com/mainApp.html',
    'https://example.com/mainAppMobile.html',
    'https://example.com/tools/mainAppOld.html',
  ])('preserves the origin and page for %s', (location) => {
    const setup = '[ ^PrimitiveBox|referenceBox|1,2,3,|0,0,0,|5,5,10,|null|^ ]';
    const url = new URL(create(setup, `${location}?old=value#fragment`));
    expect(url.origin + url.pathname).toBe(location);
    expect([...url.searchParams]).toEqual([['customSetup', setup]]);
    expect(url.hash).toBe('');
  });

  it('encodes query delimiters and percent signs without changing the setup', () => {
    const payload = '[ *box|wood & metal + 50%|* ]';
    const url = new URL(create(payload));
    expect(url.searchParams.get('customSetup')).toBe(payload);
    // The legacy query reader decodes percent escapes and plus-encoded spaces.
    expect(
      decodeURIComponent(
        url.search.slice('?customSetup='.length).replace(/\+/g, ' '),
      ),
    ).toBe(payload);
  });
});
