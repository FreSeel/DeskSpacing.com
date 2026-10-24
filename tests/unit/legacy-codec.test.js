import { describe, expect, it } from 'vitest';
import { decodeSetup, encodeSetup, limits } from '../../src/sharing/legacyCodec.js';
import { createShareUrl, readSetupParameter } from '../../src/sharing/shareUrl.js';
import fixtures from '../fixtures/legacy-setups.json';

describe('legacy setup compatibility', () => {
  it.each(Object.entries(fixtures))('round trips %s without losing transforms, types or dimensions', (_name, text) => {
    const records = decodeSetup(text);
    expect(encodeSetup(records, text.includes('*') ? '*' : '^')).toBe(text);
    expect(decodeSetup(encodeSetup(records))).toEqual(records);
  });
  it('accepts an empty setup', () => {
    expect(decodeSetup('[ ]')).toEqual([]);
    expect(encodeSetup([])).toBe('[ ]');
  });
  it.each([
    '[ ', '', '%', '[ Mouse|defaultMouse|0,0,0,|0,0,0,|',
    '[ Mouse|missing|0,0,0,|0,0,0,| ]',
    '[ Mouse|__proto__|0,0,0,|0,0,0,| ]',
    '[ Mouse|defaultMouse|NaN,0,0,|0,0,0,| ]',
    '[ Mouse|defaultMouse|1e99,0,0,|0,0,0,| ]',
    '[ Mouse|defaultMouse|1,2,|0,0,0,| ]',
    '[ ^PrimitiveBox|referenceBox|0,0,0,|0,0,0,|-1,2,3,|null|^ ]',
    '[ ^PrimitiveBox|referenceBox|0,0,0,|0,0,0,|1,2,3,|missing|^ ]',
    '[ ^PrimitiveBox|referenceBox|0,0,0,|0,0,0,|1,2,3,|null|* ]',
    'x'.repeat(limits.characters + 1),
    `[ ${'Mouse|defaultMouse|0,0,0,|0,0,0,| '.repeat(limits.objects + 1)}]`,
  ])('rejects malformed input #%# without a scene dependency', (text) => {
    expect(() => decodeSetup(text)).toThrow('Invalid setup');
  });
  it('uses first customSetup value and ignores unrelated query keys', () => {
    expect(readSetupParameter('https://example.com/mainApp.html?utm_source=test')).toBeNull();
    expect(readSetupParameter('https://example.com/?customSetup=%')).toBe('%');
    expect(readSetupParameter('https://example.com/?hasOwnProperty=x&customSetup=a&customSetup=b')).toBe('a');
  });
  it('preserves deployment path and the payload through URL encoding', () => {
    const url = createShareUrl(fixtures.mobile, 'https://example.com/tools/mainApp.html?old=value#hash');
    expect(readSetupParameter(url)).toBe(fixtures.mobile);
    expect(new URL(url).pathname).toBe('/tools/mainApp.html');
    expect(new URL(url).hash).toBe('');
  });
});
