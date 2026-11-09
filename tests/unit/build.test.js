import { siteMounts, siteSourcePath } from '../../scripts/site-layout.js';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import { copySite, dependencies } from '../../scripts/legacy-site.js';
import { patchLegacyThree } from '../../scripts/legacy-three-security.js';

it('publishes stable asset paths and pinned dependencies without repository internals or CNAME', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'deskspacing-build-'));
  const output = path.join(root, 'dist');
  await mkdir(output);
  // Supply every declared mount so a missing source fails production builds.
  for (const source of Object.values(siteMounts)) {
    const file = path.join(root, source);
    if (path.extname(source)) {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, 'fixture');
    } else await mkdir(file, { recursive: true });
  }
  for (const [file, content] of Object.entries({
    'index.html': '<a href="mainApp.html">Create</a>',
    'mainApp.html': '<script src="three.min.js"></script>',
    CNAME: 'deskspacing.com',
    'THIRD_PARTY_NOTICES.md': 'asset provenance and notices',
    'vite.config.js': 'private tooling',
    'GLTFs/model with spaces.glb': 'model',
    'scene.gltf': 'sidecar model',
    'scene.bin': 'sidecar bytes',
    'about.html': 'retained page',
    'textures/wood.jpg': 'texture',
    'js/share-url.js': 'unbundled script',
    'js/share-setup.js': 'classic setup validator',
    'mainAppMobile.html': '<script src="js/share-setup.js"></script>',
    'mainAppOld.html': '<script src="js/share-setup.js"></script>',
    'src/styles/planner.css': 'planner style',
    'js/jquery-3.2.1.slim.min.js': 'retired jquery',
    'js/ScrollMagic.min.js': 'retired scrollmagic',
    'vendor/three/examples/models/unreferenced.glb': 'vendor example',
    '.git/config': 'private',
  })) {
    await mkdir(path.dirname(path.join(root, siteSourcePath(file))), {
      recursive: true,
    });
    await writeFile(path.join(root, siteSourcePath(file)), content);
  }
  for (const source of Object.values(dependencies)) {
    await mkdir(path.dirname(path.join(root, 'node_modules', source)), {
      recursive: true,
    });
    await writeFile(
      path.join(root, 'node_modules', source),
      source.match(/three-legacy\/build\/three\.(min|module)\.js$/)
        ? await readFile(path.join('node_modules', source))
        : `pinned: ${source}`,
    );
  }
  await mkdir(path.join(output, 'js'));
  await writeFile(path.join(output, 'js/share-url.js'), 'built script');
  await copySite(root, output);
  expect(
    await readFile(path.join(output, 'GLTFs/model with spaces.glb'), 'utf8'),
  ).toBe('model');
  for (const [file, content] of Object.entries({
    'scene.gltf': 'sidecar model',
    'scene.bin': 'sidecar bytes',
    'about.html': 'retained page',
    'textures/wood.jpg': 'texture',
    'js/share-setup.js': 'classic setup validator',
    'mainAppMobile.html': '<script src="js/share-setup.js"></script>',
    'mainAppOld.html': '<script src="js/share-setup.js"></script>',
  }))
    expect(await readFile(path.join(output, file), 'utf8')).toBe(content);
  expect(await readFile(path.join(output, 'js/share-url.js'), 'utf8')).toBe(
    'built script',
  );
  expect(
    await readFile(path.join(output, 'src/styles/planner.css'), 'utf8'),
  ).toBe('planner style');
  expect(
    await readFile(path.join(output, 'THIRD_PARTY_NOTICES.md'), 'utf8'),
  ).toBe('asset provenance and notices');
  for (const name of ['three.min.js', 'three.module.js']) {
    expect(await readFile(path.join(output, name), 'utf8')).toBe(
      patchLegacyThree(
        name,
        await readFile(path.join('node_modules', dependencies[name])),
      ),
    );
  }
  for (const file of [
    'CNAME',
    'public/models/GLTFs/model with spaces.glb',
    'vendor/three/examples/models/unreferenced.glb',
    'legacy/pages/about.html',
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
