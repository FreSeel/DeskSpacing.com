import { expect, test } from '@playwright/test';

async function start(page) {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:4173\/)/, (route) =>
    route.abort(),
  );
  await page.goto('mainApp.html?customSetup=%5B%20%5D');
  await page.evaluate(async () => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    await app.ready;
  });
  await expect(page.locator('#threeCanvas')).toHaveAttribute(
    'aria-busy',
    'false',
  );
}
const snapshot = (page) =>
  page.evaluate(async () => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    return app.sharing.snapshot();
  });
const setCamera = (page, position) =>
  page.evaluate(async (position) => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    app.view.camera.position.set(...position);
    app.view.controls.target.set(0, 5.15, 0);
    app.view.controls.update();
    app.view.invalidate();
  }, position);
async function fixture(page) {
  await page.evaluate(async () => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    const object = await app.actions.add('referenceBox', {
      dimensions: [3.25, 2.75, 1.125],
    });
    object.position.set(0.23, 5.15, -0.23);
    object.rotation.y = 0.37;
    app.view.invalidateScene();
  });
  await expect(page.locator('#selectionPanel')).toBeVisible();
  await setCamera(page, [35, 40, 60]);
}
async function project(page, offset) {
  return page.evaluate(async (offset) => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    app.view.camera.updateMatrixWorld();
    const point = app.selection.pickedObject.position.clone();
    point.x += offset;
    point.project(app.view.camera);
    const rect = document.getElementById('threeCanvas').getBoundingClientRect();
    return {
      x: rect.x + ((point.x + 1) * rect.width) / 2,
      y: rect.y + ((1 - point.y) * rect.height) / 2,
    };
  }, offset);
}
async function beginDrag(page, distance = 6.3) {
  // Locate the actual native X handle by hovering projected points on its axis.
  for (const offset of [4, 6, 8, 3, 10, 2]) {
    const start = await project(page, offset);
    await page.mouse.move(start.x, start.y);
    const axis = await page.evaluate(async () => {
      const { app } = await import(
        new URL('./src/main.js', window.location.href)
      );
      return app.view.transformControls.axis;
    });
    if (axis !== 'X') continue;
    const end = await project(page, offset + distance);
    await page.mouse.down();
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const { app } = await import(
            new URL('./src/main.js', window.location.href)
          );
          return app.view.transformControls.dragging;
        }),
      )
      .toBe(true);
    return { start, end };
  }
  throw new Error('Could not locate native X handle');
}
async function enable(page, spacing = '1') {
  await page.locator('#snapMenu summary').click();
  await page.locator('#snapEnabled').check();
  await page.locator('#snapSpacing').fill(spacing);
  await page.locator('#snapSpacing').press('Tab');
  await page.keyboard.press('Escape');
}

test('Snap preferences use the global units, persist without drift, validate spacing and fit the toolbar', async ({
  page,
}, testInfo) => {
  await start(page);
  await expect(page.locator('#snapMenu summary')).toHaveText('Snap off');
  await page.locator('#snapMenu summary').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await expect(page.locator('#snapEnabled')).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.locator('#snapMenu summary')).toHaveText('Snap on');
  await page.locator('#snapSpacing').fill('0');
  await page.locator('#snapSpacing').press('Tab');
  await expect(page.locator('#snapSpacing')).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await page
    .locator('#measurementUnit')
    .getByText('CM', { exact: true })
    .click();
  await page.locator('#snapMenu summary').click();
  await page.locator('#snapSpacing').fill('2.5');
  await page.locator('#snapSpacing').press('Tab');
  const saved = await page.evaluate(() =>
    window.localStorage.getItem('deskspacing.snapping'),
  );
  for (let i = 0; i < 3; i++) {
    await page
      .locator('#measurementUnit')
      .getByText('CM', { exact: true })
      .click();
    await expect(page.locator('#snapSpacing')).toHaveValue('2.5');
    await page
      .locator('#measurementUnit')
      .getByText('IN', { exact: true })
      .click();
    await expect(page.locator('#snapSpacing')).toHaveValue('0.98');
  }
  expect(
    await page.evaluate(() =>
      window.localStorage.getItem('deskspacing.snapping'),
    ),
  ).toBe(saved);
  await page
    .locator('#measurementUnit')
    .getByText('CM', { exact: true })
    .click();
  await page.reload();
  await expect(page.locator('#snapMenu summary')).toHaveText('Snap on');
  await expect(page.locator('#snapSpacing')).toHaveValue('2.5');
  for (const width of [320, 375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    const header = await page.locator('.editor-header').boundingBox();
    for (const selector of [
      '#snapMenu summary',
      '#measurementUnit',
      '#saveModalButton',
    ]) {
      const bounds = await page.locator(selector).boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(
        header.y + header.height,
      );
    }
    await page.screenshot({
      path: testInfo.outputPath(`snap-toolbar-${width}.png`),
    });
  }
  await page.locator('#snapMenu summary').click();
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await expect(page.locator('#snapMenu summary')).toHaveCSS(
    'background-color',
    'rgb(52, 60, 54)',
  );
  await page.screenshot({
    path: testInfo.outputPath('snap-settings-dark.png'),
  });
});

test('native gizmo drags snap at two camera angles, preserve geometry and save exact final transforms', async ({
  page,
}) => {
  await start(page);
  await fixture(page);
  const original = (await snapshot(page))[0];
  await enable(page, '0.5');
  for (const camera of [
    [35, 40, 60],
    [-45, 60, 45],
  ]) {
    await setCamera(page, camera);
    const before = await snapshot(page);
    const { start, end } = await beginDrag(page);
    expect(await snapshot(page)).toEqual(before); // Press preserves authored origin / drag offset.
    await page.mouse.move(start.x + 0.01, start.y + 0.01);
    expect((await snapshot(page))[0].position[0]).toBe(before[0].position[0]);
    await page.mouse.move(end.x, end.y, { steps: 12 });
    await expect(page.locator('#snapStatus')).toHaveText('Grid snapped');
    await page.mouse.up();
    await expect(page.locator('#snapStatus')).toBeHidden();
    const after = (await snapshot(page))[0];
    expect(after.position[0]).toBeGreaterThan(before[0].position[0] + 4);
    expect(after.position[0] / 0.5).toBeCloseTo(
      Math.round(after.position[0] / 0.5),
      10,
    );
    expect(after.position.slice(1)).toEqual(original.position.slice(1));
    expect(after.rotation).toEqual(original.rotation);
    expect(after.dimensions).toEqual(original.dimensions);
    await page.keyboard.press('Control+z');
    expect(await snapshot(page)).toEqual(before);
    await page.keyboard.press('Control+Shift+z');
    expect((await snapshot(page))[0]).toEqual(after);
  }
  const saved = await snapshot(page);
  const link = await page.evaluate(async () => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    return app.sharing.createLink();
  });
  expect(link).toContain('/DeskSpacing.com/mainApp.html?');
  await page.goto(link);
  await expect(page.locator('#threeCanvas')).toHaveAttribute(
    'aria-busy',
    'false',
  );
  expect(await snapshot(page)).toEqual(saved);
});

test('Alt bypass follows the held modifier, negative moves snap, and free moves remain undoable', async ({
  page,
}) => {
  await start(page);
  await fixture(page);
  await enable(page);
  const { start: origin, end } = await beginDrag(page, -6.3);
  await page.keyboard.down('Alt');
  await page.mouse.move(end.x, end.y, { steps: 6 });
  const bypassed = (await snapshot(page))[0].position[0];
  expect(bypassed).toBeLessThan(-4);
  expect(Math.abs(bypassed - Math.round(bypassed))).toBeGreaterThan(0.01);
  await expect(page.locator('#snapStatus')).toContainText('Free move');
  await page.keyboard.up('Alt');
  await page.mouse.move(
    end.x - (end.x - origin.x) * 0.05,
    end.y - (end.y - origin.y) * 0.05,
  );
  const snapped = (await snapshot(page))[0].position[0];
  expect(snapped).toBe(Math.round(snapped));
  await page.mouse.up();
  await page.locator('#snapMenu summary').click();
  await page.locator('#snapEnabled').uncheck();
  await page.keyboard.press('Escape');
  const before = await snapshot(page);
  const free = await beginDrag(page, 4.123);
  await page.mouse.move(free.end.x, free.end.y, { steps: 8 });
  await page.mouse.up();
  const after = await snapshot(page);
  expect(
    Math.abs(after[0].position[0] - Math.round(after[0].position[0])),
  ).toBeGreaterThan(0.01);
  await page.locator('#moreMenu summary').click();
  await page.locator('#undoTransform').click();
  expect(await snapshot(page)).toEqual(before);
  await page.locator('#redoTransform').click();
  expect(await snapshot(page)).toEqual(after);
});

test('blocked storage remains usable; dimension inputs never quantize to snap spacing', async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('blocked');
      },
    }),
  );
  await start(page);
  await enable(page, '5');
  await page.locator('#catalogCategory').selectOption('shapes');
  await page.locator('[data-options="referenceBox"]').click();
  await page.locator('#referenceBoxL').fill('3.123');
  await page.locator('#referenceBoxW').fill('1.789');
  await page.locator('#referenceBoxH').fill('2.345');
  await page
    .locator('[data-product="referenceBox"]:not([data-replace])')
    .click();
  await expect.poll(async () => (await snapshot(page)).length).toBe(1);
  expect((await snapshot(page))[0].dimensions).toEqual([3.123, 1.789, 2.345]);
});

test('pointer cancellation ends the gesture, restores camera controls and settles rendering', async ({
  page,
}) => {
  await start(page);
  await fixture(page);
  await enable(page);
  const { end } = await beginDrag(page);
  await page.mouse.move(end.x, end.y, { steps: 8 });
  const moved = await snapshot(page);
  await page
    .locator('#threeCanvas')
    .dispatchEvent('pointercancel', { pointerId: 1 });
  await expect(page.locator('#snapStatus')).toBeHidden();
  expect(
    await page.evaluate(async () => {
      const { app } = await import(
        new URL('./src/main.js', window.location.href)
      );
      return {
        dragging: app.view.transformControls.dragging,
        camera: app.view.controls.enabled,
        undo: app.actions.transforms.canUndo,
      };
    }),
  ).toEqual({ dragging: false, camera: true, undo: true });
  await page.mouse.move(end.x + 15, end.y + 15);
  await page.mouse.up();
  expect(await snapshot(page)).toEqual(moved);
  const frames = await page.evaluate(async () => {
    const { app } = await import(
      new URL('./src/main.js', window.location.href)
    );
    await new Promise((resolve) => window.setTimeout(resolve, 150));
    const before = app.view.renderer.info.render.frame;
    await new Promise((resolve) => window.setTimeout(resolve, 150));
    return [before, app.view.renderer.info.render.frame];
  });
  expect(frames[1]).toBe(frames[0]);
});
