import { expect, test } from '@playwright/test';

const pageErrors = new WeakMap();
test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page) || []).toEqual([]);
});

async function start(page) {
  const errors = [];
  pageErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:4173\/)/, (route) =>
    route.abort(),
  );
  await page.goto('mainApp.html');
  await page.evaluate(async () => {
    window.planner = (
      await import(new URL('./src/main.js', window.location.href))
    ).app;
    await window.planner.ready;
    window.originalRenderer = window.planner.view.renderer;
    window.planner.selection.unselectPickedObject();
  });
  await expect(page.locator('.planner-loading')).toBeHidden();
}
async function sized(page) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const canvas = document.getElementById('threeCanvas');
        const host = document.getElementById('rightSideContainer');
        return (
          Math.abs(canvas.clientWidth - host.clientWidth) +
          Math.abs(canvas.clientHeight - host.clientHeight) +
          Math.abs(
            window.planner.view.camera.aspect -
              host.clientWidth / host.clientHeight,
          )
        );
      }),
    )
    .toBeLessThan(0.01);
  expect(
    await page.evaluate(
      () =>
        window.originalRenderer === window.planner.view.renderer &&
        !window.planner.view.renderer.getContext().isContextLost(),
    ),
  ).toBe(true);
}
const count = (page) =>
  page.evaluate(() => window.planner.state.objects.length);
async function pickMonitor(page, touch = false) {
  await sized(page);
  const point = await page.evaluate(() => {
    const root = window.planner.state.objects.find(
      (o) => o.userData.objectName === 'small16x9Monitor28',
    );
    root.updateWorldMatrix(true, true);
    let mesh;
    root.traverse((o) => {
      if (o.isMesh && !mesh) mesh = o;
    });
    mesh.geometry.computeBoundingBox();
    const point = mesh.geometry.boundingBox.getCenter(mesh.position.clone());
    mesh.localToWorld(point);
    // Reset changes the camera before the next rendered frame. Project from its
    // current world matrix, just as the real picking adapter does.
    window.planner.view.camera.updateMatrixWorld();
    point.project(window.planner.view.camera);
    const rect = document.getElementById('threeCanvas').getBoundingClientRect();
    return {
      x: rect.x + ((point.x + 1) * rect.width) / 2,
      y: rect.y + ((1 - point.y) * rect.height) / 2,
    };
  });
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
  await expect(page.locator('#selectionTitle')).toHaveText('16:9 Monitor');
}
async function noOverflow(page) {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= window.innerWidth &&
        document.documentElement.scrollHeight <= window.innerHeight,
    ),
  ).toBe(true);
}

test('viewport matrix retains canvas, raycasting and reachable panels without overflow', async ({
  page,
}, testInfo) => {
  await start(page);
  for (const [width, height] of [
    [1920, 1080],
    [1600, 900],
    [1366, 768],
    [1024, 768],
    [768, 1024],
    [390, 844],
    [375, 812],
    [320, 568],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    await sized(page);
    await noOverflow(page);
    await pickMonitor(page);
    await sized(page);
    await expect(page.locator('#selectionPanel')).toBeVisible();
    if (width < 1024) {
      const box = await page.locator('#threeCanvas').boundingBox();
      await page.locator('#toggleSelectionPanel').click();
      await expect(page.locator('#selectionPanel')).toHaveAttribute(
        'aria-modal',
        'true',
      );
      await sized(page);
      expect(await page.locator('#threeCanvas').boundingBox()).toEqual(box);
      await page.keyboard.press('Escape');
      await expect(page.locator('#toggleSelectionPanel')).toBeFocused();
    }
    await page.screenshot({
      path: testInfo.outputPath(`workspace-${width}x${height}.png`),
    });
    await page.locator('#deselectObject').click();
    if (width < 1280) {
      if (!(await page.locator('#libraryPanel').isVisible()))
        await page.locator('#openLibrary').click();
      await expect(page.locator('#libraryPanel')).toBeVisible();
      await page.locator('#catalogCategory').selectOption('shapes');
      await page.locator('[data-options="referenceBox"]').click();
      await page.locator('#referenceBoxL').fill('17');
      await page.locator('#closeLibrary').click();
      await page.locator('#openLibrary').click();
      await expect(page.locator('#referenceBoxL')).toHaveValue('17');
      await page.locator('[data-options="referenceBox"]').click();
      await noOverflow(page);
      await page.screenshot({
        path: testInfo.outputPath(`library-${width}x${height}.png`),
      });
      await page.locator('#closeLibrary').click();
    }
    await page.locator('#saveModalButton').click();
    await expect(page.locator('#saveModal')).toBeFocused();
    const dialog = await page
      .locator('#saveModal .modal-content')
      .boundingBox();
    expect(dialog.x).toBeGreaterThanOrEqual(0);
    expect(dialog.x + dialog.width).toBeLessThanOrEqual(width);
    expect(dialog.y + dialog.height).toBeLessThanOrEqual(height);
    await page.keyboard.press('Escape');
    await expect(page.locator('#saveModalButton')).toBeFocused();
  }
});

test('phone sheet contains focus and pointer input; successful add reveals the scene and share restores it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  await page.locator('#openLibrary').click();
  await expect(page.locator('#closeLibrary')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  expect(
    await page.evaluate(() =>
      document.getElementById('libraryPanel').contains(document.activeElement),
    ),
  ).toBe(true);
  await page.keyboard.press('Tab');
  await expect(page.locator('#closeLibrary')).toBeFocused();
  await expect(page.locator('#rightSideContainer')).toHaveAttribute(
    'inert',
    '',
  );
  const pose = await page.evaluate(() =>
    window.planner.view.camera.position.toArray(),
  );
  await page.mouse.move(200, 100);
  await page.mouse.down();
  await page.mouse.move(250, 130);
  await page.mouse.up();
  expect(
    await page.evaluate(() => window.planner.view.camera.position.toArray()),
  ).toEqual(pose);
  await expect(page.locator('#libraryPanel')).toBeHidden();
  await expect(page.locator('#openLibrary')).toBeFocused();
  await page.locator('#openLibrary').click();
  await page.locator('#catalogCategory').selectOption('mice');
  await page
    .locator('[data-product="defaultMouse"]:not([data-replace])')
    .click();
  await expect.poll(() => count(page)).toBe(7);
  await expect(page.locator('#libraryPanel')).toBeHidden();
  await expect(page.locator('#selectionTitle')).toHaveText('DeathAdder Mouse');
  await page.locator('#toggleSelectionPanel').click();
  await page.locator('[data-command="rotate"]').click();
  await page.keyboard.press('r');
  await expect(page.locator('[data-command="rotate"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.locator('#removeObject').click();
  await expect.poll(() => count(page)).toBe(6);
  await expect(page.locator('#panelBackdrop')).toBeHidden();
  await expect(page.locator('#threeCanvas')).toBeFocused();
  await page.locator('#saveModalButton').click();
  await expect(page.locator('.editor-shell')).toHaveAttribute('inert', '');
  const link = await page.locator('#customLinkForm').inputValue();
  await page.goto(link);
  await page.evaluate(async () => {
    window.planner = (
      await import(new URL('./src/main.js', window.location.href))
    ).app;
    await window.planner.ready;
  });
  expect(await count(page)).toBe(6);
});

test('compact dock and breakpoint changes preserve choices, selection and pending work', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await start(page);
  await page.locator('#catalogCategory').selectOption('mice');
  await page
    .locator('[data-product="defaultMouse"]:not([data-replace])')
    .click();
  await expect.poll(() => count(page)).toBe(7);
  await expect(page.locator('#libraryPanel')).toBeVisible();
  await expect(page.locator('#selectionPanel')).toBeHidden();
  await page.locator('#openSelection').click();
  await expect(page.locator('#libraryPanel')).toBeHidden();
  await expect(page.locator('#selectionPanel')).toBeVisible();
  expect((await page.locator('#threeCanvas').boundingBox()).width).toBe(720);
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.locator('#toggleSelectionPanel')).toBeVisible();
  await page.locator('#openLibrary').click();
  let release;
  const barrier = new Promise((resolve) => {
    release = resolve;
  });
  await page.route(
    /GLTFs\/mice(?:%20| )and(?:%20| )mousepads\/mouse(?:%20| )2/,
    async (route) => {
      await barrier;
      await route.continue();
    },
  );
  const card = page.locator('[data-card="MXMaster3"]');
  await card.locator('[data-action="add"]').first().click();
  await expect(card).toHaveAttribute('aria-busy', 'true');
  await page.locator('#closeLibrary').click();
  await page.locator('#openLibrary').click();
  await page.locator('#catalogSearch').fill('mouse');
  release();
  await expect(card).not.toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('#libraryPanel')).toBeVisible();
  await expect(page.locator('#catalogSearch')).toBeFocused();
  await page.setViewportSize({ width: 1366, height: 768 });
  await expect(page.locator('#panelBackdrop')).toBeHidden();
  await expect(page.locator('#libraryPanel')).not.toHaveAttribute('aria-modal');
  await expect(page.locator('#rightSideContainer')).not.toHaveAttribute(
    'inert',
  );
  await expect(page.locator('#catalogSearch')).toHaveValue('mouse');
  await sized(page);
});

test('phone errors stay local and preserve forms; empty setup provides guidance', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await start(page);
  await page.locator('#openLibrary').click();
  await page.locator('#catalogCategory').selectOption('shapes');
  await page.locator('[data-options="referenceBox"]').click();
  await page.locator('#referenceBoxL').fill('-4');
  await page
    .locator('[data-product="referenceBox"]:not([data-replace])')
    .click();
  await expect(page.locator('#referenceBoxError')).toBeVisible();
  await expect(page.locator('#referenceBoxL')).toBeFocused();
  await page.route(
    /GLTFs\/mice(?:%20| )and(?:%20| )mousepads\/mouse(?:%20| )2/,
    (route) => route.abort(),
  );
  await page.locator('#catalogCategory').selectOption('mice');
  await page.locator('[data-product="MXMaster3"]:not([data-replace])').click();
  await expect(page.locator('#MXMaster3Error')).toBeVisible();
  await expect(page.locator('#libraryPanel')).toBeVisible();
  await expect(page.locator('.planner-feedback')).toBeHidden();
  await page.locator('#catalogCategory').selectOption('shapes');
  await expect(page.locator('#referenceBoxL')).toHaveValue('-4');
  await page.locator('#closeLibrary').click();
  await page.evaluate(() => window.planner.actions.reset());
  await expect(page.locator('.planner-empty')).toBeVisible();
  await expect(page.locator('#selectionPanel')).toBeHidden();
});

test('responsive target sizes, enlarged text and forced colors', async ({
  page,
}, testInfo) => {
  await start(page);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#openLibrary').click();
  await page.locator('#catalogCategory').selectOption('mice');
  await page.locator('#catalogSearch').fill('nothing matches');
  expect(
    (await page.locator('.editor-brand').boundingBox()).height,
  ).toBeGreaterThanOrEqual(44);
  const targets = await page
    .locator(
      '#libraryPanel button:visible, #libraryPanel input:visible, #libraryPanel select:visible',
    )
    .evaluateAll((nodes) =>
      nodes.map((node) => ({
        id: node.id,
        height: node.getBoundingClientRect().height,
      })),
    );
  for (const target of targets)
    expect(target.height, target.id).toBeGreaterThanOrEqual(44);
  await page.locator('#clearFilters').click();
  await page.locator('#catalogCategory').selectOption('mice');
  const actions = await page
    .locator('.product-actions button:visible')
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect().height),
    );
  actions.forEach((height) => expect(height).toBeGreaterThanOrEqual(44));
  await page.locator('#closeLibrary').click();
  await pickMonitor(page);
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.locator('#toggleSelectionPanel').click();
  await page.keyboard.press('Escape');
  await page.emulateMedia({ forcedColors: 'active' });
  await page.screenshot({ path: testInfo.outputPath('forced-colors.png') });
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addStyleTag({ content: '.planner-app { font-size: 28px; }' });
  await noOverflow(page);
  await page.locator('#moreMenu summary').click();
  const menu = await page.locator('#moreMenu .menu-popover').boundingBox();
  const header = await page.locator('.editor-header').boundingBox();
  expect(menu.y).toBeGreaterThanOrEqual(header.y + header.height);
  expect(menu.y + menu.height).toBeLessThanOrEqual(568);
  await page.keyboard.press('Escape');
  await page.locator('#openLibrary').click();
  await expect(page.locator('#closeLibrary')).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath('enlarged-text.png') });
});

test('emulated one/two-finger gestures orbit and zoom; cancel leaves controls enabled', async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: 'http://127.0.0.1:4173/DeskSpacing.com/',
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 3,
  });
  const page = await context.newPage();
  await start(page);
  const client = await context.newCDPSession(page);
  const touch = (type, points) =>
    client.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: points.map(([x, y], id) => ({ x, y, id })),
    });
  const original = await page.evaluate(() =>
    window.planner.view.camera.position.toArray(),
  );
  await touch('touchStart', [[300, 180]]);
  for (let x = 290; x >= 210; x -= 10) await touch('touchMove', [[x, 180]]);
  await touch('touchEnd', []);
  expect(
    await page.evaluate(() => window.planner.view.camera.position.toArray()),
  ).not.toEqual(original);
  const distance = () =>
    page.evaluate(() =>
      window.planner.view.camera.position.distanceTo(
        window.planner.view.controls.target,
      ),
    );
  const before = await distance();
  await touch('touchStart', [
    [120, 160],
    [240, 160],
  ]);
  await touch('touchMove', [
    [80, 180],
    [280, 180],
  ]);
  await touch('touchCancel', []);
  expect(await distance()).not.toBeCloseTo(before, 3);
  expect(await page.evaluate(() => window.planner.view.controls.enabled)).toBe(
    true,
  );
  expect(
    await page.evaluate(() => window.planner.view.renderer.getPixelRatio()),
  ).toBe(2);
  await page.locator('#openLibrary').tap();
  await expect(page.locator('#libraryPanel')).toBeVisible();
  await page.locator('#closeLibrary').tap();
  await expect(page.locator('#libraryPanel')).toBeHidden();
  await page.locator('#resetCameraButton').tap();
  await pickMonitor(page, true);
  await sized(page);
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        window.requestAnimationFrame(() =>
          window.requestAnimationFrame(resolve),
        ),
      ),
  );
  const handle = await page.evaluate(() => {
    const { camera, transformControls } = window.planner.view;
    const helper = transformControls.getHelper();
    helper.updateMatrixWorld(true);
    const gizmo = helper.children.find((child) => child.gizmo);
    const arrow = gizmo.gizmo.translate.children.find(
      (child) => child.name === 'X' && child.visible && child.type === 'Mesh',
    );
    arrow.geometry.computeBoundingBox();
    const point = arrow.geometry.boundingBox.getCenter(arrow.position.clone());
    arrow.localToWorld(point);
    point.project(camera);
    const rect = document.getElementById('threeCanvas').getBoundingClientRect();
    return {
      x: rect.x + ((point.x + 1) * rect.width) / 2,
      y: rect.y + ((1 - point.y) * rect.height) / 2,
    };
  });
  const beforeMove = await page.evaluate(() =>
    window.planner.selection.pickedObject.position.toArray(),
  );
  await touch('touchStart', [[handle.x, handle.y]]);
  expect(
    await page.evaluate(() => window.planner.view.transformControls.dragging),
  ).toBe(true);
  await touch('touchMove', [[handle.x + 30, handle.y]]);
  expect(
    await page.evaluate(() =>
      window.planner.selection.pickedObject.position.toArray(),
    ),
  ).not.toEqual(beforeMove);
  await touch('touchCancel', []);
  expect(
    await page.evaluate(() => window.planner.view.transformControls.dragging),
  ).toBe(false);
  expect(await page.evaluate(() => window.planner.view.controls.enabled)).toBe(
    true,
  );
  await sized(page);
  expect(pageErrors.get(page)).toEqual([]);
  await context.close();
});

test('macOS Chromium visual baselines for desktop, phone and tablet UI', async ({
  page,
}) => {
  // Native UI fonts differ by OS. Keep pixel approval explicit; geometry and
  // functional checks above run on every platform, including Linux CI.
  test.skip(
    process.platform !== 'darwin',
    'Reviewed native-font pixel baselines are macOS-only.',
  );
  await start(page);
  await page.setViewportSize({ width: 1600, height: 900 });
  await expect(page.locator('.editor-header')).toHaveScreenshot(
    'desktop-header.png',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#openLibrary').click();
  await page.locator('#catalogCategory').selectOption('mice');
  await page.locator('#catalogSearch').fill('nothing matches');
  await expect(page.locator('#libraryPanel')).toHaveScreenshot(
    'phone-library-empty.png',
  );
  await page.locator('#closeLibrary').click();
  await pickMonitor(page);
  await expect(page.locator('#selectionPanel')).toHaveScreenshot(
    'phone-selection-bar.png',
  );
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.locator('#toggleSelectionPanel').click();
  await expect(page.locator('#selectionPanel')).toHaveScreenshot(
    'tablet-inspector.png',
  );
});

test('every configurable card fits a short phone sheet and image failures retain labels', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 340 });
  await page.route(
    /Model(?:%20| )thumbnails\/.*\.(?:png|jpe?g|webp)/i,
    (route) => route.abort(),
  );
  await start(page);
  await page.locator('#openLibrary').click();
  const ids = await page
    .locator('[data-options]')
    .evaluateAll((nodes) => nodes.map((node) => node.dataset.options));
  expect(ids.length).toBe(17);
  await expect(
    page.locator('[data-card="customDesk"] .thumbnail-fallback'),
  ).toBeVisible();
  await expect(
    page.locator('[data-card="customDesk"] .thumbnail-well img'),
  ).toBeHidden();
  for (const id of ids) {
    const toggle = page.locator(`[data-options="${id}"]`);
    await toggle.click();
    const card = page.locator(`[data-card="${id}"]`);
    expect(
      await card.evaluate((node) => node.scrollWidth <= node.clientWidth),
    ).toBe(true);
    const action = card.locator('[data-action="add"]').first();
    await action.scrollIntoViewIfNeeded();
    await expect(action).toBeInViewport();
    await toggle.click();
  }
  await page.locator('#catalogCategory').selectOption('shapes');
  await page.locator('[data-options="referenceBox"]').click();
  await page.locator('#referenceBoxL').fill('23');
  await page.locator('#referenceBoxW').fill('7');
  await page.locator('#referenceBoxH').fill('9');
  await page
    .locator('[data-product="referenceBox"]:not([data-replace])')
    .click();
  await expect.poll(() => count(page)).toBe(7);
  await expect(page.locator('#libraryPanel')).toBeHidden();
  await page.locator('#openLibrary').click();
  await expect(page.locator('#referenceBoxL')).toHaveValue('23');
  await expect(page.locator('#closeLibrary')).toBeInViewport();
  await noOverflow(page);
});
