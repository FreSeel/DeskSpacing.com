import { expect, test } from '@playwright/test';

async function start(page) {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:4173\/)/, (route) =>
    route.abort(),
  );
  await page.goto('mainApp.html');
  await page.evaluate(async () => {
    window.planner = (
      await import(new URL('./src/main.js', window.location.href).href)
    ).app;
    await window.planner.ready;
    window.planner.selection.unselectPickedObject();
  });
  await expect(page.locator('#starterModal')).toBeHidden();
  // Bootstrap removes the backdrop after the modal itself becomes hidden.
  await expect(page.locator('.modal-backdrop')).toHaveCount(0);
}

test('idle rendering stops; changes, damping and resize redraw; disposal cancels the loop', async ({
  page,
}) => {
  await start(page);
  await page.evaluate(() => {
    const { renderer } = window.planner.view;
    const render = renderer.render.bind(renderer);
    window.frames = 0;
    renderer.render = (...args) => {
      window.frames++;
      render(...args);
    };
  });
  await page.waitForTimeout(300);
  const settled = await page.evaluate(() => window.frames);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.frames)).toBe(settled);
  await page.evaluate(() =>
    window.planner.actions.add('referenceBox', { dimensions: [5, 10, 20] }),
  );
  await expect
    .poll(() => page.evaluate(() => window.frames))
    .toBeGreaterThan(settled);
  const beforeResize = await page.evaluate(() => window.frames);
  await page.setViewportSize({ width: 1100, height: 760 });
  await expect
    .poll(() => page.evaluate(() => window.frames))
    .toBeGreaterThan(beforeResize);
  await page.evaluate(() => {
    window.planner.selection.unselectPickedObject();
    window.planner.view.controls.enableDamping = true;
  });
  const canvas = await page.locator('#threeCanvas').boundingBox();
  await page.mouse.move(canvas.x + canvas.width * 0.85, canvas.y + 100);
  await page.mouse.down();
  await page.mouse.move(canvas.x + canvas.width * 0.7, canvas.y + 130, {
    steps: 8,
  });
  await page.mouse.up();
  const released = await page.evaluate(() => window.frames);
  await expect
    .poll(() => page.evaluate(() => window.frames))
    .toBeGreaterThan(released);
  await page.evaluate(() => {
    window.planner.view.controls.enableDamping = false;
    window.planner.dispose();
  });
  const disposed = await page.evaluate(() => window.frames);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.frames)).toBe(disposed);
  expect(
    await page.evaluate(
      () => window.planner.view.renderer.info.memory.geometries,
    ),
  ).toBe(0);
});

test('cached duplicates share geometry without fetching again and a surviving instance remains usable', async ({
  page,
}) => {
  await start(page);
  const requests = [];
  page.on('request', (request) => {
    if (/\.glb$/.test(request.url())) requests.push(request.url());
  });
  const result = await page.evaluate(async () => {
    const { actions, state, selection } = window.planner;
    const original = state.objects.find(
      (object) => object.userData.objectName === 'defaultMouse',
    );
    const duplicate = await actions.add('defaultMouse');
    let originalMesh, cloneMesh;
    original.traverse((object) => {
      if (object.isMesh) originalMesh = object;
    });
    duplicate.traverse((object) => {
      if (object.isMesh) cloneMesh = object;
    });
    const shared = originalMesh.geometry === cloneMesh.geometry;
    const independent = originalMesh.material !== cloneMesh.material;
    actions.remove(original);
    selection.pick(duplicate);
    duplicate.position.x += 2;
    window.planner.view.invalidateScene();
    return {
      shared,
      independent,
      selected: window.planner.view.transformControls.object === duplicate,
    };
  });
  expect(result).toEqual({ shared: true, independent: true, selected: true });
  expect(requests).toEqual([]);
  expect(
    await page.evaluate(() =>
      window.planner.view.renderer.getContext().isContextLost(),
    ),
  ).toBe(false);
});

test('high-density displays cap the drawing buffer without changing scene coordinates', async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: 'http://127.0.0.1:4173/DeskSpacing.com/',
    deviceScaleFactor: 3,
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  await start(page);
  const result = await page.evaluate(() => ({
    ratio: window.planner.view.renderer.getPixelRatio(),
    camera: window.planner.view.camera.position.toArray(),
  }));
  expect(result.ratio).toBe(2);
  expect(result.camera[1]).toBeCloseTo(61.27639300930197, 10);
  await context.close();
});
