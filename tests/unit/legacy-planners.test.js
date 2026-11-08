import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { URLSearchParams } from 'node:url';
import { describe, expect, it } from 'vitest';
import { siteSourcePath } from '../../scripts/site-layout.js';
import { decodeSetup, limits } from '../../src/sharing/legacyCodec.js';
import fixtures from '../fixtures/legacy-setups.json';

const read = (url) => readFileSync(siteSourcePath(url), 'utf8');
const bridge = read('js/share-setup.js');
const mouse = 'Mouse|defaultMouse|1,2,3,|0,0,0,|';

function planner(page) {
  const html = read(page);
  const functionSource = (name) => {
    const start = html.indexOf(`        function ${name}(`);
    if (start < 0) throw new Error(`Missing ${name} in ${page}`);
    const end = html.indexOf('\n        }', start) + '\n        }'.length;
    return html.slice(start, end);
  };
  const previous = { previous: true };
  const calls = [];
  const scene = [previous];
  const context = vm.createContext({
    URL,
    window: { location: { href: `https://example.com/tools/${page}` } },
    console: { warn() {}, log() {} },
    THREE: {
      Vector3: class {
        constructor(x, y, z) {
          Object.assign(this, { x, y, z });
        }
      },
    },
    pickHelper: { pickedObject: previous },
    resetScene() {
      calls.push('reset');
      scene.length = 0;
    },
    updateDeskHeightDiff(product, oldDesk) {
      calls.push(['desk', product, oldDesk]);
    },
    addDefaultPosRot(...args) {
      scene.push(args);
    },
    addPrimitivePosRotDimText(...args) {
      scene.push(args);
    },
    initializeObjects() {
      calls.push('initialize');
    },
  });
  // Evaluate the actual page dictionaries, not a modern catalog approximation.
  const dictionaries = [
    'textureDictionary',
    'deskHeightDiff',
    'coordinateDictionary',
  ]
    .map((name) => {
      const start = html.indexOf(`        var ${name} = {`);
      const end = html.indexOf('\n        }', start) + '\n        }'.length;
      return html.slice(start, end);
    })
    .join('\n');
  vm.runInContext(
    `${bridge}\nvar heightDiff = 17;\n${dictionaries}\n${functionSource('parseShareableString')}\n${functionSource('loadCustomSetup')}`,
    context,
    { timeout: 1000 },
  );
  return {
    html,
    context,
    calls,
    scene,
    previous,
    run(source) {
      // Every call runs inside the VM deadline, including the actual inline
      // adapter and URL reader. A reintroduced infinite loop fails this test.
      return vm.runInContext(source, context, { timeout: 1000 });
    },
    parse(input) {
      context.input = input;
      return this.run('parseShareableString(input)');
    },
    load(query) {
      context.window.location.href = `https://example.com/tools/${page}${query}`;
      return this.run('loadCustomSetup()');
    },
  };
}

describe.each(['mainAppMobile.html', 'mainAppOld.html'])(
  '%s shared setups',
  (page) => {
    it('loads its validator synchronously before the inline planner', () => {
      const { html } = planner(page);
      expect(html).toContain('<script src="js/share-setup.js"></script>');
      expect(html.indexOf('js/share-setup.js')).toBeLessThan(
        html.indexOf('function parseShareableString('),
      );
    });

    it.each(Object.entries(fixtures))(
      'restores historical %s URLs and transforms',
      (_name, setup) => {
        const p = planner(page);
        expect(
          p.load(`?customSetup=${encodeURIComponent(setup)}#fragment`),
        ).toBe(true);
        const expected = decodeSetup(setup).map((record) => [
          record.type,
          record.product,
          Object.fromEntries(
            ['x', 'y', 'z'].map((axis, i) => [axis, record.position[i]]),
          ),
          Object.fromEntries(
            ['x', 'y', 'z'].map((axis, i) => [axis, record.rotation[i]]),
          ),
          ...(record.dimensions
            ? [
                Object.fromEntries(
                  ['x', 'y', 'z'].map((axis, i) => [
                    axis,
                    record.dimensions[i],
                  ]),
                ),
                record.texture,
              ]
            : []),
        ]);
        expect(p.scene).toEqual(expected);
        expect(p.calls[0]).toBe('reset');
        expect(p.calls).toContainEqual([
          'desk',
          _name === 'desktop' ? 'modernDesk' : 'customDesk',
          'modernDesk',
        ]);
        expect(p.context.pickHelper.pickedObject).toBeNull();
      },
    );

    it('accepts plus-encoded spaces and the first duplicate parameter', () => {
      const p = planner(page);
      const query = new URLSearchParams({ customSetup: fixtures.mobile });
      query.append('customSetup', '[ ');
      expect(p.load(`?hasOwnProperty=x&__proto__=x&${query}`)).toBe(true);
      expect(p.scene).toHaveLength(decodeSetup(fixtures.mobile).length);
    });

    it('initializes defaults when no setup parameter exists', () => {
      const p = planner(page);
      p.load('');
      p.load('?utm_source=test#customSetup=bad');
      expect(p.calls).toEqual(['initialize', 'initialize']);
    });

    it.each(['[]', '[ ]', ' [  ]\n'])(
      'allows the explicit empty scene %j',
      (input) => {
        const p = planner(page);
        expect(p.parse(input)).toBe(true);
        expect(p.scene).toEqual([]);
        expect(p.calls).toEqual(['reset']);
      },
    );

    const malformed = [
      '',
      '[ ',
      '[',
      ']',
      '%',
      null,
      undefined,
      `[ ${mouse}`,
      `[ ${mouse} ]trailing`,
      `[ ${mouse} [ ]`,
      '[ Mouse|defaultMouse|1,2,3,|0,0,0, ]',
      '[ Mouse|defaultMouse|1,2,3,|0,0,0,| extra ]',
      '[ Mouse|defaultMouse|1junk,2,3,|0,0,0,| ]',
      '[ Mouse|defaultMouse|NaN,2,3,|0,0,0,| ]',
      '[ Mouse|defaultMouse|Infinity,2,3,|0,0,0,| ]',
      '[ Mouse|defaultMouse|0x10,2,3,|0,0,0,| ]',
      '[ Mouse|defaultMouse|1,,3,|0,0,0,| ]',
      '[ Mouse|defaultMouse|1,2,3,4,|0,0,0,| ]',
      '[ Mouse|defaultMouse|1,2,3,|1e99,0,0,| ]',
      '[ Mouse|missing|1,2,3,|0,0,0,| ]',
      '[ Mouse|__proto__|1,2,3,|0,0,0,| ]',
      '[ Mouse|customDesk|1,2,3,|0,0,0,| ]',
      '[ Desk|defaultMouse|1,2,3,|0,0,0,| ]',
      '[ ^PrimitiveBox|referenceBox|0,0,0,|0,0,0,|1,2,3,|null| ]',
      '[ *PrimitiveSphere|referenceSphere|0,0,0,|0,0,0,|1,-1,-1,|null|^ ]',
      '[ ^PrimitiveBox|referenceBox|0,0,0,|0,0,0,|0,2,3,|null|^ ]',
      '[ ^PrimitiveBox|referenceBox|0,0,0,|0,0,0,|10001,2,3,|null|^ ]',
      '[ ^PrimitiveSphere|referenceSphere|0,0,0,|0,0,0,|1,2,3,|null|^ ]',
      '[ ^PrimitiveCone|referenceBox|0,0,0,|0,0,0,|1,2,3,|null|^ ]',
      '[ ^PrimitiveBox|referenceBox|0,0,0,|0,0,0,|1,2,3,|missing|^ ]',
      '[ ^PrimitiveBox|referenceBox|0,0,0,|0,0,0,|1,2,3,|__proto__|^ ]',
      ' '.repeat(limits.characters + 1),
      `[ Mouse|defaultMouse|${'1'.repeat(90_000)}x,2,3,|0,0,0,| ]`,
      `[ ${`${mouse} `.repeat(limits.objects + 1)}]`,
      `[ ${mouse} Mouse|missing|0,0,0,|0,0,0,| ]`,
      `[ ${mouse} ^PrimitiveBox|referenceBox|0,0,0,|0,0,0,|1,2,3,|null| ]`,
    ];
    it.each(malformed.map((input, i) => [i, input]))(
      'rejects malformed input #%i without any mutation',
      (_index, input) => {
        const p = planner(page);
        expect(p.parse(input)).toBe(false);
        expect(p.scene).toEqual([p.previous]);
        expect(p.context.pickHelper.pickedObject).toBe(p.previous);
        expect(p.context.heightDiff).toBe(17);
        expect(p.calls).toEqual([]);
        // An invalid attempt must not poison a later successful restore.
        expect(p.parse(fixtures.mobile)).toBe(true);
        expect(p.scene).toHaveLength(decodeSetup(fixtures.mobile).length);
      },
    );

    it.each([
      '?customSetup=%',
      '?customSetup',
      '?customSetup=',
      '?hasOwnProperty=x&customSetup=%5B%20',
    ])('rejects malformed URL %s without mutation', (query) => {
      const p = planner(page);
      expect(p.load(query)).toBe(false);
      expect(p.scene).toEqual([p.previous]);
      expect(p.calls).toEqual([]);
    });

    it('accepts all historical model IDs and texture IDs from the actual page', () => {
      const p = planner(page);
      const models = p.run(
        'Object.keys(coordinateDictionary).filter(key => coordinateDictionary[key][4])',
      );
      for (const product of models) {
        expect(
          p.parse(`[ Object|${product}|-1e-3,2,3,|0,0,0,| ]`),
          product,
        ).toBe(true);
      }
      const textures = p.run('Object.keys(textureDictionary)');
      for (const texture of textures) {
        expect(
          p.parse(
            `[ *PrimitiveBox|historicalName|0,0,0,|0,0,0,|1,2,3,|${texture}|* ]`,
          ),
          texture,
        ).toBe(true);
      }
    });

    it('accepts the record and numeric boundaries', () => {
      const p = planner(page);
      expect(p.parse(`[ ${`${mouse} `.repeat(limits.objects)}]`)).toBe(true);
      expect(p.scene).toHaveLength(limits.objects);
      expect(
        p.parse(
          '[ ^PrimitiveBox|referenceBox|1000000,-1000000,0,|0,0,0,|10000,1,1,|null|^ ]',
        ),
      ).toBe(true);
    });
  },
);
