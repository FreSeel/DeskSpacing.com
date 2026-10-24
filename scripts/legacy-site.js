import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Keep original URLs, including spaces/case and model sidecars. No model pruning.
export const assetDirectories = [
  '16x9Monitors',
  '3d',
  'Click Through Tutorial',
  'GLTFs',
  'Model thumbnails',
  'css',
  'desk0',
  'desks',
  'fonts',
  'images',
  'js',
  'keyboards',
  'lamps',
  'monitors',
  'mousepads',
  'mouses',
  'rooms',
  'textures',
  'ultrawideMonitor',
];

// Pin CDN replacements and engine files to npm; preserve customized root addons.
export const dependencies = {
  'three.min.js': 'three/build/three.min.js',
  'three/examples/js/controls/DragControls.js':
    'three/examples/js/controls/DragControls.js',
  'three/examples/js/controls/TransformControls.js':
    'three/examples/js/controls/TransformControls.js',
  'three/examples/js/loaders/DRACOLoader.js':
    'three/examples/js/loaders/DRACOLoader.js',
  'vendor/popper.min.js': '@popperjs/core/dist/umd/popper.min.js',
  'vendor/bootstrap.min.js': 'bootstrap/dist/js/bootstrap.min.js',
  'vendor/THREE-LICENSE.txt': 'three/LICENSE',
  'vendor/POPPER-LICENSE.txt': '@popperjs/core/LICENSE.md',
  'vendor/GSAP-README.md': 'gsap/README.md',
  'vendor/gsap.min.js': 'gsap/dist/gsap.min.js',
  'vendor/ScrollTrigger.min.js': 'gsap/dist/ScrollTrigger.min.js',
  'vendor/BOOTSTRAP-LICENSE.txt': 'bootstrap/LICENSE',
};

export const retiredScripts = new Set([
  'js/jquery-3.2.1.slim.min.js',
  'js/popper.min.js',
  'js/bootstrap.min.js',
  'js/TweenMax.min.js',
  'js/ScrollMagic.min.js',
  'js/debug.addIndicators.min.js',
  'js/animation.gsap.min.js',
]);

export function isRootAsset(name) {
  return (
    /\.(html|css|js|png|jpg|jpeg|gif|ico|gltf|glb|bin)$/i.test(name) &&
    !name.endsWith('.config.js')
  );
}

export async function copySite(root, outDir) {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (
      (entry.isDirectory() && assetDirectories.includes(entry.name)) ||
      (entry.isFile() && isRootAsset(entry.name))
    ) {
      await cp(path.join(root, entry.name), path.join(outDir, entry.name), {
        recursive: true,
        // Vite builds this newly extracted script; do not overwrite its bundle.
        filter: (source) =>
          source !== path.join(root, 'js/share-url.js') &&
          !retiredScripts.has(
            path.relative(root, source).split(path.sep).join('/'),
          ),
      });
    }
  }
  for (const [target, source] of Object.entries(dependencies)) {
    await mkdir(path.dirname(path.join(outDir, target)), { recursive: true });
    await cp(
      path.join(root, 'node_modules', source),
      path.join(outDir, target),
    );
  }
  // Preserve the repository's CNAME, but never publish its original domain implicitly.
  await writeFile(path.join(outDir, '.nojekyll'), '');
}

export function legacySite() {
  let config;
  return {
    name: 'deskspacing-legacy-pages',
    configResolved(value) {
      config = value;
    },
    configureServer(server) {
      // HTML must remain classic scripts: converting it to ESM changes global binding
      // and execution order. Vite still serves assets and watches for full reloads.
      server.middlewares.use(async (req, res, next) => {
        try {
          const url = new URL(req.url, 'http://localhost');
          let pathname = decodeURIComponent(url.pathname);
          const base = config.base === './' ? '/' : config.base;
          if (base !== '/' && pathname.startsWith(base))
            pathname = pathname.slice(base.length - 1);
          if (pathname === '/') pathname = '/index.html';
          const name = pathname.slice(1);
          const dependency = dependencies[name];
          if (!dependency && !/^[^/]+\.html$/.test(name)) return next();
          const file = dependency
            ? path.join(config.root, 'node_modules', dependency)
            : path.join(config.root, name);
          let contents = await readFile(file);
          if (!dependency)
            contents = contents
              .toString()
              .replace(
                '</head>',
                `<script type="module" src="${base}@vite/client"></script></head>`,
              );
          res.setHeader(
            'Content-Type',
            dependency ? 'text/javascript' : 'text/html; charset=utf-8',
          );
          res.end(contents);
        } catch (error) {
          if (error.code === 'ENOENT') return next();
          next(error);
        }
      });
    },
    async closeBundle() {
      if (config.command === 'build')
        await copySite(
          config.root,
          path.resolve(config.root, config.build.outDir),
        );
    },
  };
}
