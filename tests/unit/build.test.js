import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import { copySite, dependencies } from '../../scripts/legacy-site.js';

it('publishes stable asset paths and pinned dependencies without repository internals or CNAME', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'deskspacing-build-'));
  const output = path.join(root, 'dist');
  await mkdir(output);
  for (const [file, content] of Object.entries({
    'index.html': '<a href="mainApp.html">Create</a>',
    'mainApp.html': '<script src="three.min.js"></script>',
    CNAME: 'deskspacing.com',
    'vite.config.js': 'private tooling',
    'GLTFs/model with spaces.glb': 'model',
    'js/share-url.js': 'unbundled script',
    'src/styles/planner.css': 'planner style',
    'js/jquery-3.2.1.slim.min.js': 'retired jquery',
    'js/ScrollMagic.min.js': 'retired scrollmagic',
    'three/examples/models/unreferenced.glb': 'vendor example',
    '.git/config': 'private',
  })) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), content);
  }
  for (const source of Object.values(dependencies)) {
    await mkdir(path.dirname(path.join(root, 'node_modules', source)), {
      recursive: true,
    });
    await writeFile(
      path.join(root, 'node_modules', source),
      `pinned: ${source}`,
    );
  }
  await mkdir(path.join(output, 'js'));
  await writeFile(path.join(output, 'js/share-url.js'), 'built script');
  await copySite(root, output);
  expect(
    await readFile(path.join(output, 'GLTFs/model with spaces.glb'), 'utf8'),
  ).toBe('model');
  expect(await readFile(path.join(output, 'js/share-url.js'), 'utf8')).toBe(
    'built script',
  );
  expect(
    await readFile(path.join(output, 'src/styles/planner.css'), 'utf8'),
  ).toBe('planner style');
  expect(await readFile(path.join(output, 'three.min.js'), 'utf8')).toBe(
    'pinned: three-legacy/build/three.min.js',
  );
  for (const file of [
    'CNAME',
    'js/jquery-3.2.1.slim.min.js',
    'js/ScrollMagic.min.js',
    '.git/config',
    'vite.config.js',
    'node_modules/three/build/three.min.js',
    'three/examples/models/unreferenced.glb',
  ]) {
    await expect(readFile(path.join(output, file))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  }
});
