import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { patchLegacyThree } from '../../scripts/legacy-three-security.js';
import { legacySite } from '../../scripts/legacy-site.js';

const names = ['three.min.js', 'three.module.js'];
const read = (name) =>
  readFileSync(`node_modules/three-legacy/build/${name}`, 'utf8');

function engine(source, name) {
  if (name === 'three.module.js')
    source = source.replace(
      /export \{[^\n]+\};\s*$/,
      'globalThis.THREE = { Color, MeshLambertMaterial, REVISION };',
    );
  const context = vm.createContext({ console: { warn() {} } });
  vm.runInContext(source, context, { timeout: 1000 });
  return context.THREE;
}

function probe(name, mode) {
  const result = spawnSync(
    process.execPath,
    [
      '--max-old-space-size=64',
      'tests/fixtures/legacy-color-probe.js',
      name,
      mode,
    ],
    { encoding: 'utf8', timeout: 3000, maxBuffer: 2048 },
  );
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  return result.stdout;
}

it('reproduces the unpatched advisory only inside strict resource bounds', () => {
  expect(probe('three.min.js', 'original')).toBe('timed out');
});

describe.each(names)('%s security backport', (name) => {
  it('rejects advisory inputs promptly, including all RGB/HSL variants', () => {
    expect(probe(name, 'patched')).toBe('completed');
  });

  it('preserves numeric, named, hex, RGB/HSL, alpha and material semantics', () => {
    const original = engine(read(name), name);
    const patched = engine(patchLegacyThree(name, read(name)), name);
    expect(patched.REVISION).toBe('116');
    const inputs = [
      0x202020,
      0xffffff,
      'white',
      'rebeccapurple',
      '#abc',
      '#123456',
      '',
      'invalid',
      'rgb(255, 0, 127)',
      'rgb( 255, 0, 127)',
      'rgb(\n\t255,0,127)',
      'rgba( 255,0,127,0.5)',
      'rgb( 100%,0%,50%)',
      'rgba( 100%,0%,50%,.2)',
      'hsl( 120,50%,50%)',
      'hsla(\t120,50%,50%,.2)',
      'hsl(.5,100%,50%)',
      'rgb(999,0,0)',
      'rgb(1,2,3)trailing',
      'rgb(',
      'hsl( )',
      'rgb(1,2)',
    ];
    for (const input of inputs) {
      const expected = new original.Color(input).toArray();
      expect(new patched.Color(input).toArray(), String(input)).toEqual(
        expected,
      );
      const material = new patched.MeshLambertMaterial({ color: input });
      expect(material.color.toArray()).toEqual(
        new original.MeshLambertMaterial({ color: input }).color.toArray(),
      );
      material.dispose();
    }
  });

  it('fails closed on source changes and double patching', () => {
    expect(() => patchLegacyThree(name, read(name) + '\n')).toThrow(
      'unexpected',
    );
    expect(() =>
      patchLegacyThree(name, patchLegacyThree(name, read(name))),
    ).toThrow('unexpected');
  });

  it.each(['/', '/DeskSpacing.com/'])(
    'serves the same patched engine in development under %s',
    async (base) => {
      const plugin = legacySite();
      plugin.configResolved({ root: process.cwd(), base });
      let middleware;
      plugin.configureServer({
        middlewares: {
          use(fn) {
            middleware = fn;
          },
        },
      });
      let body;
      await middleware(
        { url: `${base}${name}` },
        {
          setHeader() {},
          end(value) {
            body = value.toString();
          },
        },
        (error) => {
          throw error ?? new Error('Engine fell through middleware');
        },
      );
      expect(body).toBe(patchLegacyThree(name, read(name)));
    },
  );
});
