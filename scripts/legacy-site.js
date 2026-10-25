import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { siteMounts, siteSourcePath } from './site-layout.js';

// Legacy routes retain their npm r116 engine; the desktop bundles modern ES modules.
export const dependencies = {
  'three.min.js': 'three-legacy/build/three.min.js',
  'three/examples/js/controls/DragControls.js':
    'three-legacy/examples/js/controls/DragControls.js',
  'three/examples/js/controls/TransformControls.js':
    'three-legacy/examples/js/controls/TransformControls.js',
  'three/examples/js/loaders/DRACOLoader.js':
    'three-legacy/examples/js/loaders/DRACOLoader.js',
  'vendor/popper.min.js': '@popperjs/core/dist/umd/popper.min.js',
  'vendor/bootstrap.min.js': 'bootstrap/dist/js/bootstrap.min.js',
  'vendor/THREE-LICENSE.txt': 'three/LICENSE',
  'vendor/THREE-LEGACY-LICENSE.txt': 'three-legacy/LICENSE',
  'vendor/MESHOPT-LICENSE.txt': 'meshoptimizer/LICENSE.md',
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

export async function copySite(root, outDir) {
  // Planner CSS is owned separately from the retained legacy page themes.
  try {
    await cp(path.join(root, 'src/styles'), path.join(outDir, 'src/styles'), {
      recursive: true,
    });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  // Root entry pages remain beside the Vite config; retained pages/assets are
  // mounted from their organized sources without duplicating the public URLs.
  const mounts = {
    'index.html': 'index.html',
    'mainApp.html': 'mainApp.html',
    ...siteMounts,
  };
  for (const [target, source] of Object.entries(mounts)) {
    if (target === 'js/share-url.js' || retiredScripts.has(target)) continue;
    await mkdir(path.dirname(path.join(outDir, target)), { recursive: true });
    await cp(path.join(root, source), path.join(outDir, target), {
      recursive: true,
    });
  }
  for (const [target, source] of Object.entries(dependencies)) {
    await mkdir(path.dirname(path.join(outDir, target)), { recursive: true });
    await cp(
      path.join(root, 'node_modules', source),
      path.join(outDir, target),
    );
  }
  // Never publish a custom domain implicitly; configure one on the fork host.
  await cp(
    path.join(root, 'THIRD_PARTY_NOTICES.md'),
    path.join(outDir, 'THIRD_PARTY_NOTICES.md'),
  );
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
      // Serve retained HTML without rewriting its static model/thumbnail URLs.
      // The desktop page loads an ES module; older pages keep classic scripts.
      server.middlewares.use(async (req, res, next) => {
        try {
          const url = new URL(req.url, 'http://localhost');
          let pathname = decodeURIComponent(url.pathname);
          const base = config.base === './' ? '/' : config.base;
          if (base !== '/' && pathname.startsWith(base))
            pathname = pathname.slice(base.length - 1);
          if (pathname === '/') pathname = '/index.html';
          const name = pathname.slice(1);
          const dependency = Object.hasOwn(dependencies, name)
            ? dependencies[name]
            : null;
          const source = siteSourcePath(name);
          if (!dependency && !/^[^/]+\.html$/.test(name)) {
            if (source !== name) req.url = `${base}${source}${url.search}`;
            return next();
          }
          const file = dependency
            ? path.join(config.root, 'node_modules', dependency)
            : path.join(config.root, source);
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
