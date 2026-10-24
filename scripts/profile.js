// Production-only, repeatable Chromium benchmark. Build and start preview first.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import os from 'node:os';

const base =
  process.env.PROFILE_URL || 'http://127.0.0.1:4173/DeskSpacing.com/';
const label = process.argv[2] || 'local';
const runs = Number(process.env.PROFILE_RUNS || 3);
const output = 'docs/performance';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  args: [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--enable-precise-memory-info',
    '--js-flags=--expose-gc',
  ],
});
const results = [];
for (let run = 0; run < runs; run++) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  // Isolate application work from third-party availability and timing noise.
  await page.route('**/*', (route) =>
    new URL(route.request().url()).origin === new URL(base).origin
      ? route.continue()
      : route.abort(),
  );
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(base, { waitUntil: 'load' });
  const landing = await page.evaluate(() =>
    window.performance.getEntriesByType('navigation')[0].toJSON(),
  );
  await page.addInitScript(() => {
    window.addEventListener('DOMContentLoaded', async () => {
      if (!window.location.pathname.endsWith('/mainApp.html')) return;
      window.planner = (
        await import(new URL('./src/main.js', window.location.href).href)
      ).app;
      await window.planner.ready;
      await new Promise((resolve) =>
        window.requestAnimationFrame(() =>
          window.requestAnimationFrame(resolve),
        ),
      );
      window.editorReadyMs = window.performance.now();
    });
  });
  await page.goto(new URL('mainApp.html', base).href, { waitUntil: 'load' });
  await page.waitForFunction(() => window.editorReadyMs, { timeout: 120000 });
  const startup = await page.evaluate(() => ({
    navigation: window.performance.getEntriesByType('navigation')[0].toJSON(),
    editorReadyMs: window.editorReadyMs,
    sceneInitMs:
      window.performance.getEntriesByName('planner:scene-init')[0]?.duration,
    resources: window.performance.getEntriesByType('resource').map((e) => ({
      name: e.name,
      type: e.initiatorType,
      transfer: e.transferSize,
      encoded: e.encodedBodySize,
      duration: e.duration,
    })),
  }));
  const scripts = [];
  for (const resource of startup.resources.filter(
    (r) => /\.js(?:\?|$)/.test(r.name) && r.name.startsWith(base),
  )) {
    const response = await context.request.get(resource.name);
    const body = await response.body();
    scripts.push({
      path: resource.name.slice(base.length),
      bytes: body.length,
      gzipBytes: gzipSync(body).length,
    });
  }
  await page
    .locator('#starterModal .modal-footer [data-bs-dismiss=modal]')
    .click();
  await page.waitForFunction(
    () => !document.querySelector('#starterModal').classList.contains('show'),
  );
  await page.evaluate(() => {
    const { view, selection } = window.planner;
    selection.unselectPickedObject();
    view.resetCamera();
    window.renderSamples = [];
    const render = view.renderer.render.bind(view.renderer);
    view.renderer.render = (...args) => {
      const start = window.performance.now();
      render(...args);
      window.renderSamples.push({
        time: start,
        cpuMs: window.performance.now() - start,
        calls: view.renderer.info.render.calls,
        triangles: view.renderer.info.render.triangles,
      });
    };
    window.resourceSnapshot = () => {
      const renderer = view.renderer;
      const gl = renderer.getContext();
      const debug = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        memory: { ...renderer.info.memory },
        programs: renderer.info.programs.length,
        render: { ...renderer.info.render },
        heapBytes: window.performance.memory?.usedJSHeapSize,
        gpu: debug
          ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)
          : gl.getParameter(gl.RENDERER),
        camera: view.camera.position.toArray(),
        objects: window.planner.sharing.snapshot(),
        pixelRatio: renderer.getPixelRatio(),
      };
    };
  });
  await page.waitForTimeout(500);
  if (run === 0)
    await page
      .locator('#threeCanvas')
      .screenshot({ path: `${output}/${label}-default.png` });
  await page.evaluate(() => {
    window.renderSamples.length = 0;
  });
  await page.waitForTimeout(2000);
  const idle = await page.evaluate(() => ({
    samples: window.renderSamples,
    resources: window.resourceSnapshot(),
  }));
  const bounds = await page.locator('#threeCanvas').boundingBox();
  await page.mouse.move(
    bounds.x + bounds.width * 0.8,
    bounds.y + bounds.height * 0.3,
  );
  await page.evaluate(() => {
    window.renderSamples.length = 0;
  });
  await page.mouse.down();
  const start = Date.now();
  for (let i = 0; i < 60; i++) {
    await page.mouse.move(
      bounds.x + bounds.width * (0.8 + Math.sin(i / 15) * 0.08),
      bounds.y + bounds.height * (0.3 + Math.cos(i / 15) * 0.05),
    );
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  const orbit = await page.evaluate(
    (durationMs) => ({ durationMs, samples: window.renderSamples }),
    Date.now() - start,
  );
  await page.evaluate(() => window.planner.view.resetCamera());
  await cdp.send('HeapProfiler.collectGarbage');
  const beforeDuplicates = await page.evaluate(() => window.resourceSnapshot());
  const duplicates = await page.evaluate(async () => {
    const start = window.performance.now();
    window.added = await Promise.all(
      Array.from({ length: 10 }, () =>
        window.planner.actions.add('defaultMouse'),
      ),
    );
    await new Promise((resolve) =>
      window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)),
    );
    return {
      durationMs: window.performance.now() - start,
      resources: window.resourceSnapshot(),
    };
  });
  await page.evaluate(() => {
    window.added.forEach((object) => window.planner.actions.remove(object));
    window.added = null;
  });
  await page.waitForTimeout(150);
  await cdp.send('HeapProfiler.collectGarbage');
  const afterDelete = await page.evaluate(() => window.resourceSnapshot());
  await page.evaluate(() => window.planner.dispose());
  await page.waitForTimeout(100);
  const disposed = await page.evaluate(() => ({
    ...window.planner.view.renderer.info.memory,
  }));
  results.push({
    landingLoadMs: landing.loadEventEnd,
    startup,
    scripts,
    idle,
    orbit,
    beforeDuplicates,
    duplicates,
    afterDelete,
    disposed,
    errors,
  });
  console.log(
    `${label} ${run + 1}/${runs}: ready ${startup.editorReadyMs.toFixed(0)}ms, idle ${idle.samples.length} renders, duplicates ${duplicates.durationMs.toFixed(0)}ms`,
  );
  await context.close();
}
await browser.close();
await writeFile(
  `${output}/${label}.json`,
  JSON.stringify(
    {
      label,
      date: new Date().toISOString(),
      conditions: {
        base,
        browser: browser.version(),
        viewport: [1280, 800],
        dpr: 1,
        platform: `${os.platform()} ${os.release()} ${os.arch()}`,
        cpu: os.cpus()[0].model,
        node: process.version,
        network:
          'localhost, cache disabled, third parties blocked, no throttle',
        renderer: 'ANGLE SwiftShader (software WebGL)',
      },
      results,
    },
    null,
    2,
  ),
);
